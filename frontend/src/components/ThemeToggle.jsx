import { useEffect, useState } from "react";

const STORAGE_KEY = "docchat-theme";
const ORDER = ["light", "dark", "system"]; // click cycles through these
const LABELS = { light: "Light", dark: "Dark", system: "System" };

function readSaved() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return ORDER.includes(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

const ICONS = {
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  dark: <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />,
  system: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
};

// A button that switches the app between Light, Dark and System (follows the device).
export default function ThemeToggle({ className = "" }) {
  const [theme, setTheme] = useState(readSaved);

  // Apply the choice to the page, and remember it
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // storage can be blocked (private mode); the toggle still works for this visit
    }
  }, [theme]);

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];

  return (
    <button
      type="button"
      className={"icon-toggle " + className}
      onClick={() => setTheme(next)}
      title={`Theme: ${LABELS[theme]} (click for ${LABELS[next]})`}
      aria-label={`Theme: ${LABELS[theme]}. Switch to ${LABELS[next]}`}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICONS[theme]}
      </svg>
    </button>
  );
}
