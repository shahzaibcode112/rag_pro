import os

import numpy as np
import psycopg
from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from pgvector.psycopg import register_vector
from pypdf import PdfReader

load_dotenv(override=True)

# Limit on uploaded text, so one upload can't burn through your API credits
MAX_CHARS = 100000

DATABASE_URL = os.getenv("DATABASE_URL")
openrouter_api_key = os.getenv("OPENROUTER_API_KEY")

# 1536 dimensions, matches vector(1536) in schema.sql
embeddings = OpenAIEmbeddings(
    model="text-embedding-3-small",
    api_key=openrouter_api_key,
    base_url="https://openrouter.ai/api/v1",
)


def get_connection():
    """
    Open a connection to the Supabase Postgres database.
    """
    # prepare_threshold=None avoids problems with Supabase's connection pooler
    conn = psycopg.connect(DATABASE_URL, autocommit=True, prepare_threshold=None)
    register_vector(conn)
    return conn


def extract_pdf_text(source) -> str:
    """
    Read a PDF (file path or file-like object) and return all of its text, page by page.
    Raises ValueError if no text is found (e.g. a scanned PDF).
    """
    reader = PdfReader(source)
    pages = [(page.extract_text() or "") for page in reader.pages]
    text = "\n\n".join(p for p in pages if p.strip())
    if not text.strip():
        raise ValueError(
            "No text found in this PDF. It may be a scanned document (images), which isn't supported yet."
        )
    print(f"Extracted {len(text):,} characters from {len(reader.pages)} pages")
    return text


def create_chunks(text: str) -> list[str]:
    """
    Split text into small overlapping chunks.
    """
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
    chunks = text_splitter.split_text(text)
    print(f"Created {len(chunks)} chunks")
    return chunks


def add_text(text: str, owner_id: str, filename: str = "pasted text") -> int:
    """
    Chunk and embed text, then store it in the database under this owner.
    Returns the number of chunks added.
    """
    text = text.strip()
    if not text:
        raise ValueError("The text is empty.")
    if len(text) > MAX_CHARS:
        raise ValueError(f"Text is too long ({len(text):,} characters). The limit is {MAX_CHARS:,}.")

    chunks = create_chunks(text)
    vectors = embeddings.embed_documents(chunks)

    with get_connection() as conn:
        document_id = conn.execute(
            "insert into documents (owner_id, filename) values (%s, %s) returning id",
            (owner_id, filename),
        ).fetchone()[0]

        with conn.cursor() as cur:
            cur.executemany(
                "insert into chunks (document_id, owner_id, content, embedding) values (%s, %s, %s, %s)",
                [(document_id, owner_id, chunk, np.array(vec)) for chunk, vec in zip(chunks, vectors)],
            )
    return len(chunks)


def delete_data(owner_id: str):
    """
    Delete all documents (and their chunks) belonging to this owner.
    """
    if not owner_id:
        return
    with get_connection() as conn:
        conn.execute("delete from documents where owner_id = %s", (owner_id,))


def has_data(owner_id: str) -> bool:
    """
    True if this owner has at least one document.
    """
    with get_connection() as conn:
        row = conn.execute(
            "select 1 from documents where owner_id = %s limit 1", (owner_id,)
        ).fetchone()
    return row is not None


def list_documents(owner_id: str) -> list[dict]:
    """
    List this owner's documents (newest first) with their chunk counts.
    """
    with get_connection() as conn:
        rows = conn.execute(
            """
            select d.id, d.filename, d.created_at, count(c.id)
            from documents d
            left join chunks c on c.document_id = d.id
            where d.owner_id = %s
            group by d.id
            order by d.created_at desc
            """,
            (owner_id,),
        ).fetchall()
    return [
        {"id": r[0], "filename": r[1], "created_at": r[2].isoformat(), "chunks": r[3]}
        for r in rows
    ]


def delete_document(owner_id: str, document_id: int) -> bool:
    """
    Delete one document (and its chunks), only if it belongs to this owner.
    """
    with get_connection() as conn:
        row = conn.execute(
            "delete from documents where id = %s and owner_id = %s returning id",
            (document_id, owner_id),
        ).fetchone()
    return row is not None
