import os
from pathlib import Path

import gradio as gr

# Render's disk is wiped on every deploy/restart, so build the vector DB on startup if it's missing
if not (Path(__file__).parent / "vector_db").exists():
    import ingest

    ingest.create_embeddings(ingest.create_chunks(ingest.fetch_documents()))

from answer import answer_question


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


def chat(message, history):
    """
    Called by Gradio on every user message.
    """
    question = extract_text(message)
    clean_history = [
        {"role": m["role"], "content": extract_text(m["content"])} for m in history
    ]
    answer, _docs = answer_question(question, clean_history)
    return answer


def main():
    demo = gr.ChatInterface(
        fn=chat,
        title="Brewly Coffee Assistant",
        description="Ask me anything about Brewly Coffee: products, shipping, subscriptions, and more.",
        examples=[
            "What coffees do you sell?",
            "How does shipping work?",
            "Can I cancel my subscription?",
        ],
    )
    # Render provides the port via the PORT environment variable
    demo.launch(server_name="0.0.0.0", server_port=int(os.environ.get("PORT", 7860)))


if __name__ == "__main__":
    main()