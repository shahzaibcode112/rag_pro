import gradio as gr
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
    demo.launch()


if __name__ == "__main__":
    main()
