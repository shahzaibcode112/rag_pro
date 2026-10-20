export default function Message({ message }) {
  const { role, content, sources, streaming, error } = message;
  const className = ["msg", role, streaming && "streaming", error && "error"].filter(Boolean).join(" ");

  return (
    <div className={className}>
      <div className="bubble">{content}</div>
      {sources && sources.length > 0 && (
        <details className="sources">
          <summary>Sources ({sources.length})</summary>
          {sources.map((s, i) => (
            <div className="source" key={i}>
              <b>{s.filename}</b>
              <p>{s.text}</p>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
