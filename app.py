import os
import uuid
from pathlib import Path

import gradio as gr

from ingest import add_text, delete_data, extract_pdf_text
from answer import answer_question

NO_DATA_STATUS = "No data yet. Add your text below to get started."
NO_DATA_REPLY = "Please add your data first (paste text or upload a .txt/.pdf file above), then ask me questions about it."


def extract_text(content) -> str:
    """
    Gradio message content can be a plain string or a list of parts.
    Normalize it to plain text.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                parts.append(item.get("text", ""))
        return " ".join(p for p in parts if p)
    return str(content) if content is not None else ""


def chat(message, history, owner_id):
    """
    Called by Gradio on every user message.
    owner_id identifies this visitor's data ("" until they add data).
    """
    if not owner_id:
        return NO_DATA_REPLY

    question = extract_text(message)
    clean_history = [
        {"role": m["role"], "content": extract_text(m["content"])} for m in history
    ]
    answer, _docs = answer_question(question, clean_history, owner_id)
    return answer


def read_file(file) -> str:
    """
    Read an uploaded .txt or .pdf file and return its text.
    """
    if not file:
        return ""
    path = file if isinstance(file, str) else file.name
    if Path(path).suffix.lower() == ".pdf":
        return extract_pdf_text(path)
    return Path(path).read_text(encoding="utf-8", errors="ignore")


def add_data(text, file, owner_id):
    """
    Add the user's pasted text and/or .txt file to the database under their own ID.
    Returns: owner ID, status message, cleared text box, cleared file.
    """
    try:
        file_text = read_file(file)
    except ValueError as e:
        return owner_id, f"⚠️ {e}", text, file
    except Exception as e:
        return owner_id, f"⚠️ Could not read the file: {e}", text, file

    filename = Path(file if isinstance(file, str) else file.name).name if file else "pasted text"
    combined = "\n\n".join(p for p in [text or "", file_text] if p.strip())
    if not combined.strip():
        return owner_id, "⚠️ Please paste some text or upload a .txt or .pdf file.", text, file

    # First upload in this session: create a private ID for this user
    target = owner_id or "user_" + uuid.uuid4().hex[:10]

    try:
        n_chunks = add_text(combined, target, filename)
    except ValueError as e:
        return owner_id, f"⚠️ {e}", text, file
    except Exception as e:
        return owner_id, f"⚠️ Something went wrong: {e}", text, file

    return target, f"✅ Added {n_chunks} chunks. You can now ask questions about your data.", "", None


def clear_data(owner_id):
    """
    Delete the user's data.
    """
    delete_data(owner_id)
    return "", NO_DATA_STATUS


def main():
    with gr.Blocks(title="RAG Assistant") as demo:
        gr.Markdown("# RAG Assistant\nAdd your own text, then ask questions about it.")

        # This visitor's private ID (empty until they add data)
        owner = gr.State("")

        with gr.Accordion("Add your data", open=True):
            text_box = gr.Textbox(label="Paste your text", lines=6)
            file_box = gr.File(label="...or upload a .txt or .pdf file", file_types=[".txt", ".pdf"])
            with gr.Row():
                add_btn = gr.Button("Add data", variant="primary")
                clear_btn = gr.Button("Clear my data")
            status = gr.Markdown(NO_DATA_STATUS)

        add_btn.click(
            add_data,
            inputs=[text_box, file_box, owner],
            outputs=[owner, status, text_box, file_box],
        )
        clear_btn.click(clear_data, inputs=[owner], outputs=[owner, status])

        gr.ChatInterface(fn=chat, additional_inputs=[owner])

    # Render provides the port via the PORT environment variable
    demo.launch(server_name="0.0.0.0", server_port=int(os.environ.get("PORT", 7860)))


if __name__ == "__main__":
    main()