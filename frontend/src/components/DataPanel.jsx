import { useRef, useState } from "react";
import { deleteAllData, deleteDocument, uploadItems } from "../api";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED = [".pdf", ".txt", ".md"];
const NO_STATUS = { message: "", kind: "", errors: [] };

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DataPanel({ documents, onChanged, onAdded }) {
  const [pendingFiles, setPendingFiles] = useState([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState(NO_STATUS);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  // ----- choosing files (browse or drag & drop) -----
  function addFiles(fileList) {
    const accepted = [];
    const problems = [];
    for (const file of Array.from(fileList)) {
      const ext = "." + file.name.split(".").pop().toLowerCase();
      if (!ALLOWED.includes(ext)) problems.push(`${file.name}: unsupported type`);
      else if (file.size > MAX_FILE_BYTES) problems.push(`${file.name}: larger than 10 MB`);
      else accepted.push(file);
    }
    setPendingFiles((prev) => {
      const next = [...prev];
      accepted.forEach((f) => {
        if (!next.some((p) => p.name === f.name && p.size === f.size)) next.push(f);
      });
      return next;
    });
    setStatus(
      problems.length ? { message: "Some files were skipped:", kind: "error", errors: problems } : NO_STATUS
    );
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function onDragOver(e) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave(e) {
    e.preventDefault();
    setDragging(false);
  }

  // ----- uploading -----
  async function handleAdd() {
    if (!text.trim() && pendingFiles.length === 0) {
      setStatus({ message: "Add a file or paste some text first.", kind: "error", errors: [] });
      return;
    }

    setUploading(true);
    setStatus(NO_STATUS);
    try {
      const { results } = await uploadItems(text, pendingFiles);
      const ok = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok);

      // Keep only what failed, so the user can retry it
      const failedNames = new Set(failed.map((r) => r.name));
      setPendingFiles((prev) => prev.filter((f) => failedNames.has(f.name)));
      if (!failedNames.has("pasted text")) setText("");

      if (failed.length) {
        setStatus({
          message: ok.length ? `Added ${ok.length}, but ${failed.length} failed:` : "Nothing was added:",
          kind: "error",
          errors: failed.map((r) => `${r.name}: ${r.error}`),
        });
      } else {
        setStatus({
          message: `Added ${ok.length} item${ok.length > 1 ? "s" : ""}. You can now ask questions.`,
          kind: "ok",
          errors: [],
        });
      }

      await onChanged();
      if (ok.length) onAdded();
    } catch (err) {
      setStatus({ message: err.message || "Upload failed.", kind: "error", errors: [] });
    } finally {
      setUploading(false);
    }
  }

  // ----- deleting -----
  async function handleDelete(doc) {
    if (!window.confirm(`Delete "${doc.filename}"?`)) return;
    await deleteDocument(doc.id);
    await onChanged();
  }

  async function handleClearAll() {
    if (!window.confirm("Delete all your documents? This cannot be undone.")) return;
    await deleteAllData();
    await onChanged();
    setStatus({ message: "All data cleared.", kind: "ok", errors: [] });
  }

  return (
    <section className="panel data-panel" aria-labelledby="data-title">
      <h2 id="data-title">Your documents</h2>

      <label
        className={"dropzone" + (dragging ? " dragover" : "")}
        onDragEnter={onDragOver}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
          <path
            d="M12 16V4m0 0L7 9m5-5l5 5M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <strong>Drop files here or tap to browse</strong>
        <span className="hint">PDF, TXT or MD · up to 10 MB each</span>
      </label>

      <ul className="pending" aria-label="Files ready to add">
        {pendingFiles.map((file, i) => (
          <li key={file.name + file.size}>
            <div className="file-info">
              <span className="file-name">{file.name}</span>
              <span className="file-meta">{formatSize(file.size)}</span>
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove ${file.name}`}
              onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <label className="field-label" htmlFor="paste">
        Or paste text
      </label>
      <textarea
        id="paste"
        rows={5}
        placeholder="Paste any text you want to ask questions about…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <button className="btn primary" type="button" onClick={handleAdd} disabled={uploading}>
        {uploading ? "Adding… this can take a moment" : "Add to knowledge base"}
      </button>

      <div className={"status " + status.kind} role="status" aria-live="polite">
        {status.message}
        {status.errors.length > 0 && (
          <ul>
            {status.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="docs-header">
        <h3>
          Uploaded <span className="count">{documents.length}</span>
        </h3>
        {documents.length > 0 && (
          <button className="link-btn danger" type="button" onClick={handleClearAll}>
            Clear all
          </button>
        )}
      </div>

      <ul className="docs">
        {documents.map((doc) => (
          <li key={doc.id}>
            <div className="file-info">
              <span className="file-name">{doc.filename}</span>
              <span className="file-meta">{doc.chunks} chunks</span>
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Delete ${doc.filename}`}
              onClick={() => handleDelete(doc)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {documents.length === 0 && (
        <p className="empty">Nothing here yet. Add a file or some text to get started.</p>
      )}
    </section>
  );
}
