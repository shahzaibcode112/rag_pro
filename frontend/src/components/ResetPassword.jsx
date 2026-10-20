import { useState } from "react";
import { getClient } from "../auth";
import Brand from "./Brand.jsx";

// Shown after the user clicks the link in the "reset password" email
export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: updateError } = await getClient().auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    // Remove the recovery info from the address bar, then continue to the app
    window.history.replaceState(null, "", window.location.pathname);
    onDone();
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Brand />
        <h1>Choose a new password</h1>
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="new-password">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
          <label className="field-label" htmlFor="confirm-password">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button className="btn primary wide" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save new password"}
          </button>
        </form>
        {error && (
          <p className="status error" role="status">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
