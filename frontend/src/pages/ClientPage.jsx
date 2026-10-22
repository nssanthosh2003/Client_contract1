import { useEffect, useState } from "react";
import { api } from "../api.js";
import ChatWidget from "../components/ChatWidget.jsx";
import { Legend } from "../components/ClientCard.jsx";
import { PROJECT } from "../projectInfo.js";
import { href } from "../route.js";
import ContractsTab from "./ContractsTab.jsx";
import InvoicesTab from "./InvoicesTab.jsx";
import PtrTab from "./PtrTab.jsx";

const TABS = [
  ["ptrs", "PTRs"],
  ["invoices", "Invoices"],
  ["contracts", "Contracts"],
];

export default function ClientPage({ clientId, tab }) {
  const [client, setClient] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setClient(null);
    setError("");
    api
      .client(clientId)
      .then((c) => live && setClient(c))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [clientId]);

  if (error)
    return (
      <div className="empty">
        <h2>We couldn't find that client</h2>
        <p>It may have been removed from the inbox. {error}</p>
        <a className="btn" href={href.contracts()}>
          Back to Contract Management
        </a>
      </div>
    );
  if (!client) return <p className="loading">Loading client</p>;

  const attention = (client.by_status["Expiring Soon"] || 0) + (client.by_status["Expired"] || 0);

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href={href.home()}>{PROJECT.name}</a>
        <span aria-hidden="true">/</span>
        <a href={href.contracts()}>Contracts</a>
        <span aria-hidden="true">/</span>
        <a href={href.group("geo", client.continent)}>{client.continent}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{client.name}</span>
      </nav>

      <div className="page-head client-head">
        <div>
          <h2 className="page-title">{client.name}</h2>
          <p className="sub">
            {client.country} · {client.size} · {client.contract_count} {client.contract_count === 1 ? "contract" : "contracts"}
            {attention > 0 && <span className="warn"> · {attention} need attention</span>}
          </p>
        </div>
        <div className="head-legend">
          <Legend by={client.by_status} />
        </div>
      </div>

      <div className="page-tabs" role="tablist" aria-label="Client views">
        {TABS.map(([key, label]) => (
          <a key={key} role="tab" aria-selected={tab === key} href={href.client(clientId, key)}>
            {label}
          </a>
        ))}
      </div>

      {tab === "ptrs" && <PtrTab key={`ptrs-${clientId}`} clientId={clientId} />}
      {tab === "invoices" && <InvoicesTab key={`invoices-${clientId}`} clientId={clientId} />}
      {tab === "contracts" && <ContractsTab key={`contracts-${clientId}`} client={client} />}

      <ChatWidget key={`chat-${clientId}`} scope="client" clientId={clientId} clientName={client.name} />
    </>
  );
}
