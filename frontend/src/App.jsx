import { useEffect, useState } from "react";
import { api } from "./api.js";
import ChatWidget from "./components/ChatWidget.jsx";
import ClientPage from "./pages/ClientPage.jsx";
import ContractsPage from "./pages/ContractsPage.jsx";
import GroupPage from "./pages/GroupPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import { APP_INFO } from "./projectInfo.js";
import { href, useRoute } from "./route.js";

export default function App() {
  const route = useRoute();
  const [health, setHealth] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");

  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("tcs-portal-theme");
      if (saved === "dark" || saved === "light") return saved;
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("tcs-portal-theme", theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
  }, []);

  const rescan = async () => {
    setScanning(true);
    setScanError("");
    try {
      await api.scan();
    } catch (e) {
      setScanError(e.message);
    } finally {
      setScanning(false);
    }
  };

  const isHomeActive = route.page === "home" || !route.page;

  return (
    <div className="shell">
      <header className="top">
        <a className="brand" href={href.home()} aria-label={`${APP_INFO.name}, home page`}>
          <span className="brand-logo-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </span>
          <span className="brand-copy">
            <span className="brand-name">{APP_INFO.name}</span>
            <span className="brand-desc">{APP_INFO.subtitle}</span>
          </span>
        </a>

        <div className="top-actions">
          {/* Single Workspace Navigation Button */}
          {isHomeActive ? (
            <a href={href.contracts()} className="btn ghost header-nav-btn" title="Navigate to Contract Management">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>Contract Management</span>
            </a>
          ) : (
            <a href={href.home()} className="btn ghost header-nav-btn" title="Return to Service Center UI">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>Service Center UI</span>
            </a>
          )}

          {/* Dark / Light Theme Toggle */}
          <button
            className="btn ghost theme-toggle-btn"
            onClick={toggleTheme}
            type="button"
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {theme === "light" ? (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                <span>Dark</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                <span>Light</span>
              </>
            )}
          </button>
        </div>
      </header>

      <main>
        {route.page === "client" && <ClientPage clientId={route.clientId} tab={route.tab} />}
        {route.page === "group" && <GroupPage by={route.by} group={route.group} />}
        {route.page === "contracts" && (
          <ContractsPage
            by={route.by}
            health={health}
            scanning={scanning}
            rescan={rescan}
            scanError={scanError}
          />
        )}
        {(route.page === "home" || !route.page) && <LandingPage />}
      </main>

      {route.page !== "client" && <ChatWidget scope="global" />}
    </div>
  );
}
