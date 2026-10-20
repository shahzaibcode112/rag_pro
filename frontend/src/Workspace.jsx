import { useCallback, useEffect, useState } from "react";
import { getDocuments } from "./api";
import { getClient } from "./auth";
import Brand from "./components/Brand.jsx";
import DataPanel from "./components/DataPanel.jsx";
import ChatPanel from "./components/ChatPanel.jsx";

const isMobile = () => window.matchMedia("(max-width: 820px)").matches;

export default function Workspace({ user }) {
  const [view, setView] = useState("data"); // which panel shows on mobile
  const [documents, setDocuments] = useState([]);

  const refreshDocuments = useCallback(async () => {
    try {
      const data = await getDocuments();
      setDocuments(data.documents);
    } catch {
      // keep the current list if the request fails
    }
  }, []);

  useEffect(() => {
    refreshDocuments();
  }, [refreshDocuments]);

  return (
    <>
      <header className="topbar">
        <Brand />
        <nav className="tabs" aria-label="Sections">
          {[
            ["data", "Documents"],
            ["chat", "Chat"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={"tab" + (view === key ? " active" : "")}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="user">
          <span className="user-email" title={user.email}>
            {user.email}
          </span>
          <button className="btn small" type="button" onClick={() => getClient().auth.signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <main className="layout" data-view={view}>
        <DataPanel
          documents={documents}
          onChanged={refreshDocuments}
          onAdded={() => isMobile() && setView("chat")}
        />
        <ChatPanel hasDocs={documents.length > 0} />
      </main>
    </>
  );
}
