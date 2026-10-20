import { useRef, useState } from "react";
import { streamChat } from "../api";

const MAX_HISTORY = 10;

/**
 * Chat state: the list of messages, and a send() that streams the answer in.
 * message = { id, role, content, sources, streaming, error }
 */
export function useChat() {
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const nextId = useRef(0);

  const update = (id, change) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...change(m) } : m)));

  async function send(question) {
    // Earlier successful messages are sent along for context
    const history = messagesRef.current
      .filter((m) => !m.error && m.content)
      .map(({ role, content }) => ({ role, content }))
      .slice(-MAX_HISTORY);

    const assistantId = ++nextId.current;
    const userId = ++nextId.current;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: question },
      { id: assistantId, role: "assistant", content: "", sources: [], streaming: true },
    ]);
    setBusy(true);

    try {
      for await (const event of streamChat(question, history)) {
        if (event.type === "sources") {
          update(assistantId, () => ({ sources: event.sources }));
        } else if (event.type === "token") {
          update(assistantId, (m) => ({ content: m.content + event.text }));
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      }
    } catch (err) {
      const message = err.message || "Something went wrong.";
      update(assistantId, (m) => ({
        error: true,
        content: m.content ? `${m.content}\n\n${message}` : message,
      }));
    } finally {
      update(assistantId, () => ({ streaming: false }));
      setBusy(false);
    }
  }

  const reset = () => setMessages([]);

  return { messages, busy, send, reset };
}
