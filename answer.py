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
You are a friendly assistant representing the company Brewly Coffee.
You are chatting with a user about Brewly Coffee.
Use the given context to answer the question.
If you don't know the answer from the context, say so.
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

vectorstore = Chroma(persist_directory=DB_NAME, embedding_function=embeddings)
# search_kwargs sets how many chunks are returned for each search
retriever = vectorstore.as_retriever(search_kwargs={"k": RETRIEVAL_K})

llm = ChatOpenAI(
    temperature=0,
    model_name=MODEL,
    api_key=openrouter_api_key,
    base_url="https://openrouter.ai/api/v1",
)


def fetch_context(question: str) -> list[Document]:
    """
    Embed the question and run a similarity search against the vector store.
    """
    return retriever.invoke(question)


def combined_question(question: str, history: list[dict]) -> str:
    """
    Combine the user's earlier messages with the new question,
    so follow-up questions like "how much is it?" still retrieve good context.
    """
    prior = "\n".join(m["content"] for m in history if m["role"] == "user")
    return prior + "\n" + question


def answer_question(question: str, history: list[dict] = []) -> tuple[str, list[Document]]:
    """
    Answer the question with RAG; return the answer and the context documents.
    """
    docs = fetch_context(combined_question(question, history))
    context = "\n\n".join(doc.page_content for doc in docs)

    messages = [SystemMessage(content=SYSTEM_PROMPT.format(context=context))]
    messages.extend(convert_to_messages(history))
    messages.append(HumanMessage(content=question))

    response = llm.invoke(messages)
    return response.content, docs


if __name__ == "__main__":
    # Quick test from the terminal
    answer, docs = answer_question("How much is the Sunrise Blend?")
    print(answer)
