import { href } from "../route.js";
import { statusKey } from "../util.js";

export const STATUS_ORDER = ["Active", "Expiring Soon", "Expired", "Upcoming", "Unknown"];

export const compactMoney = (by) =>
  Object.entries(by || {})
    .map(([cur, v]) => {
      try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency: cur, notation: "compact", maximumFractionDigits: 1 }).format(v);
      } catch {
        return `${cur} ${Math.round(v).toLocaleString()}`;
      }
    })
    .join(", ");

export function StatusStrip({ by }) {
  const total = Object.values(by).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="strip" role="img" aria-label={STATUS_ORDER.filter((s) => by[s]).map((s) => `${by[s]} ${s}`).join(", ")}>
      {STATUS_ORDER.filter((s) => by[s]).map((s) => (
        <i key={s} data-status={statusKey(s)} style={{ flexGrow: by[s] / total }} />
      ))}
    </div>
  );
}

export function Legend({ by }) {
  return (
    <ul className="legend">
      {STATUS_ORDER.filter((s) => by[s]).map((s) => (
        <li key={s} data-status={statusKey(s)}>
          <b>{by[s]}</b> {s}
        </li>
      ))}
    </ul>
  );
}

export default function ClientCard({ c }) {
  const exp = c.next_expiry;
  const attention = (c.by_status["Expiring Soon"] || 0) + (c.by_status["Expired"] || 0);
  return (
    <a className="client-card" href={href.client(c.id)}>
      <h3>{c.name}</h3>
      <p className="where">
        {c.country} · {c.size}
      </p>
      <p className="count">
        {c.contract_count} {c.contract_count === 1 ? "contract" : "contracts"}
        {compactMoney(c.active_value_by_currency) && <span> · {compactMoney(c.active_value_by_currency)} in force</span>}
      </p>
      <StatusStrip by={c.by_status} />
      <Legend by={c.by_status} />
      <p className="next" data-status={exp ? (exp.days <= 60 ? "expiring-soon" : "active") : "unknown"}>
        {exp ? (exp.days === 0 ? "A contract expires today" : `Next expiry in ${exp.days} ${exp.days === 1 ? "day" : "days"}`) : "No upcoming expiry"}
      </p>
      {(attention > 0 || c.needs_review > 0) && (
        <p className="flags">
          {attention > 0 && <span>{attention} need attention</span>}
          {c.needs_review > 0 && <span className="review">{c.needs_review} to review</span>}
        </p>
      )}
    </a>
  );
}
