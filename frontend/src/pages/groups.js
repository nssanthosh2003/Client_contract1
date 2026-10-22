import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";

export const CONTINENTS = ["Africa", "Asia", "Europe", "North America", "Oceania", "South America"];
export const SIZES = ["Enterprise", "Large", "Mid-size", "Small"];

export const FIELD = { geo: "continent", size: "size" };
export const KEYS = { geo: CONTINENTS, size: SIZES };

/** Every group is returned, including empty ones, so the continents/sizes always read as a complete set. */
export function buildGroups(clients, by) {
  return KEYS[by].map((key) => {
    const members = clients.filter((c) => c[FIELD[by]] === key);
    const by_status = {};
    members.forEach((c) => Object.entries(c.by_status).forEach(([k, n]) => (by_status[k] = (by_status[k] || 0) + n)));
    return {
      key,
      members,
      by_status,
      contract_count: members.reduce((n, c) => n + c.contract_count, 0),
      attention: (by_status["Expiring Soon"] || 0) + (by_status["Expired"] || 0),
    };
  });
}

export function useClients(pollMs = 6000) {
  const [clients, setClients] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    api.clients().then((d) => (setClients(d), setError(""))).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [load, pollMs]);
  return { clients, error, reload: load };
}
