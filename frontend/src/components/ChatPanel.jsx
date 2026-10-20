import { useEffect, useRef, useState } from "react";
import { useChat } from "../hooks/useChat";
import Message from "./Message.jsx";

export default function ChatPanel({ hasDocs }) {
  const { messages, busy, send, reset } = useChat();
  const [question, setQuestion] = useState("");
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const stickToBottom = useRef(true); // only auto-scroll if the user hasn't scrolled up
  const wasBusy = useRef(false);

  const disabled = !hasDocs || busy;

  // Keep the newest text in view while the answer streams in
  useEffect(() => {
    const list = listRef.current;
    if (list && stickToBottom.current) list.scrollTop = list.scrollHeight;
  }, [messages]);

  // Grow the input box as the user types (up to a limit)
  useEffect(() => {
    const box = inputRef.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = Math.min(box.scrollHeight, 160) + "px";
  }, [question]);

  // Put the cursor back in the box when an answer finishes
  useEffect(() => {
    if (wasBusy.current && !busy) inputRef.current?.focus();
    wasBusy.current = busy;
  }, [busy]);

  function handleScroll() {
    const list = listRef.current;
    stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  }

  function submit(e) {
    e.preventDefault();
    const q = question.trim();
    if (!q || disabled) return;
    setQuestion("");
    stickToBottom.current = true;
    send(q);
  }

  // Enter sends, Shift+Enter makes a new line
  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
  }

  return (
    <section className="panel chat-panel" aria-labelledby="chat-title">
      <div className="chat-header">
        <h2 id="chat-title">Chat</h2>
        <button className="link-btn" type="button" onClick={reset} disabled={busy || messages.length === 0}>
          New chat
        </button>
      </div>

      <div className="messages" ref={listRef} onScroll={handleScroll} aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <h3>Ask your documents anything</h3>
            <p>
              {hasDocs
                ? "Your documents are ready. Type a question below."
                : "Add some data first, then ask a question here."}
            </p>
          </div>
        )}
        {messages.map((m) => (
          <Message key={m.id} message={m} />
        ))}
      </div>

      <form className="composer" onSubmit={submit} autoComplete="off">
        <textarea
          ref={inputRef}
          rows={1}
          value={question}
          disabled={disabled}
          placeholder={hasDocs ? "Ask a question about your documents…" : "Add data first…"}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="btn primary send" type="submit" disabled={disabled} aria-label="Send">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M4 12l16-8-6 16-2-6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </section>
  );
}
