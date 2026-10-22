import { PROJECT } from "../projectInfo.js";
import { href } from "../route.js";

function CapabilityIcon({ id }) {
  switch (id) {
    case "lifecycle":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2L11 13" />
          <path d="M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      );
    case "seats":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 18v3" />
          <path d="M20 18v3" />
          <path d="M5 4h14a1 1 0 0 1 1 1v9H4V5a1 1 0 0 1 1-1z" />
          <path d="M4 14h16v4H4z" />
        </svg>
      );
    case "troubleshoot":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case "amadeus":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="8" rx="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>
      );
    case "ancillaries":
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    case "efficiency":
    default:
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
  }
}

export default function LandingPage() {
  return (
    <div className="landing-page-tcs">
      {/* =====================================================================
          1. HERO BANNER: TCS AGENTASSIST
          ===================================================================== */}
      <section className="tcs-home-hero" aria-label="TCS AgentAssist Overview">
        <div className="tcs-home-hero-content">
          <div className="tcs-badge">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
            <span>TCS AgentAssist · Service Center UI</span>
          </div>

          <h1 className="tcs-home-hero-title">{PROJECT.title}</h1>

          <p className="tcs-home-hero-lead">{PROJECT.summary}</p>

          <div className="tcs-highlights" aria-label="Key Highlights">
            {(PROJECT.highlights || []).map((highlight, idx) => (
              <span key={idx} className="tcs-pill">
                <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
                  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                </svg>
                {highlight}
              </span>
            ))}
          </div>

          {/* PROMINENT VISIBLE NAVIGATION BUTTON TO CONTRACT MANAGEMENT */}
          <div className="tcs-cta-container">
            <a href={href.contracts()} className="btn tcs-nav-btn">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>Go to Contract & Portfolio Management</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </a>
            <span className="tcs-cta-hint">Manage commercial agreements, MSAs, SLAs, and airline client portfolios</span>
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. CORE CAPABILITIES (6 Grid Cards)
          ===================================================================== */}
      <section className="tcs-home-section" aria-labelledby="tcs-capabilities-heading">
        <header className="tcs-section-header">
          <div>
            <h2 id="tcs-capabilities-heading" className="tcs-section-title">Core Agent Capabilities</h2>
            <p className="tcs-section-subtitle">Comprehensive tooling designed to empower customer service agents across all touchpoints</p>
          </div>
        </header>

        <div className="tcs-cap-grid">
          {(PROJECT.capabilities || []).map((cap) => (
            <article key={cap.id} className="tcs-cap-card">
              <div className="tcs-cap-icon">
                <CapabilityIcon id={cap.id} />
              </div>
              <h4>{cap.title}</h4>
              <p>{cap.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* =====================================================================
          3. END-TO-END BOOKING SCOPE PIPELINE (8 Stages)
          ===================================================================== */}
      <section className="tcs-home-section" aria-labelledby="tcs-scope-heading">
        <header className="tcs-section-header">
          <div>
            <h2 id="tcs-scope-heading" className="tcs-section-title">End-to-End Booking Journey Scope</h2>
            <p className="tcs-section-subtitle">Complete end-to-end booking journey coverage within the TCS AgentAssist Service Center UI</p>
          </div>
        </header>

        <div className="tcs-scope-pipeline">
          {(PROJECT.scopeSteps || []).map((step) => (
            <div key={step.num} className="tcs-scope-node">
              <span className="tcs-scope-num">{step.num}</span>
              <strong className="tcs-scope-name">{step.name}</strong>
              <span className="tcs-scope-detail">{step.detail}</span>
            </div>
          ))}
        </div>
      </section>

      {/* =====================================================================
          4. USER ROLES AND ACCESS RIGHTS (3 Cards)
          ===================================================================== */}
      <section className="tcs-home-section" aria-labelledby="tcs-roles-heading">
        <header className="tcs-section-header">
          <div>
            <h2 id="tcs-roles-heading" className="tcs-section-title">User Roles and Access Rights</h2>
            <p className="tcs-section-subtitle">Roles available in TCS AgentAssist Service Center UI and the access rights associated with each role</p>
          </div>
        </header>

        <div className="tcs-roles-grid">
          {(PROJECT.roles || []).map((r) => (
            <article key={r.code} className="tcs-role-card">
              <div className="tcs-role-header">
                <span className="tcs-role-code">{r.code}</span>
                <span className={`tcs-role-badge ${r.badgeClass}`}>{r.title}</span>
              </div>
              <p className="tcs-role-desc">{r.desc}</p>
              <div className="tcs-role-perms">
                <strong>Permissions Scope:</strong> {r.permissions}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
