import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { confLevel, fmtDate, fmtMoney, lifeText, pct, prettyTitle } from "../util.js";
import { Conf, ReviewFlag, StatusBadge, Timeline } from "./Parts.jsx";

const TABS = [
  ["details", "Details"],
  ["slas", "Service levels"],
  ["source", "Source PDF"],
  ["extraction", "How it was read"],
];

const AGENT = { reader: "Reader", classifier: "Classifier", extractor: "Extractor", sla: "Service levels", validator: "Validator" };
const MODE = { text: "text layer", ocr: "OCR", llm: "Claude", heuristic: "rules", fallback: "rules (Claude failed)", error: "failed" };
const FIELD = {
  contract_type: "Contract type", title: "Title", parties: "Parties", value: "Value", value_basis: "Value basis", currency: "Currency",
  start_date: "Start date", end_date: "End date", renewal_terms: "Renewal", governing_law: "Governing law", payment_terms: "Payment terms", slas: "Service levels",
};

function Field({ label, conf, children, wide }) {
  const empty = children == null || children === false;
  return (
    <div className={`kv ${wide ? "wide" : ""}`}>
      <dt>
        {label}
        <Conf value={conf} label={label} />
        {conf != null && conf < 0.5 && !empty && <em className="check">Check against source</em>}
      </dt>
      <dd>{empty ? <span className="dim">Not found in document</span> : children}</dd>
    </div>
  );
}

function Details({ c }) {
  const fc = c.field_confidence;
  const money = fmtMoney(c.value, c.currency, c.value_basis);
  return (
    <>
      {c.processing_status === "failed" && (
        <div className="notice bad">
          <strong>This file could not be read.</strong> {c.error} Add a text-based or scannable PDF, then re-run extraction.
        </div>
      )}
      {c.warnings.length > 0 && c.processing_status !== "failed" && (
        <div className="notice">
          <strong>Check before relying on this record</strong>
          <ul>
            {c.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      <dl className="kvs">
        <Field label="Parties" conf={fc.parties} wide>
          {c.parties.length > 0 && (
            <ul className="parties-list">
              {c.parties.map((p, i) => (
                <li key={i}>
                  <span>{p.name}</span>
                  {p.role && <small>{p.role}</small>}
                </li>
              ))}
            </ul>
          )}
        </Field>
        <Field label="Contract value" conf={fc.value}>{money}</Field>
        <Field label="Contract type" conf={fc.contract_type}>{c.contract_type}</Field>
        <Field label="Start date" conf={fc.start_date}>{c.start_date && fmtDate(c.start_date)}</Field>
        <Field label="End date" conf={fc.end_date}>{c.end_date && fmtDate(c.end_date)}</Field>
        <Field label="Governing law" conf={fc.governing_law}>{c.governing_law}</Field>
        <Field label="Payment terms" conf={fc.payment_terms} wide>{c.payment_terms}</Field>
        <Field label="Renewal" conf={fc.renewal_terms} wide>{c.renewal_terms}</Field>
      </dl>
    </>
  );
}

function Slas({ c }) {
  if (!c.slas.length)
    return (
      <p className="empty-note">
        No measurable service levels were found in this contract. If it should have some, open the Source PDF tab to check, then re-run extraction.
      </p>
    );
  return (
    <ul className="slas">
      {c.slas.map((s, i) => (
        <li key={i}>
          <div className="sla-head">
            <span>{s.metric}</span>
            <strong>{s.target}</strong>
          </div>
          {s.remedy && <p className="sla-remedy">{s.remedy} if missed</p>}
          {s.evidence && <blockquote>{s.evidence}</blockquote>}
        </li>
      ))}
    </ul>
  );
}

function Extraction({ c }) {
  const rows = Object.entries(c.field_confidence).sort((a, b) => a[1] - b[1]);
  return (
    <>
      <p className="lede">
        Each file passes through five agents in order. Anything the Validator cannot find in the document text is marked down, so low scores point at fields worth checking.
      </p>
      <ol className="trace">
        {c.agent_trace.map((t) => (
          <li key={t.agent} data-status={t.status}>
            <span className="t-agent">{AGENT[t.agent] || t.agent}</span>
            <span className="t-mode">{MODE[t.mode] || t.mode}</span>
            <span className="t-ms">{t.ms} ms</span>
            <span className="t-note">{t.note}</span>
          </li>
        ))}
        {!c.agent_trace.length && <li className="dim">No agent ran for this file.</li>}
      </ol>
      <h4>Field confidence</h4>
      <ul className="bars">
        {rows.map(([k, v]) => (
          <li key={k}>
            <span>{FIELD[k] || k}</span>
            <div className="bar" data-level={confLevel(v)}>
              <i style={{ width: pct(v) }} />
            </div>
            <span className="num">{pct(v)}</span>
          </li>
        ))}
      </ul>
      {c.raw_text_preview && (
        <details className="raw">
          <summary>Text the agents read (first 2,500 characters)</summary>
          <pre>{c.raw_text_preview}</pre>
        </details>
      )}
    </>
  );
}

export default function DetailDrawer({ id, onClose, onChanged }) {
  const [c, setC] = useState(null);
  const [tab, setTab] = useState("details");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const closeRef = useRef(null);

  useEffect(() => {
    let live = true;
    setC(null);
    setErr("");
    setTab("details");
    api.contract(id).then((d) => live && setC(d)).catch((e) => live && setErr(e.message));
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rerun = async () => {
    setBusy(true);
    setErr("");
    try {
      setC(await api.reprocess(id));
      onChanged();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Contract details">
        <button ref={closeRef} className="close" onClick={onClose} aria-label="Close details">
          Close
        </button>
        {err && <div className="notice bad">{err}</div>}
        {!c && !err && <p className="loading">Loading contract</p>}
        {c && (
          <>
            <header className="d-head">
              <p className="d-kicker">
                {c.client_name}
                <span>{c.contract_type || "Unclassified"}</span>
              </p>
              <h2>{prettyTitle(c.title, c.file_name)}</h2>
              <div className="d-badges">
                <StatusBadge status={c.status} />
                {c.needs_review && <ReviewFlag failed={c.processing_status === "failed"} />}
                <span className="life">{lifeText(c)}</span>
              </div>
              <Timeline start={c.start_date} end={c.end_date} status={c.status} large />
            </header>

            <div className="tabs" role="tablist">
              {TABS.map(([k, l]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                  {l}
                  {k === "slas" && c.slas.length > 0 && <span className="count">{c.slas.length}</span>}
                </button>
              ))}
            </div>

            <div className={`d-body ${tab === "source" ? "flush" : ""}`} role="tabpanel">
              {tab === "details" && <Details c={c} />}
              {tab === "slas" && <Slas c={c} />}
              {tab === "source" && <iframe title="Source PDF" src={api.fileUrl(c.id)} />}
              {tab === "extraction" && <Extraction c={c} />}
            </div>

            <footer className="d-foot">
              <span className="file" title={c.file_path}>
                {c.file_path}
              </span>
              <a className="btn ghost" href={api.fileUrl(c.id)} target="_blank" rel="noreferrer">
                Open PDF in new tab
              </a>
              <button className="btn" onClick={rerun} disabled={busy}>
                {busy ? "Extracting" : "Re-run extraction"}
              </button>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}
