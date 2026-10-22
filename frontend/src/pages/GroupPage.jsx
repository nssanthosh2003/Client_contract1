import { useMemo, useState } from "react";
import ClientCard from "../components/ClientCard.jsx";
import { PROJECT } from "../projectInfo.js";
import { href } from "../route.js";
import { FIELD, KEYS, useClients } from "./groups.js";
import { GroupToggle } from "./ContractsPage.jsx";

export default function GroupPage({ by, group }) {
  const { clients, error } = useClients();
  const [q, setQ] = useState("");
  const valid = KEYS[by].includes(group);
  const members = useMemo(() => (clients || []).filter((c) => c[FIELD[by]] === group), [clients, by, group]);
  const shown = members.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const label = by === "geo" ? "Regions" : "Sizes";

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href={href.home()}>{PROJECT.name}</a>
        <span aria-hidden="true">/</span>
        <a href={href.contracts(by)}>Contracts</a>
        <span aria-hidden="true">/</span>
        <a href={href.contracts(by)}>{label}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{group}</span>
      </nav>

      <div className="page-head">
        <div>
          <h2 className="page-title">{group}</h2>
          <p className="sub">
            {clients ? `${members.length} ${members.length === 1 ? "client" : "clients"}` : "Loading"}
            {by === "geo" ? " in this continent" : " of this size"}
          </p>
        </div>
        <div className="top-actions">
          <GroupToggle by={by} />
          <label className="field search-sm">
            <span className="sr">Search clients</span>
            <input type="search" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
      </div>

      {error && (
        <div className="notice bad banner" role="alert">
          <strong>Can't reach the API.</strong> {error}
        </div>
      )}
      {!valid && (
        <div className="empty">
          <h2>We don't have a group called "{group}"</h2>
          <p>Pick one from the landing page.</p>
          <a className="btn" href={href.contracts(by)}>
            Back to {label.toLowerCase()}
          </a>
        </div>
      )}
      {valid && clients && members.length === 0 && (
        <div className="empty">
          <h2>No clients in {group} yet</h2>
          <p>Set a client's {by === "geo" ? "continent" : "size"} in <code>contracts/client_meta.json</code>, or drop its contracts into the inbox.</p>
          <a className="btn" href={href.contracts(by)}>
            Back to {label.toLowerCase()}
          </a>
        </div>
      )}
      {valid && members.length > 0 && shown.length === 0 && (
        <div className="empty">
          <h2>No client matches "{q}"</h2>
          <p>Check the spelling or clear the search.</p>
          <button className="btn" onClick={() => setQ("")}>
            Clear search
          </button>
        </div>
      )}
      <div className="client-grid">
        {shown.map((c) => (
          <ClientCard key={c.id} c={c} />
        ))}
      </div>
    </>
  );
}
