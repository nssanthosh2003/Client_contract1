import { fmtMoney, lifeText, prettyTitle, statusKey } from "../util.js";
import { ReviewFlag, StatusBadge, Timeline } from "./Parts.jsx";

const partiesLine = (c) => c.parties.map((p) => p.name).join("  /  ");

function Card({ c, selected, onOpen }) {
  const money = fmtMoney(c.value, c.currency, c.value_basis);
  return (
    <article
      className="card"
      data-status={statusKey(c.status)}
      data-selected={selected}
      tabIndex={0}
      role="button"
      aria-label={`Open ${prettyTitle(c.title, c.file_name)}`}
      onClick={() => onOpen(c.id)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(c.id))}
    >
      <header>
        <span className="type">{c.contract_type || "Unclassified"}</span>
        <StatusBadge status={c.status} />
      </header>
      <h3>{prettyTitle(c.title, c.file_name)}</h3>
      <p className="client">{c.client_name}</p>
      <p className="parties" title={partiesLine(c)}>
        {c.parties.length ? partiesLine(c) : "Parties not found"}
      </p>
      <Timeline start={c.start_date} end={c.end_date} status={c.status} />
      <footer>
        <span className="life">{lifeText(c)}</span>
        <span className="meta">
          {money && <strong>{money}</strong>}
          {c.sla_count > 0 && <span>{c.sla_count} SLAs</span>}
          {c.needs_review && <ReviewFlag failed={c.processing_status === "failed"} />}
        </span>
      </footer>
    </article>
  );
}

function Row({ c, selected, onOpen }) {
  const money = fmtMoney(c.value, c.currency, c.value_basis);
  return (
    <tr
      data-status={statusKey(c.status)}
      data-selected={selected}
      tabIndex={0}
      onClick={() => onOpen(c.id)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(c.id)}
    >
      <td className="c-title">
        <strong>{prettyTitle(c.title, c.file_name)}</strong>
        <span>{c.client_name}</span>
      </td>
      <td>{c.contract_type || "Unclassified"}</td>
      <td>
        <StatusBadge status={c.status} />
      </td>
      <td className="c-term">
        <Timeline start={c.start_date} end={c.end_date} status={c.status} labels={false} />
        <span className="life">{lifeText(c)}</span>
      </td>
      <td className="num">{money || <span className="dim">Not found</span>}</td>
      <td>{c.needs_review ? <ReviewFlag failed={c.processing_status === "failed"} /> : <span className="dim">{Math.round(c.confidence * 100)}%</span>}</td>
    </tr>
  );
}

export default function ContractList({ items, view, selectedId, onOpen }) {
  if (view === "grid") {
    return (
      <div className="grid">
        {items.map((c) => (
          <Card key={c.id} c={c} selected={c.id === selectedId} onOpen={onOpen} />
        ))}
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Contract</th>
            <th>Type</th>
            <th>Status</th>
            <th>Term</th>
            <th className="num">Value</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <Row key={c.id} c={c} selected={c.id === selectedId} onOpen={onOpen} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
