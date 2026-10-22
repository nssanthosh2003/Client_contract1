import { confLevel, fmtDate, pct, statusKey, termProgress } from "../util.js";

export function StatusBadge({ status }) {
  return (
    <span className="badge" data-status={statusKey(status)}>
      {status}
    </span>
  );
}

export function ReviewFlag({ failed }) {
  return (
    <span className="review-flag" title="Low confidence or missing core fields. Open the contract to check the extracted values.">
      {failed ? "Unreadable" : "Needs review"}
    </span>
  );
}

/** The signature element: the contract's term as a bar, with a marker for today. */
export function Timeline({ start, end, status, labels = true, large = false }) {
  const prog = termProgress(start, end);
  const key = statusKey(status);
  if (!prog) {
    return (
      <div className={`timeline open ${large ? "large" : ""}`} data-status={key}>
        <div className="track dashed" />
        {labels && (
          <div className="tl-labels">
            <span>{start ? fmtDate(start) : "No start date"}</span>
            <span>{end ? fmtDate(end) : "No end date"}</span>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className={`timeline ${large ? "large" : ""}`} data-status={key}>
      <div className="track" role="img" aria-label={`Term ${fmtDate(start)} to ${fmtDate(end)}`}>
        <div className="fill" style={{ width: `${prog.pct * 100}%` }} />
        <div className={`today ${prog.before || prog.after ? "outside" : ""}`} style={{ left: `${prog.pct * 100}%` }} title="Today" />
      </div>
      {labels && (
        <div className="tl-labels">
          <span>{fmtDate(start)}</span>
          <span>{fmtDate(end)}</span>
        </div>
      )}
    </div>
  );
}

export function Conf({ value, label }) {
  if (value == null) return null;
  const level = confLevel(value);
  return (
    <span className="conf" data-level={level} title={`${label || "Extraction"} confidence ${pct(value)}`}>
      <i />
      <i />
      <i />
      <span className="sr">{level} confidence</span>
    </span>
  );
}
