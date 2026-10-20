import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));
vi.mock("../auth", () => ({ getClient: () => ({ auth }) }));

import AuthScreen from "./AuthScreen.jsx";

beforeEach(() => Object.values(auth).forEach((fn) => fn.mockReset()));
afterEach(cleanup);

function fill(email, password) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  if (password !== undefined) fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
}

describe("AuthScreen", () => {
  it("signs in with email and password", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    render(<AuthScreen />);
    fill("me@example.com", "secret123");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "me@example.com", password: "secret123" })
    );
  });

  it("shows a friendly message for wrong credentials", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<AuthScreen />);
    fill("me@example.com", "nope");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Wrong email or password.")).toBeTruthy();
  });

  it("creates an account and asks the user to confirm their email", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(<AuthScreen />);
    fireEvent.click(screen.getByText("Create an account"));
    fill("new@example.com", "longenough1");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/Check your email for a confirmation link/)).toBeTruthy();
    expect(auth.signUp.mock.calls[0][0].email).toBe("new@example.com");
  });

  it("sends a password reset email", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<AuthScreen />);
    fireEvent.click(screen.getByText("Forgot password?"));
    fill("me@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText(/reset link is on its way/)).toBeTruthy();
    expect(auth.resetPasswordForEmail.mock.calls[0][0]).toBe("me@example.com");
  });
});
