import { statusKey } from "../util.js";

const TILES = [
  { key: "Active", hint: "In force" },
  { key: "Expiring Soon", hint: "Ending within 60 days" },
  { key: "Expired", hint: "Past end date" },
  { key: "Upcoming", hint: "Not started yet" },
];

export default function StatTiles({ stats, status, review, onStatus, onReview }) {
  if (!stats) return <div className="tiles" aria-hidden="true" />;
  return (
    <div className="tiles" role="group" aria-label="Filter by status">
      {TILES.map((t) => {
        const n = stats.by_status[t.key] || 0;
        const on = status === t.key;
        return (
          <button
            key={t.key}
            className="tile"
            data-status={statusKey(t.key)}
            aria-pressed={on}
            onClick={() => onStatus(on ? "" : t.key)}
            disabled={!n && !on}
          >
            <span className="tile-n">{n}</span>
            <span className="tile-l">{t.key}</span>
            <span className="tile-h">{t.hint}</span>
          </button>
        );
      })}
      <button className="tile review" aria-pressed={review} onClick={() => onReview(!review)} disabled={!stats.needs_review && !review}>
        <span className="tile-n">{stats.needs_review}</span>
        <span className="tile-l">Needs review</span>
        <span className="tile-h">Low confidence or unreadable</span>
      </button>
    </div>
  );
}
