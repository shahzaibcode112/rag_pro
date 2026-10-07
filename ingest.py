import os
from pathlib import Path

from pypdf import PdfReader
from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document

load_dotenv(override=True)

DB_NAME = str(Path(__file__).parent / "vector_db")

# Limit on uploaded text, so one upload can't burn through your API credits
MAX_CHARS = 100000

openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
embeddings = OpenAIEmbeddings(
    model="text-embedding-3-large",
    api_key=openrouter_api_key,
    base_url="https://openrouter.ai/api/v1",
)


def extract_pdf_text(path: str) -> str:
    """
    Read a PDF and return all of its text, page by page.
    Raises ValueError if no text is found (e.g. a scanned PDF).
    """
    reader = PdfReader(path)
    pages = [(page.extract_text() or "") for page in reader.pages]
    text = "\n\n".join(p for p in pages if p.strip())
    if not text.strip():
        raise ValueError(
            "No text found in this PDF. It may be a scanned document (images), which isn't supported yet."
        )
    print(f"Extracted {len(text):,} characters from {len(reader.pages)} pages")
    return text


def create_chunks(documents):
    """
    Split documents into small overlapping chunks.
    """
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
    chunks = text_splitter.split_documents(documents)
    print(f"Created {len(chunks)} chunks")
    return chunks


def get_vectorstore(collection_name: str) -> Chroma:
    """
    Open (or create) a collection in the vector database.
    """
    return Chroma(
        collection_name=collection_name,
        persist_directory=DB_NAME,
        embedding_function=embeddings,
    )


def add_text(text: str, collection_name: str) -> int:
    """
    Chunk and embed text uploaded by a user, and add it to their own collection.
    Returns the number of chunks added.
    """
    text = text.strip()
    if not text:
        raise ValueError("The text is empty.")
    if len(text) > MAX_CHARS:
        raise ValueError(f"Text is too long ({len(text):,} characters). The limit is {MAX_CHARS:,}.")

    doc = Document(page_content=text, metadata={"doc_type": "upload"})
    chunks = create_chunks([doc])
    get_vectorstore(collection_name).add_documents(chunks)
    return len(chunks)


def delete_collection(collection_name: str):
    """
    Delete a user's collection.
    """
    if collection_name:
        get_vectorstore(collection_name).delete_collection()