import { useCallback, useEffect, useState } from "react";
import { getDocuments } from "./api";
import DataPanel from "./components/DataPanel.jsx";
import ChatPanel from "./components/ChatPanel.jsx";

const isMobile = () => window.matchMedia("(max-width: 820px)").matches;

export default function App() {
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
        <div className="brand">
          <svg className="logo" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M6 3h8l5 5v13H6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M14 3v5h5M9 13h7M9 17h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span>DocChat</span>
        </div>
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
