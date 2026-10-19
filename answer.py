import os

import numpy as np
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.messages import SystemMessage, HumanMessage, convert_to_messages
from langchain_core.documents import Document

from ingest import get_connection

load_dotenv(override=True)

MODEL = "openai/gpt-4.1-nano"
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
    model="text-embedding-3-small",
    api_key=openrouter_api_key,
    base_url="https://openrouter.ai/api/v1",
)

llm = ChatOpenAI(
    temperature=0,
    model_name=MODEL,
    api_key=openrouter_api_key,
    base_url="https://openrouter.ai/api/v1",
)


def fetch_context(question: str, owner_id: str) -> list[Document]:
    """
    Embed the question and find the most similar chunks belonging to this owner.
    """
    query_vector = np.array(embeddings.embed_query(question))
    with get_connection() as conn:
        rows = conn.execute(
            """
            select content from chunks
            where owner_id = %s
            order by embedding <=> %s
            limit %s
            """,
            (owner_id, query_vector, RETRIEVAL_K),
        ).fetchall()
    return [Document(page_content=row[0]) for row in rows]


def combined_question(question: str, history: list[dict]) -> str:
    """
    Combine the user's earlier messages with the new question,
    so follow-up questions still retrieve good context.
    """
    prior = "\n".join(m["content"] for m in history if m["role"] == "user")
    return prior + "\n" + question


def answer_question(
    question: str, history: list[dict], owner_id: str
) -> tuple[str, list[Document]]:
    """
    Answer the question with RAG; return the answer and the context documents.
    """
    docs = fetch_context(combined_question(question, history), owner_id)
    context = "\n\n".join(doc.page_content for doc in docs)

    messages = [SystemMessage(content=SYSTEM_PROMPT.format(context=context))]
    messages.extend(convert_to_messages(history))
    messages.append(HumanMessage(content=question))

    response = llm.invoke(messages)
    return response.content, docs