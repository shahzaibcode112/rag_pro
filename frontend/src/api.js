// All communication with the FastAPI backend lives in this file.

async function request(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Request failed.");
  }
  return res.json();
}

export const getDocuments = () => request("/api/documents");

export function uploadItems(text, files) {
  const form = new FormData();
  form.append("text", text);
  files.forEach((file) => form.append("files", file));
  return request("/api/upload", { method: "POST", body: form });
}

export const deleteDocument = (id) => request(`/api/documents/${id}`, { method: "DELETE" });

export const deleteAllData = () => request("/api/data", { method: "DELETE" });

/**
 * Ask a question and receive the answer as a stream of events:
 *   {type: "sources", sources: [...]}, {type: "token", text}, {type: "error", message}, {type: "done"}
 */
export async function* streamChat(question, history) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history }),
  });
  if (!res.ok || !res.body) {
    throw new Error("The server returned an error. Please try again.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Events are separated by a blank line; a chunk may contain part of one
    let sep;
    while ((sep = buffer.indexOf("\n\n")) >= 0) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      if (raw.startsWith("data: ")) yield JSON.parse(raw.slice(6));
    }
  }
}
