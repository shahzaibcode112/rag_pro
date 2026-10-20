import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const h = vi.hoisted(() => {
  const state = { session: null, listener: null };
  const client = {
    auth: {
      onAuthStateChange: (cb) => {
        state.listener = cb;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      getSession: async () => ({ data: { session: state.session } }),
      signOut: async () => state.listener?.("SIGNED_OUT", null),
      updateUser: async () => ({ error: null }),
    },
  };
  return { state, client };
});
vi.mock("./auth", () => ({
  initAuth: async () => h.client,
  getClient: () => h.client,
  getAccessToken: async () => "tok",
}));

import App from "./App.jsx";

beforeEach(() => {
  h.state.session = null;
  window.location.hash = "";
  global.fetch = vi.fn(async () => Response.json({ documents: [] }));
});
afterEach(cleanup);

const session = { user: { email: "me@example.com" } };

describe("App login gate", () => {
  it("shows the sign-in screen when logged out", async () => {
    render(<App />);
    expect(await screen.findByText("Welcome back")).toBeTruthy();
    expect(screen.queryByText("Your documents")).toBeNull();
  });

  it("shows the workspace when logged in, and returns to sign-in after signing out", async () => {
    h.state.session = session;
    render(<App />);
    expect(await screen.findByText("Your documents")).toBeTruthy();
    expect(screen.getByText("me@example.com")).toBeTruthy();

    fireEvent.click(screen.getByText("Sign out"));
    expect(await screen.findByText("Welcome back")).toBeTruthy();
  });

  it("shows the new-password form when arriving from a reset email", async () => {
    window.location.hash = "#access_token=abc&type=recovery";
    h.state.session = session;
    render(<App />);
    expect(await screen.findByText("Choose a new password")).toBeTruthy();
  });
});
