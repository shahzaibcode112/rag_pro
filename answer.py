import os

import numpy as np
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, convert_to_messages
from langchain_core.documents import Document

# Reuse the same embedding model as ingestion, so vectors always match
from ingest import get_connection, embeddings

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

llm = ChatOpenAI(
    temperature=0,
    model_name=MODEL,
    api_key=openrouter_api_key,
    base_url="https://openrouter.ai/api/v1",
)


def fetch_context(question: str, owner_id: str) -> list[Document]:
    """
    Embed the question and find the most similar chunks belonging to this owner.
    Each returned Document carries the filename it came from.
    """
    query_vector = np.array(embeddings.embed_query(question))
    with get_connection() as conn:
        rows = conn.execute(
            """
            select c.content, d.filename
            from chunks c
            join documents d on d.id = c.document_id
            where c.owner_id = %s
            order by c.embedding <=> %s
            limit %s
            """,
            (owner_id, query_vector, RETRIEVAL_K),
        ).fetchall()
    return [Document(page_content=r[0], metadata={"filename": r[1]}) for r in rows]


def combined_question(question: str, history: list[dict]) -> str:
    """
    Combine the user's earlier messages with the new question,
    so follow-up questions still retrieve good context.
    """
    prior = "\n".join(m["content"] for m in history if m["role"] == "user")
    return prior + "\n" + question


def build_messages(question: str, history: list[dict], docs: list[Document]) -> list:
    """
    Build the prompt: system message with context, past messages, new question.
    """
    context = "\n\n".join(doc.page_content for doc in docs)
    messages = [SystemMessage(content=SYSTEM_PROMPT.format(context=context))]
    messages.extend(convert_to_messages(history))
    messages.append(HumanMessage(content=question))
    return messages


def answer_question(question: str, history: list[dict], owner_id: str) -> tuple[str, list[Document]]:
    """
    Answer the question with RAG in one go; return the answer and the context documents.
    """
    docs = fetch_context(combined_question(question, history), owner_id)
    response = llm.invoke(build_messages(question, history, docs))
    return response.content, docs


def stream_answer(question: str, history: list[dict], owner_id: str):
    """
    Answer the question with RAG, yielding events as they happen:
      {"type": "sources", "sources": [...]}   once, before the answer
      {"type": "token", "text": "..."}        for each piece of the answer
      {"type": "done"}                         at the end
    """
    docs = fetch_context(combined_question(question, history), owner_id)
    yield {
        "type": "sources",
        "sources": [
            {"filename": d.metadata.get("filename", ""), "text": d.page_content} for d in docs
        ],
    }
    for chunk in llm.stream(build_messages(question, history, docs)):
        if chunk.content:
            yield {"type": "token", "text": chunk.content}
    yield {"type": "done"}
