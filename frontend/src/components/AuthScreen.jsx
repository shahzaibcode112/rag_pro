import { useState } from "react";
import { getClient } from "../auth";
import Brand from "./Brand.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

// Turn Supabase's technical messages into friendlier ones
function friendly(message = "") {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Wrong email or password.";
  if (m.includes("email not confirmed")) return "Please confirm your email first. Check your inbox for the link.";
  if (m.includes("rate limit")) return "Too many emails were sent. Please wait a while and try again.";
  if (m.includes("already registered")) return "An account with this email already exists. Try signing in.";
  if (m.includes("password") && m.includes("characters")) return message;
  return message || "Something went wrong. Please try again.";
}

const TITLES = {
  signin: "Welcome back",
  signup: "Create your account",
  forgot: "Reset your password",
};

export default function AuthScreen() {
  const [mode, setMode] = useState("signin"); // signin | signup | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { kind: "ok" | "error", text }

  function switchMode(next) {
    setMode(next);
    setMessage(null);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const auth = getClient().auth;

    try {
      if (mode === "signin") {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error) throw error;
        // On success the app notices the new session and shows the workspace
      } else if (mode === "signup") {
        const { data, error } = await auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage({
            kind: "ok",
            text: "Account created. Check your email for a confirmation link, then sign in.",
          });
        }
      } else {
        const { error } = await auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setMessage({ kind: "ok", text: "If an account exists for that email, a reset link is on its way." });
      }
    } catch (err) {
      setMessage({ kind: "error", text: friendly(err.message) });
    } finally {
      setBusy(false);
    }
  }

  const submitLabel = { signin: "Sign in", signup: "Create account", forgot: "Send reset link" }[mode];

  return (
    <div className="auth-page">
      <ThemeToggle className="auth-theme" />
      <div className="auth-card">
        <Brand />
        <h1>{TITLES[mode]}</h1>
        <p className="auth-sub">
          {mode === "forgot"
            ? "Enter your email and we'll send you a link to choose a new password."
            : "Sign in to upload documents and chat with them."}
        </p>

        <form onSubmit={submit} noValidate={false}>
          <label className="field-label" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />

          {mode !== "forgot" && (
            <>
              <label className="field-label" htmlFor="auth-password">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={mode === "signup" ? 8 : undefined}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
              />
            </>
          )}

          <button className="btn primary wide" type="submit" disabled={busy}>
            {busy ? "Please wait…" : submitLabel}
          </button>
        </form>

        {message && (
          <p className={"status " + message.kind} role="status">
            {message.text}
          </p>
        )}

        <div className="auth-links">
          {mode === "signin" && (
            <>
              <button type="button" className="link-btn" onClick={() => switchMode("forgot")}>
                Forgot password?
              </button>
              <button type="button" className="link-btn" onClick={() => switchMode("signup")}>
                Create an account
              </button>
            </>
          )}
          {mode === "signup" && (
            <button type="button" className="link-btn" onClick={() => switchMode("signin")}>
              I already have an account
            </button>
          )}
          {mode === "forgot" && (
            <button type="button" className="link-btn" onClick={() => switchMode("signin")}>
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
