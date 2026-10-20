import io
import json
import logging
import os
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from ingest import (
    add_text,
    delete_data,
    delete_document,
    extract_pdf_text,
    has_data,
    list_documents,
)
from answer import stream_answer
from auth import get_owner_id, supabase_config

logger = logging.getLogger("rag")

DIST_DIR = Path(__file__).parent / "frontend" / "dist"  # built React app
ALLOWED_EXTENSIONS = {".txt", ".md", ".pdf"}
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB per file
MAX_DOCS_PER_OWNER = 20  # protects your API credits
MAX_HISTORY_MESSAGES = 10

app = FastAPI(title="DocChat")


# ---------- Public settings for the login form ----------

@app.get("/api/config")
def get_config():
    """
    Public Supabase settings (URL + anon key) so the browser can create the login client.
    """
    return supabase_config()


# ---------- Helpers ----------

def read_upload(file: UploadFile) -> str:
    """
    Read an uploaded .txt / .md / .pdf file and return its text.
    Raises ValueError with a user-friendly message on problems.
    """
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise ValueError("Unsupported file type. Use .pdf, .txt or .md.")

    data = file.file.read(MAX_FILE_BYTES + 1)
    if len(data) > MAX_FILE_BYTES:
        raise ValueError("File is too large (10 MB limit).")

    if suffix == ".pdf":
        try:
            return extract_pdf_text(io.BytesIO(data))
        except ValueError:
            raise  # e.g. scanned PDF, message is already friendly
        except Exception:
            raise ValueError("Could not read this PDF. It may be damaged or password-protected.")
    return data.decode("utf-8", errors="ignore")


def sse(event: dict) -> str:
    """
    Format one event for Server-Sent Events.
    """
    return f"data: {json.dumps(event)}\n\n"


# ---------- API ----------

@app.get("/api/documents")
def get_documents(owner_id: str = Depends(get_owner_id)):
    return {"documents": list_documents(owner_id)}


@app.post("/api/upload")
def upload(
    owner_id: str = Depends(get_owner_id),
    text: str = Form(""),
    files: list[UploadFile] = File(default=[]),
):
    """
    Add pasted text and/or several files. Each one becomes its own document.
    Returns a result per item so the page can show what worked.
    """
    doc_count = len(list_documents(owner_id))

    items = []  # (name, function that returns the text)
    if text.strip():
        items.append(("pasted text", lambda: text))
    for f in files:
        items.append((f.filename or "file", lambda f=f: read_upload(f)))

    if not items:
        raise HTTPException(status_code=400, detail="Add some text or at least one file.")

    results = []
    for name, get_text in items:
        if doc_count >= MAX_DOCS_PER_OWNER:
            results.append({"name": name, "ok": False, "error": f"Limit of {MAX_DOCS_PER_OWNER} documents reached."})
            continue
        try:
            n_chunks = add_text(get_text(), owner_id, name)
            doc_count += 1
            results.append({"name": name, "ok": True, "chunks": n_chunks})
        except ValueError as e:
            results.append({"name": name, "ok": False, "error": str(e)})
        except Exception:
            logger.exception("Upload failed for %s", name)
            results.append({"name": name, "ok": False, "error": "Something went wrong while processing this item."})
    return {"results": results}


@app.delete("/api/documents/{document_id}")
def remove_document(document_id: int, owner_id: str = Depends(get_owner_id)):
    if not delete_document(owner_id, document_id):
        raise HTTPException(status_code=404, detail="Document not found.")
    return {"ok": True}


@app.delete("/api/data")
def remove_all_data(owner_id: str = Depends(get_owner_id)):
    delete_data(owner_id)
    return {"ok": True}


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    history: list[Message] = []


@app.post("/api/chat")
def chat(req: ChatRequest, owner_id: str = Depends(get_owner_id)):
    """
    Stream the answer back as Server-Sent Events: sources first, then tokens.
    """
    history = [
        {"role": m.role, "content": m.content[:4000]}
        for m in req.history[-MAX_HISTORY_MESSAGES:]
    ]

    def events():
        try:
            if not has_data(owner_id):
                yield sse({"type": "error", "message": "Please add some data first."})
                return
            for event in stream_answer(req.question.strip(), history, owner_id):
                yield sse(event)
        except Exception:
            logger.exception("Chat failed")
            yield sse({"type": "error", "message": "Something went wrong while generating the answer."})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------- Web page (the built React app) ----------

if DIST_DIR.exists():
    # Serves index.html at "/" and the JS/CSS files under /assets
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="frontend")
else:

    @app.get("/")
    def frontend_missing():
        return {"detail": "Frontend not built yet. Run: cd frontend && npm install && npm run build"}


if __name__ == "__main__":
    import uvicorn

    on_render = "PORT" in os.environ
    uvicorn.run(
        app,
        host="0.0.0.0" if on_render else "127.0.0.1",
        port=int(os.environ.get("PORT", 8000)),
    )
