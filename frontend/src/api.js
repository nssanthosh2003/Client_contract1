async function request(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail || detail;
    } catch {
      /* not JSON */
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json();
}

export const api = {
  contracts: (filters) => {
    const p = new URLSearchParams();
    if (filters.q) p.set("q", filters.q);
    if (filters.status) p.set("status", filters.status);
    if (filters.type) p.set("type", filters.type);
    if (filters.clientId) p.set("client_id", filters.clientId);
    if (filters.review) p.set("review", "true");
    p.set("sort", filters.sort);
    p.set("order", filters.order);
    return request(`/api/contracts?${p}`);
  },
  contract: (id) => request(`/api/contracts/${id}`),
  stats: (clientId) => request(`/api/stats${clientId ? `?client_id=${clientId}` : ""}`),
  facets: (clientId) => request(`/api/facets${clientId ? `?client_id=${clientId}` : ""}`),
  clients: () => request("/api/clients"),
  client: (id) => request(`/api/clients/${id}`),
  project: (id) => request(`/api/clients/${id}/project`),
  ptrs: (id) => request(`/api/clients/${id}/ptrs`),
  invoices: (id) => request(`/api/clients/${id}/invoices`),
  chat: (body) => request("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  health: () => request("/api/health"),
  scan: () => request("/api/scan", { method: "POST" }),
  reprocess: (id) => request(`/api/contracts/${id}/reprocess`, { method: "POST" }),
  upload: (file, client) => {
    const body = new FormData();
    body.append("file", file);
    if (client) body.append("client", client);
    return request("/api/upload", { method: "POST", body });
  },
  fileUrl: (id) => `/api/contracts/${id}/file`,
};
