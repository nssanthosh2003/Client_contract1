import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { fmtDate } from "../util.js";

const SEVERITIES = ["Critical", "Major", "Minor"];
const isOpen = (p) => p.status !== "Resolved" && p.status !== "Closed";

const COMPONENT_IMPACTS = {
  "Departure Control": "Directly halts boarding pass validation at gate readers and aircraft dispatch operations.",
  "Reservations": "Causes booking transaction discrepancies, fare cache staleness, or duplicate e-ticket issuance in Amadeus.",
  "Check-in": "Disrupts self-service kiosk workflows, online passenger check-in, and baggage drop prompts.",
  "Ancillaries": "Blocks cross-selling upsells, seat upgrades, and baggage payment processing.",
  "Notifications": "Delays passenger disruption SMS alerts and schedule adjustment communications.",
  "Loyalty": "Prevents frequent flyer tier updates and partner codeshare mileage accreditation.",
  "Baggage": "Halts baggage tag printing and interline passenger transfer routing.",
  "Crew": "Disrupts overnight crew roster pairing exports and operational shifts.",
};

const isBlocker = (p) =>
  isOpen(p) && (p.severity === "Critical" || (p.severity === "Major" && p.age_days >= 14));

function Kpis({ s }) {
  const items = [
    ["Open PTRs", s.open, ""],
    ["Critical open", s.critical_open, s.critical_open ? "bad" : ""],
    ["Average age of open", `${s.avg_open_age_days} days`, ""],
    ["Resolved in 30 days", s.resolved_30d, ""],
  ];
  return (
    <dl className="kpis">
      {items.map(([label, value, tone]) => (
        <div className="kpi" key={label}>
          <dt>{label}</dt>
          <dd className={tone}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function PtrTab({ clientId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [sev, setSev] = useState("");
  const [status, setStatus] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [selectedBlockerId, setSelectedBlockerId] = useState(null);

  useEffect(() => {
    let live = true;
    api
      .ptrs(clientId)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [clientId]);

  // Main Blocker PTRs
  const mainBlockers = useMemo(() => {
    if (!data?.ptrs) return [];
    return data.ptrs
      .filter(isBlocker)
      .sort((a, b) => {
        if (a.severity === "Critical" && b.severity !== "Critical") return -1;
        if (b.severity === "Critical" && a.severity !== "Critical") return 1;
        return b.age_days - a.age_days;
      });
  }, [data]);

  const rows = useMemo(() => {
    return (data?.ptrs || []).filter((p) => {
      if (selectedBlockerId && p.id !== selectedBlockerId) return false;
      if (onlyOpen && !isOpen(p)) return false;
      if (sev && p.severity !== sev) return false;
      if (status && p.status !== status) return false;
      return true;
    });
  }, [data, sev, status, onlyOpen, selectedBlockerId]);

  if (error)
    return (
      <div className="notice bad">
        <strong>Couldn't load PTRs.</strong> {error}
      </div>
    );
  if (!data) return <p className="loading">Loading PTRs</p>;

  return (
    <div className="project">
      {data.mock && (
        <p className="mock-note">
          Sample data. PTRs are mocked until an issue tracker is connected, so these reports don't reflect real problems.
        </p>
      )}

      {/* KPI Stats Strip */}
      <Kpis s={data.summary} />

      {/* =====================================================================
          MAIN BLOCKER PTRs FEATURE
          ===================================================================== */}
      <section className="ptr-blockers-section" aria-labelledby="main-blockers-heading">
        <header className="ptr-blockers-header">
          <div>
            <div className="ptr-blockers-title">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ad342c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <h3 id="main-blockers-heading">Main Blocker PTRs</h3>
              <span className="ptr-blockers-count">{mainBlockers.length} Active Blockers</span>
            </div>
            <p className="ptr-blockers-subtitle">
              Open defect reports actively blocking flight operations, departure gates, Amadeus synchronization, or delivery milestones.
            </p>
          </div>
          {selectedBlockerId && (
            <button className="btn ghost" onClick={() => setSelectedBlockerId(null)}>
              Clear Blocker Filter
            </button>
          )}
        </header>

        {mainBlockers.length === 0 ? (
          <div className="ptr-blockers-clear">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <strong>Zero Active Blocker PTRs.</strong> All critical subsystems are operating within SLA tolerances.
          </div>
        ) : (
          <div className="ptr-blockers-grid">
            {mainBlockers.map((b) => {
              const isSelected = selectedBlockerId === b.id;
              return (
                <article
                  key={b.id}
                  className={`ptr-blocker-card ${b.severity.toLowerCase()} ${isSelected ? "selected" : ""}`}
                  style={isSelected ? { outline: "2px solid var(--accent)", background: "var(--surface)" } : {}}
                >
                  <div className="ptr-blocker-top">
                    <span className={`ptr-blocker-tag ${b.severity.toLowerCase()}`}>
                      {b.severity === "Critical" ? "Critical Blocker" : "High-Impact Major"}
                    </span>
                    <span className="ptr-blocker-age">Open {b.age_days} days</span>
                  </div>

                  <p className="ptr-blocker-title">
                    <strong>{b.id}:</strong> {b.title}
                  </p>

                  <div className="ptr-blocker-impact">
                    <strong>Operational Blocker Impact:</strong>
                    {COMPONENT_IMPACTS[b.component] || `Impairs ${b.component} workflow and passenger service processing.`}
                  </div>

                  <div className="ptr-blocker-meta">
                    <span>Component: <strong>{b.component}</strong></span>
                    <span>Target: <strong>{b.target_release}</strong></span>
                    <span>Owner: <strong>{b.assignee}</strong></span>
                    <span>Status: <strong>{b.status}</strong></span>
                  </div>

                  <button
                    className="link"
                    style={{ alignSelf: "flex-start", marginTop: "4px", fontSize: "12.5px" }}
                    onClick={() => setSelectedBlockerId(isSelected ? null : b.id)}
                  >
                    {isSelected ? "Show all PTRs in table ↓" : "Filter table to this blocker ↓"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Filter Toolbar */}
      <div className="filters">
        <label className="field">
          <span className="sr">Severity</span>
          <select value={sev} onChange={(e) => setSev(e.target.value)}>
            <option value="">All severities</option>
            {SEVERITIES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="sr">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {data.statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="check-inline">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Open PTRs only
        </label>
        <span className="result-count">
          {rows.length} {rows.length === 1 ? "PTR" : "PTRs"}
          {selectedBlockerId && ` (Filtered to ${selectedBlockerId})`}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <h2>No PTRs match these filters</h2>
          <p>Change the severity or status, or include resolved PTRs.</p>
          <button
            className="btn"
            onClick={() => {
              setSev("");
              setStatus("");
              setOnlyOpen(false);
              setSelectedBlockerId(null);
            }}
          >
            Show all PTRs
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table ptr-table">
            <thead>
              <tr>
                <th>PTR</th>
                <th>Problem</th>
                <th>Severity</th>
                <th>Status</th>
                <th className="num">Age</th>
                <th>Assignee</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const blocker = isBlocker(p);
                return (
                  <tr
                    key={p.id}
                    className="static"
                    style={selectedBlockerId === p.id ? { background: "var(--accent-soft)" } : {}}
                  >
                    <td className="nowrap">
                      <strong>{p.id}</strong>
                      {blocker && <span className="ptr-blocker-badge-table">Blocker</span>}
                      <span className="sub-cell">Raised {fmtDate(p.raised)}</span>
                    </td>
                    <td className="c-title">
                      <strong className="plain">{p.title}</strong>
                      <span>{p.component}</span>
                    </td>
                    <td>
                      <span className="sevtag" data-sev={p.severity.toLowerCase()}>
                        {p.severity}
                      </span>
                    </td>
                    <td>
                      <span className="chip" data-done={!isOpen(p)}>
                        {p.status}
                      </span>
                    </td>
                    <td className="num nowrap">{p.age_days} days</td>
                    <td className="nowrap">{p.assignee}</td>
                    <td className="nowrap">{p.target_release}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
