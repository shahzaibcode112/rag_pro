import os
import glob
import shutil
from pathlib import Path

from dotenv import load_dotenv
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma

load_dotenv(override=True)

DB_NAME = str(Path(__file__).parent / "vector_db")
KNOWLEDGE_BASE = str(Path(__file__).parent / "knowledge-base")

openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
embeddings = OpenAIEmbeddings(
    model="text-embedding-3-large",
    api_key=openrouter_api_key,
    base_url="https://openrouter.ai/api/v1",
)


def fetch_documents():
    """
    Load every .md file from each sub-folder of the knowledge base.
    The folder name is stored as 'doc_type' in the metadata.
    """
    folders = glob.glob(str(Path(KNOWLEDGE_BASE) / "*"))
    documents = []
    for folder in folders:
        doc_type = os.path.basename(folder)
        loader = DirectoryLoader(
            folder,
            glob="**/*.md",
            loader_cls=TextLoader,
            loader_kwargs={"encoding": "utf-8"},
        )
        for doc in loader.load():
            doc.metadata["doc_type"] = doc_type
            documents.append(doc)
    print(f"Loaded {len(documents)} documents")
    return documents


def create_chunks(documents):
    """
    Split documents into small overlapping chunks.
    """
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
    chunks = text_splitter.split_documents(documents)
    print(f"Created {len(chunks)} chunks")
    return chunks


def create_embeddings(chunks):
    """
    Embed the chunks and store them in a fresh Chroma vector database.
    """
    # Start clean so re-running ingestion doesn't create duplicates
    if os.path.exists(DB_NAME):
        shutil.rmtree(DB_NAME)

    vectorstore = Chroma.from_documents(
        documents=chunks, embedding=embeddings, persist_directory=DB_NAME
    )

    collection = vectorstore._collection
    count = collection.count()
    sample_embedding = collection.get(limit=1, include=["embeddings"])["embeddings"][0]
    dimensions = len(sample_embedding)
    print(f"There are {count:,} vectors with {dimensions:,} dimensions in the vector store")
    return vectorstore


if __name__ == "__main__":
    documents = fetch_documents()
    chunks = create_chunks(documents)
    create_embeddings(chunks)
    print("Ingestion complete")
