export const SORTS = [
  { v: "end_date:asc", l: "Ending soonest" },
  { v: "end_date:desc", l: "Ending latest" },
  { v: "value:desc", l: "Highest value" },
  { v: "title:asc", l: "Title A to Z" },
  { v: "confidence:asc", l: "Lowest confidence" },
  { v: "updated_at:desc", l: "Recently processed" },
];

export default function Filters({ qInput, setQInput, filters, setFilter, facets, view, setView, activeCount, clear, hideClient = false }) {
  return (
    <div className="filters">
      <label className="field search">
        <span className="sr">Search contracts</span>
        <input type="search" placeholder="Search title, client or party" value={qInput} onChange={(e) => setQInput(e.target.value)} />
      </label>

      {!hideClient && (
        <label className="field">
          <span className="sr">Client</span>
          <select value={filters.clientId} onChange={(e) => setFilter({ clientId: e.target.value })}>
            <option value="">All clients</option>
            {facets.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field">
        <span className="sr">Contract type</span>
        <select value={filters.type} onChange={(e) => setFilter({ type: e.target.value })}>
          <option value="">All types</option>
          {facets.types.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name} ({t.count})
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="sr">Sort by</span>
        <select value={`${filters.sort}:${filters.order}`} onChange={(e) => { const [sort, order] = e.target.value.split(":"); setFilter({ sort, order }); }}>
          {SORTS.map((s) => (
            <option key={s.v} value={s.v}>
              {s.l}
            </option>
          ))}
        </select>
      </label>

      {activeCount > 0 && (
        <button className="link" onClick={clear}>
          Clear filters
        </button>
      )}

      <div className="seg" role="group" aria-label="Layout">
        <button aria-pressed={view === "grid"} onClick={() => setView("grid")}>
          Cards
        </button>
        <button aria-pressed={view === "list"} onClick={() => setView("list")}>
          Table
        </button>
      </div>
    </div>
  );
}
