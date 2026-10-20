import { useEffect, useState } from "react";
import { initAuth } from "./auth";
import AuthScreen from "./components/AuthScreen.jsx";
import ResetPassword from "./components/ResetPassword.jsx";
import Workspace from "./Workspace.jsx";

export default function App() {
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);
  // True when the user arrived from a "reset password" email link
  const [recovery, setRecovery] = useState(() => window.location.hash.includes("type=recovery"));

  useEffect(() => {
    let subscription;
    let cancelled = false;

    (async () => {
      try {
        const client = await initAuth();
        if (cancelled) return;

        // Runs whenever the user signs in, signs out, or the token refreshes
        const { data } = client.auth.onAuthStateChange((event, newSession) => {
          setSession(newSession);
          if (event === "PASSWORD_RECOVERY") setRecovery(true);
        });
        subscription = data.subscription;

        const { data: current } = await client.auth.getSession();
        if (cancelled) return;
        setSession(current.session);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Could not start the app.");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  if (status === "loading") return <div className="splash">Loading…</div>;
  if (status === "error") return <div className="splash error">{error}</div>;
  if (session && recovery) return <ResetPassword onDone={() => setRecovery(false)} />;
  if (!session) return <AuthScreen />;
  return <Workspace user={session.user} />;
}
