import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import ContractList from "../components/ContractList.jsx";
import DetailDrawer from "../components/DetailDrawer.jsx";
import Filters from "../components/Filters.jsx";
import StatTiles from "../components/StatTiles.jsx";
import UploadDialog from "../components/UploadDialog.jsx";

const DEFAULTS = { q: "", status: "", type: "", review: false, sort: "end_date", order: "asc" };
const POLL_MS = 6000;

export default function ContractsTab({ client }) {
  const [filters, setFilters] = useState(DEFAULTS);
  const [qInput, setQInput] = useState("");
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem("ch-view") || "grid";
    } catch {
      return "grid";
    }
  });
  const [items, setItems] = useState(null);
  const [stats, setStats] = useState(null);
  const [facets, setFacets] = useState({ clients: [], types: [] });
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [uploading, setUploading] = useState(false);

  const setFilter = useCallback((patch) => setFilters((f) => ({ ...f, ...patch })), []);

  useEffect(() => {
    const t = setTimeout(() => setFilter({ q: qInput.trim() }), 250);
    return () => clearTimeout(t);
  }, [qInput, setFilter]);

  useEffect(() => {
    try {
      localStorage.setItem("ch-view", view);
    } catch {
      /* storage unavailable */
    }
  }, [view]);

  const load = useCallback(async () => {
    try {
      const [list, st, fc] = await Promise.all([api.contracts({ ...filters, clientId: client.id }), api.stats(client.id), api.facets(client.id)]);
      setItems(list);
      setStats(st);
      setFacets(fc);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [filters, client.id]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const activeCount = useMemo(() => ["q", "status", "type"].filter((k) => filters[k]).length + (filters.review ? 1 : 0), [filters]);
  const clear = () => {
    setQInput("");
    setFilters({ ...DEFAULTS, sort: filters.sort, order: filters.order });
  };

  return (
    <>
      {error && (
        <div className="notice bad banner" role="alert">
          <strong>Couldn't load contracts.</strong> {error}
        </div>
      )}

      <div className="tab-actions">
        <button className="btn" onClick={() => setUploading(true)}>
          Upload contract
        </button>
      </div>

      <StatTiles
        stats={stats}
        status={filters.status}
        review={filters.review}
        onStatus={(status) => setFilter({ status, review: false })}
        onReview={(review) => setFilter({ review, status: "" })}
      />

      <Filters
        qInput={qInput}
        setQInput={setQInput}
        filters={filters}
        setFilter={setFilter}
        facets={facets}
        view={view}
        setView={setView}
        activeCount={activeCount}
        clear={clear}
        hideClient
      />

      <div aria-live="polite">
        {items === null && !error && <p className="loading">Loading contracts</p>}
        {items && items.length === 0 && (
          <div className="empty">
            {activeCount > 0 ? (
              <>
                <h2>No contracts match these filters</h2>
                <p>Try a different search, or clear the filters to see all of {client.name}'s contracts.</p>
                <button className="btn" onClick={clear}>
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <h2>No contracts for {client.name}</h2>
                <p>Upload a PDF here, or drop it into this client's folder in the inbox.</p>
                <button className="btn" onClick={() => setUploading(true)}>
                  Upload contract
                </button>
              </>
            )}
          </div>
        )}
        {items && items.length > 0 && <ContractList items={items} view={view} selectedId={selectedId} onOpen={setSelectedId} />}
      </div>

      {selectedId && <DetailDrawer id={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />}
      {uploading && (
        <UploadDialog
          clients={[]}
          defaultClient={client.name}
          onClose={() => setUploading(false)}
          onDone={(created) => {
            setUploading(false);
            load();
            setSelectedId(created.id);
          }}
        />
      )}
    </>
  );
}
