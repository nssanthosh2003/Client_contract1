import { useEffect, useState } from "react";

const DONE_PREVIEW = 4;
const pts = (n) => `${n} ${n === 1 ? "pt" : "pts"}`;
import { api } from "../api.js";
import { fmtDate } from "../util.js";

const HEALTH_STATUS = { "On track": "active", "At risk": "expiring-soon", "Off track": "expired" };
const MS_STATUS = { Done: "active", "In progress": "upcoming", Upcoming: "unknown", Late: "expired" };
const initials = (name) => (name || "").split(" ").slice(0, 2).map((w) => w[0]).join("");

function Summary({ p, blockers }) {
  const s = p.sprint;
  return (
    <section className="proj-summary" data-status={HEALTH_STATUS[p.health]} aria-label="Project summary">
      <div className="ps-main">
        <p className="ps-phase">{p.phase} phase · Lead: {p.lead}</p>
        <h3>{p.name}</h3>
        <span className="health" data-status={HEALTH_STATUS[p.health]}>
          {p.health}
        </span>
      </div>
      <dl className="ps-stats">
        <div>
          <dt>{s.name}</dt>
          <dd>
            {s.days_left} {s.days_left === 1 ? "day" : "days"} left
          </dd>
          <small>
            {fmtDate(s.start)} to {fmtDate(s.end)}
          </small>
        </div>
        <div>
          <dt>Story points done</dt>
          <dd>
            {s.points_done} of {s.points_total}
          </dd>
          <div className="meter" role="img" aria-label={`${s.percent_done}% done`}>
            <i style={{ width: `${s.percent_done}%` }} />
          </div>
        </div>
        <div>
          <dt>Open blockers</dt>
          <dd className={blockers.length ? "bad" : ""}>{blockers.length}</dd>
          <small>{blockers.length ? `${blockers.filter((b) => b.severity === "Critical").length} critical` : "Nothing blocked"}</small>
        </div>
      </dl>
    </section>
  );
}

