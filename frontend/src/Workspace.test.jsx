import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("./auth", () => ({
  getAccessToken: async () => "tok-123",
  getClient: () => ({ auth: { signOut } }),
}));

import Workspace from "./Workspace.jsx";

// A tiny fake backend, so the page can be tested without the server
let docs;
let unauthorized;
function sseResponse(events) {
  // Split the stream at awkward places on purpose, to test buffering
  const text = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  const encoder = new TextEncoder();
  const parts = [text.slice(0, 25), text.slice(25, 90), text.slice(90)];
  const stream = new ReadableStream({
    start(controller) {
      parts.forEach((p) => controller.enqueue(encoder.encode(p)));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

beforeEach(() => {
  docs = [];
  unauthorized = false;
  signOut.mockClear();
  global.fetch = vi.fn(async (url, options = {}) => {
    const method = options.method || "GET";
    if (unauthorized) return Response.json({ detail: "expired" }, { status: 401 });
    if (url === "/api/documents" && method === "GET") return Response.json({ documents: docs });
    if (url === "/api/upload") {
      docs = [{ id: 1, filename: "pasted text", created_at: "2026-01-01", chunks: 2 }];
      return Response.json({ results: [{ name: "pasted text", ok: true, chunks: 2 }] });
    }
    if (url === "/api/chat") {
      return sseResponse([
        { type: "sources", sources: [{ filename: "pasted text", text: "Beans cost $14." }] },
        { type: "token", text: "The beans " },
        { type: "token", text: "cost $14." },
        { type: "done" },
      ]);
    }
    if (url.startsWith("/api/documents/") && method === "DELETE") {
      docs = [];
      return Response.json({ ok: true });
    }
    throw new Error("unexpected request " + url);
  });
});

afterEach(cleanup);

const user = { email: "me@example.com" };

describe("Workspace", () => {
  it("shows the user's email, starts empty, and has chat disabled", async () => {
    render(<Workspace user={user} />);
    expect(screen.getByText("me@example.com")).toBeTruthy();
    expect(await screen.findByText(/Nothing here yet/)).toBeTruthy();
    expect(screen.getByPlaceholderText("Add data first…").disabled).toBe(true);
  });

  it("signs out when the button is clicked", async () => {
    render(<Workspace user={user} />);
    fireEvent.click(screen.getByText("Sign out"));
    expect(signOut).toHaveBeenCalled();
  });

  it("signs out if the server says the login expired", async () => {
    unauthorized = true;
    render(<Workspace user={user} />);
    fireEvent.change(screen.getByLabelText("Or paste text"), { target: { value: "hello" } });
    fireEvent.click(screen.getByText("Add to knowledge base"));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });

  it("adds text, streams an answer with sources, and deletes the document", async () => {
    render(<Workspace user={user} />);
    await screen.findByText(/Nothing here yet/);

    fireEvent.change(screen.getByLabelText("Or paste text"), { target: { value: "Beans cost $14." } });
    fireEvent.click(screen.getByText("Add to knowledge base"));
    await screen.findByText(/Added 1 item/);
    expect(await screen.findByLabelText("Delete pasted text")).toBeTruthy();

    const box = await screen.findByPlaceholderText("Ask a question about your documents…");
    await waitFor(() => expect(box.disabled).toBe(false));
    fireEvent.change(box, { target: { value: "How much are the beans?" } });
    fireEvent.keyDown(box, { key: "Enter" });

    expect(await screen.findByText("The beans cost $14.")).toBeTruthy();
    expect(screen.getByText("How much are the beans?")).toBeTruthy();
    expect(screen.getByText("Sources (1)")).toBeTruthy();

    // earlier messages are sent as history with the next question
    await waitFor(() => expect(box.disabled).toBe(false));
    fireEvent.change(box, { target: { value: "And the tea?" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => {
      const chatCalls = global.fetch.mock.calls.filter((c) => c[0] === "/api/chat");
      expect(chatCalls.length).toBe(2);
      const body = JSON.parse(chatCalls[1][1].body);
      expect(body.history.map((m) => m.role)).toEqual(["user", "assistant"]);
    });

    // every request carried the login token
    expect(global.fetch.mock.calls.every((c) => c[1]?.headers?.Authorization === "Bearer tok-123")).toBe(true);

    fireEvent.click(screen.getByLabelText("Delete pasted text"));
    expect(await screen.findByText(/Nothing here yet/)).toBeTruthy();
  });
});
