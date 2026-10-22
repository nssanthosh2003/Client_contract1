import { useEffect, useState } from "react";

/**
 * Hash routes:
 *   #/                                 home: TCS AgentAssist platform showcase
 *   #/contracts or #/contracts/geo    contract management: airline portfolio
 *   #/contracts/size                  contract management, grouped by size
 *   #/geo/Europe                      clients in a continent
 *   #/client/3/ptrs | invoices | contracts
 */
export function parseRoute(hash) {
  // Client tabs
  const c = hash.match(/^#\/client\/(\d+)(?:\/(ptrs|invoices|contracts|project))?\/?$/);
  if (c) {
    const tab = c[2] === "invoices" ? "invoices" : c[2] === "contracts" ? "contracts" : "ptrs";
    return { page: "client", clientId: Number(c[1]), tab };
  }

  // Contract management grouped by continent/size with a specific group selected
  const gContracts = hash.match(/^#\/contracts\/(geo|size)\/([^/]+)\/?$/);
  if (gContracts) {
    return { page: "group", by: gContracts[1], group: decodeURIComponent(gContracts[2]) };
  }

  // Group page: #/geo/Europe or #/size/Enterprise
  const g = hash.match(/^#\/(geo|size)\/([^/]+)\/?$/);
  if (g) {
    return { page: "group", by: g[1], group: decodeURIComponent(g[2]) };
  }

  // Contract management page: #/contracts or #/contracts/geo or #/contracts/size (or legacy #/geo, #/size)
  const contractsMatch = hash.match(/^#\/(?:contracts(?:\/(geo|size))?|(geo|size))\/?$/);
  if (contractsMatch) {
    const by = contractsMatch[1] || contractsMatch[2] || "geo";
    return { page: "contracts", by };
  }

  // Default: Main page (TCS AgentAssist)
  return { page: "home" };
}

export const href = {
  home: () => `#/`,
  contracts: (by = "geo") => `#/contracts/${by}`,
  landing: () => `#/`,
  group: (by, key) => `#/${by}/${encodeURIComponent(key)}`,
  client: (id, tab = "ptrs") => `#/client/${id}/${tab}`,
};

export function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export const go = (to) => {
  window.location.hash = to;
};
