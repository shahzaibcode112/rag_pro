import os
from pathlib import Path

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.messages import SystemMessage, HumanMessage, convert_to_messages
from langchain_core.documents import Document

load_dotenv(override=True)

MODEL = "openai/gpt-4.1-nano"
DB_NAME = str(Path(__file__).parent / "vector_db")
RETRIEVAL_K = 4

SYSTEM_PROMPT = """
You are a friendly assistant that answers questions using the given context.
Use the context to answer. If the answer is not in the context, say you don't know.
Context:
{context}
"""

openrouter_api_key = os.getenv("OPENROUTER_API_KEY")

# The same embedding model used during ingestion must be used here
embeddings = OpenAIEmbeddings(
    model="text-embedding-3-large",
    api_key=openrouter_api_key,
    base_url="https://openrouter.ai/api/v1",
)

llm = ChatOpenAI(
    temperature=0,
    model_name=MODEL,
    api_key=openrouter_api_key,
    base_url="https://openrouter.ai/api/v1",
)


def fetch_context(question: str, collection_name: str) -> list[Document]:
    """
    Embed the question and run a similarity search in the user's collection.
    """
    vectorstore = Chroma(
        collection_name=collection_name,
        persist_directory=DB_NAME,
        embedding_function=embeddings,
    )
    return vectorstore.similarity_search(question, k=RETRIEVAL_K)


def combined_question(question: str, history: list[dict]) -> str:
    """
    Combine the user's earlier messages with the new question,
    so follow-up questions still retrieve good context.
    """
    prior = "\n".join(m["content"] for m in history if m["role"] == "user")
    return prior + "\n" + question


def answer_question(
    question: str, history: list[dict], collection_name: str
) -> tuple[str, list[Document]]:
    """
    Answer the question with RAG; return the answer and the context documents.
    """
    docs = fetch_context(combined_question(question, history), collection_name)
    context = "\n\n".join(doc.page_content for doc in docs)

    messages = [SystemMessage(content=SYSTEM_PROMPT.format(context=context))]
    messages.extend(convert_to_messages(history))
    messages.append(HumanMessage(content=question))

    response = llm.invoke(messages)
    return response.content, docs