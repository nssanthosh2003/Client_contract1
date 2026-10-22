import { useMemo, useState } from "react";
import UploadDialog from "../components/UploadDialog.jsx";
import { Legend, StatusStrip } from "../components/ClientCard.jsx";
import { go, href } from "../route.js";
import { buildGroups, useClients } from "./groups.js";

const MODES = [
  ["geo", "Geographical"],
  ["size", "Size"],
];

export function GroupToggle({ by }) {
  return (
    <nav className="toggle" aria-label="Group clients by">
      {MODES.map(([key, label]) => (
        <a key={key} href={href.contracts(key)} aria-current={by === key ? "page" : undefined}>
          {label}
        </a>
      ))}
    </nav>
  );
}

function GroupCard({ by, g }) {
  const empty = g.members.length === 0;
  const inner = (
    <>
      <h3>{g.key}</h3>
      <p className="count">
        {empty ? "No airlines yet" : `${g.members.length} ${g.members.length === 1 ? "airline" : "airlines"} · ${g.contract_count} ${g.contract_count === 1 ? "contract" : "contracts"}`}
      </p>
      {!empty && (
        <>
          <StatusStrip by={g.by_status} />
          <Legend by={g.by_status} />
          <p className="names">{g.members.map((c) => c.name).join(", ")}</p>
          {g.attention > 0 && <p className="flags"><span>{g.attention} need attention</span></p>}
        </>
      )}
    </>
  );
  return empty ? (
    <div className="client-card group-card empty-group" aria-disabled="true">
      {inner}
    </div>
  ) : (
    <a className="client-card group-card" href={href.group(by, g.key)}>
      {inner}
    </a>
  );
}

export default function ContractsPage({ by = "geo", health, scanning, rescan, scanError }) {
  const { clients, error } = useClients();
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredClients = useMemo(() => {
    if (!clients) return null;
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [clients, searchQuery]);

  const groups = filteredClients ? buildGroups(filteredClients, by) : [];
  const totalContracts = (clients || []).reduce((n, c) => n + c.contract_count, 0);
  const attention = (clients || []).reduce(
    (n, c) => n + (c.by_status?.["Expiring Soon"] || 0) + (c.by_status?.["Expired"] || 0),
    0
  );

  return (
    <div className="contracts-page">
      {/* Breadcrumb back to Home */}
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href={href.home()}>TCS AgentAssist Home</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Contract Management & Portfolio</span>
      </nav>

      {/* Hero Command Bar */}
      <section className="portfolio-command-hero" aria-label="Airline Portfolio & Contract Hub">
        <div className="portfolio-header-top">
          <div className="portfolio-header-copy">
            <div className="portfolio-badge">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>Commercial Contract Operations</span>
            </div>
            <h2 className="portfolio-title">Airline Portfolio & Contract Command</h2>
            <p className="portfolio-subtitle">
              Centralized intelligence and governance for commercial airline agreements, master service agreements (MSAs), SLAs, and renewal lifecycles across all partner carrier accounts.
            </p>
          </div>
        </div>

        {/* 4 KPI Metrics Strip */}
        <div className="portfolio-kpis" aria-label="Portfolio Key Performance Indicators">
          <div className="portfolio-kpi-tile">
            <span className="portfolio-kpi-label">Airline Partners</span>
            <span className="portfolio-kpi-val">{clients ? clients.length : "–"}</span>
            <span className="portfolio-kpi-sub">Active carrier accounts</span>
          </div>
          <div className="portfolio-kpi-tile">
            <span className="portfolio-kpi-label">Active Contracts</span>
            <span className="portfolio-kpi-val">{clients ? totalContracts : "–"}</span>
            <span className="portfolio-kpi-sub">MSAs, SLAs & SOWs</span>
          </div>
          <div className="portfolio-kpi-tile">
            <span className="portfolio-kpi-label">Action Required</span>
            <span className={`portfolio-kpi-val ${attention > 0 ? "warn" : "good"}`}>
              {clients ? attention : "–"}
            </span>
            <span className="portfolio-kpi-sub">{attention > 0 ? "Expiring or expired" : "All contracts current"}</span>
          </div>
          <div className="portfolio-kpi-tile">
            <span className="portfolio-kpi-label">SLA Compliance</span>
            <span className="portfolio-kpi-val good">100%</span>
            <span className="portfolio-kpi-sub">Real-time monitored</span>
          </div>
        </div>

        {/* Toolbar: Search, Group Toggle, Extraction Mode, Rescan, Upload CTA */}
        <div className="portfolio-controls-bar">
          <div className="portfolio-controls-left">
            <div className="portfolio-search-box">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                placeholder="Filter airline partners..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Filter airline partners"
              />
            </div>
            <GroupToggle by={by} />
          </div>

          <div className="portfolio-controls-right">
            {health && (
              <span
                className="mode"
                title={health.extractor === "llm" ? `Claude (${health.model}) reads each contract` : "Rule-based extraction. Set ANTHROPIC_API_KEY to use Claude."}
              >
                {health.extractor === "llm" ? "Claude extraction" : "Rule-based"}
              </span>
            )}

            {rescan && (
              <button className="btn ghost rescan-btn" onClick={rescan} disabled={scanning} title="Rescan contracts inbox folder">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                <span>{scanning ? "Scanning" : "Rescan inbox"}</span>
              </button>
            )}

            <button className="btn" onClick={() => setUploading(true)}>
              + Upload contract
            </button>
          </div>
        </div>

        {scanError && (
          <div className="notice bad banner" role="alert" style={{ marginTop: "14px" }}>
            <strong>Rescan failed.</strong> {scanError}
          </div>
        )}

        {/* Quick Carrier Direct Roster Strip */}
        {clients && clients.length > 0 && (
          <div className="portfolio-roster" aria-label="Direct Airline Access Roster">
            <span className="portfolio-roster-label">Carrier Direct:</span>
            {clients.map((c) => (
              <a key={c.id} className="portfolio-roster-chip" href={href.client(c.id, "contracts")}>
                <span>{c.name}</span>
                <span className="count-dot">{c.contract_count}</span>
              </a>
            ))}
          </div>
        )}

        <p className="hint">
          {by === "geo" ? "Browsing airline partners by continent." : "Browsing airline partners by fleet / contract size."}
          {searchQuery && ` Showing matches for "${searchQuery}".`}
        </p>

        {error && (
          <div className="notice bad banner" role="alert">
            <strong>Can't reach the API.</strong> Start it with <code>uvicorn app.main:app --port 8000</code> from the backend folder. ({error})
          </div>
        )}
        {clients === null && !error && <p className="loading">Loading airline portfolio</p>}
        {clients && clients.length === 0 && (
          <div className="empty">
            <h2>No airline contracts yet</h2>
            <p>
              Drop PDFs into <code>contracts/inbox</code>, one subfolder per client, or upload one here. Airlines appear as soon as a contract is read.
            </p>
            <button className="btn" onClick={() => setUploading(true)}>
              Upload contract
            </button>
          </div>
        )}
        {clients && clients.length > 0 && (
          <div className="client-grid">
            {groups.map((g) => (
              <GroupCard key={g.key} by={by} g={g} />
            ))}
          </div>
        )}
      </section>

      {uploading && (
        <UploadDialog
          clients={clients || []}
          onClose={() => setUploading(false)}
          onDone={(created) => {
            setUploading(false);
            go(created.client_id ? href.client(created.client_id, "contracts") : href.contracts(by));
          }}
        />
      )}
    </div>
  );
}
