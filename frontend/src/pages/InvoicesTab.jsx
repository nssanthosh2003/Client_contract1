import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { fmtDate, fmtMoney } from "../util.js";

const FILTERS = ["All", "Overdue", "Sent", "Paid", "Draft"];

export default function InvoicesTab({ clientId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    let live = true;
    api
      .invoices(clientId)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [clientId]);

  const rows = useMemo(() => (data?.invoices || []).filter((i) => filter === "All" || i.status === filter), [data, filter]);

  if (error)
    return (
      <div className="notice bad">
        <strong>Couldn't load invoices.</strong> {error}
      </div>
    );
  if (!data) return <p className="loading">Loading invoices</p>;

  const s = data.summary;
  const money = (v) => fmtMoney(v, s.currency);
  const counts = Object.fromEntries(FILTERS.map((f) => [f, f === "All" ? data.invoices.length : data.invoices.filter((i) => i.status === f).length]));

  return (
    <div className="project">
      {data.mock && <p className="mock-note">Sample data. Invoices are mocked until a billing system is connected, so these amounts aren't real.</p>}
      <dl className="kpis">
        <div className="kpi">
          <dt>Outstanding</dt>
          <dd>{money(s.outstanding)}</dd>
        </div>
        <div className="kpi">
          <dt>Overdue</dt>
          <dd className={s.overdue ? "bad" : ""}>{money(s.overdue)}</dd>
          <small>{s.overdue_count} {s.overdue_count === 1 ? "invoice" : "invoices"}</small>
        </div>
        <div className="kpi">
          <dt>Paid this year</dt>
          <dd>{money(s.paid_ytd)}</dd>
        </div>
        <div className="kpi">
          <dt>Next due</dt>
          <dd>{s.next_due ? fmtDate(s.next_due.due) : "Nothing due"}</dd>
          {s.next_due && <small>{s.next_due.number} · {money(s.next_due.amount)}</small>}
        </div>
      </dl>

      <div className="filters" role="group" aria-label="Filter invoices by status">
        {FILTERS.map((f) => (
          <button key={f} className="pill" aria-pressed={filter === f} onClick={() => setFilter(f)} disabled={!counts[f] && f !== "All"}>
            {f} <span>{counts[f]}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <h2>No {filter.toLowerCase()} invoices</h2>
          <p>Pick another status to see more.</p>
          <button className="btn" onClick={() => setFilter("All")}>
            Show all invoices
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Description</th>
                <th>Issued</th>
                <th>Due</th>
                <th>Status</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.number} className="static">
                  <td className="nowrap">
                    <strong>{i.number}</strong>
                  </td>
                  <td>{i.description}</td>
                  <td className="nowrap">{fmtDate(i.issued)}</td>
                  <td className="nowrap">{fmtDate(i.due)}</td>
                  <td className="nowrap">
                    <span className="inv-status" data-inv={i.status.toLowerCase()}>
                      {i.status}
                      {i.status === "Overdue" && ` · ${i.days_overdue} days`}
                    </span>
                  </td>
                  <td className="num nowrap">{money(i.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