function Blockers({ blockers, stories }) {
  const title = (key) => stories.find((s) => s.key === key)?.title;
  return (
    <section className="panel" aria-labelledby="blk-h">
      <h3 id="blk-h">Blockers</h3>
      {blockers.length === 0 ? (
        <p className="empty-note">No open blockers. Work on this project is moving freely.</p>
      ) : (
        <ul className="blockers">
          {blockers.map((b) => (
            <li key={b.id} data-sev={b.severity.toLowerCase()}>
              <div className="b-top">
                <span className="sev">{b.severity}</span>
                {b.status === "Escalated" && <span className="esc">Escalated</span>}
                <span className="b-open">Open {b.days_open} {b.days_open === 1 ? "day" : "days"}</span>
              </div>
              <p className="b-title">{b.title}</p>
              <p className="b-impact">{b.impact}</p>
              <p className="b-meta">
                Owner: {b.owner}
                {b.story_key && (
                  <span>
                    {" "}
                    · Blocks <b>{b.story_key}</b> {title(b.story_key)}
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Board({ columns, stories }) {
  const [showAllDone, setShowAllDone] = useState(false);
  return (
    <section aria-labelledby="board-h" className="board-wrap">
      <h3 id="board-h" className="board-title">
        Sprint board
      </h3>
      <div className="board">
        {columns.map((col) => {
          const all = stories.filter((s) => s.status === col);
          const total = all.reduce((n, s) => n + s.points, 0);
          const collapsible = col === "Done" && all.length > DONE_PREVIEW;
          const cards = collapsible && !showAllDone ? all.slice(0, DONE_PREVIEW) : all;
          return (
            <div className="col" key={col}>
              <header>
                <h4>{col}</h4>
                <span>
                  {all.length} · {pts(total)}
                </span>
              </header>
              <ul>
                {cards.map((s) => (
                  <li className="story" key={s.key} data-blocked={s.blocked} data-pri={s.priority.toLowerCase()}>
                    <div className="st-top">
                      <span className="st-key">{s.key}</span>
                      {s.blocked && <span className="st-blocked">Blocked</span>}
                      <span className="st-pts" title="Story points">
                        {s.points}
                      </span>
                    </div>
                    <p className="st-title">{s.title}</p>
                    <div className="st-foot">
                      <span className="st-labels">
                        {s.labels.map((l) => (
                          <em key={l}>{l}</em>
                        ))}
                      </span>
                      {s.assignee ? (
                        <span className="avatar" title={s.assignee}>
                          {initials(s.assignee)}
                        </span>
                      ) : (
                        <span className="avatar none" title="Unassigned">
                          ?
                        </span>
                      )}
                    </div>
                  </li>
                ))}
                {cards.length === 0 && <li className="col-empty">Nothing here</li>}
              </ul>
              {collapsible && (
                <button className="link col-more" onClick={() => setShowAllDone((v) => !v)} aria-expanded={showAllDone}>
                  {showAllDone ? "Show fewer" : `Show all ${all.length}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Milestones({ items }) {
  return (
    <section className="panel" aria-labelledby="ms-h">
      <h3 id="ms-h">Milestones</h3>
      <ol className="milestones">
        {items.map((m) => (
          <li key={m.name} data-status={MS_STATUS[m.status]}>
            <span className="dot" />
            <div>
              <p>{m.name}</p>
              <small>
                {fmtDate(m.due)} · <b>{m.status}</b>
              </small>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Burndown({ data }) {
  const W = 560, H = 210, L = 34, R = 10, T = 12, B = 26;
  const max = Math.max(...data.ideal, ...data.actual, 1);
  const x = (d) => L + (d / data.sprint_days) * (W - L - R);
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const path = (arr) => arr.map((v, d) => `${d ? "L" : "M"}${x(d).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  return (
    <section className="panel" aria-labelledby="bd-h">
      <h3 id="bd-h">Sprint burndown</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Burndown: ${data.actual[data.actual.length - 1]} points remaining against an ideal of ${data.ideal[data.elapsed]}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid-line" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" className="axis">
              {t}
            </text>
          </g>
        ))}
        <path d={path(data.ideal)} className="ideal" />
        <path d={path(data.actual)} className="actual" />
        <circle cx={x(data.elapsed)} cy={y(data.actual[data.actual.length - 1])} r="4" className="now" />
        <text x={L} y={H - 6} className="axis">
          Day 0
        </text>
        <text x={W - R} y={H - 6} textAnchor="end" className="axis">
          Day {data.sprint_days}
        </text>
      </svg>
      <p className="chart-key">
        <span className="k-actual">Remaining points</span>
        <span className="k-ideal">Ideal pace</span>
      </p>
    </section>
  );
}

function Workload({ items }) {
  const max = Math.max(...items.map((w) => w.open_points), 1);
  return (
    <section className="panel" aria-labelledby="wl-h">
      <h3 id="wl-h">Open work by person</h3>
      <ul className="workload">
        {items.map((w) => (
          <li key={w.name}>
            <span className="avatar">{w.initials}</span>
            <span className="w-name">{w.name}</span>
            <div className="bar">
              <i style={{ width: `${(w.open_points / max) * 100}%` }} />
            </div>
            <span className="w-n">
              {pts(w.open_points)} · {w.open_stories} {w.open_stories === 1 ? "story" : "stories"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ProjectTab({ clientId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    api
      .project(clientId)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [clientId]);

  if (error)
    return (
      <div className="notice bad">
        <strong>Couldn't load project status.</strong> {error}
      </div>
    );
  if (!data) return <p className="loading">Loading project status</p>;

  return (
    <div className="project">
      {data.mock && (
        <p className="mock-note">
          Sample data. Project status is mocked until a project tool is connected, so these numbers don't reflect real work.
        </p>
      )}
      <Summary p={data.project} blockers={data.blockers} />
      <div className="proj-grid">
        <Blockers blockers={data.blockers} stories={data.stories} />
        <Milestones items={data.milestones} />
      </div>
      <Board columns={data.columns} stories={data.stories} />
      <div className="proj-grid">
        <Burndown data={data.burndown} />
        <Workload items={data.workload} />
      </div>
    </div>
  );
}
