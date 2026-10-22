export const STATUSES = ["Active", "Expiring Soon", "Expired", "Upcoming", "Unknown"];
export const statusKey = (s) => (s || "unknown").toLowerCase().replace(/\s+/g, "-");

const startOfToday = () => {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
};

export function parseISO(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function fmtDate(iso) {
  const d = parseISO(iso);
  return d ? d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Not found";
}

export function fmtMoney(value, currency, basis) {
  if (value == null) return null;
  let text;
  try {
    text = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
      notation: value >= 1e7 ? "compact" : "standard",
    }).format(value);
    if (!currency) text = text.replace(/^[^\d]+/, "");
  } catch {
    text = `${currency || ""} ${Math.round(value).toLocaleString()}`.trim();
  }
  const suffix = { annual: " / year", monthly: " / month" }[basis] || "";
  return text + suffix;
}

const SMALL = new Set(["of", "and", "the", "for", "to", "a", "an", "in", "on"]);
const ACRONYMS = { saas: "SaaS", sow: "SOW", nda: "NDA", msa: "MSA", sla: "SLA", dpa: "DPA", gdpr: "GDPR", llc: "LLC", ip: "IP" };
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

/** Titles are often printed in ALL CAPS on the PDF; show them in readable title case. */
export function prettyTitle(title, fallback = "Untitled contract") {
  if (!title) return fallback;
  if (title !== title.toUpperCase()) return title;
  return title
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => {
      if (ACRONYMS[w]) return ACRONYMS[w];
      if (i > 0 && SMALL.has(w)) return w;
      return w.split("-").map((part) => ACRONYMS[part] || cap(part)).join("-");
    })
    .join(" ")
    .replace(/\bNo\.?\s*(\d+)/i, "No. $1");
}

const plural = (n, unit) => `${n} ${unit}${n === 1 ? "" : "s"}`;

export function spanText(days) {
  const n = Math.abs(days);
  if (n >= 365 * 2) return plural(Math.round(n / 365), "year");
  if (n >= 90) return plural(Math.round(n / 30), "month");
  return plural(n, "day");
}

/** One plain sentence describing where the contract is in its life. */
export function lifeText(c) {
  const today = startOfToday();
  const start = parseISO(c.start_date);
  const end = parseISO(c.end_date);
  switch (c.status) {
    case "Expired":
      return `Expired ${spanText(c.days_to_expiry)} ago`;
    case "Expiring Soon":
      return c.days_to_expiry === 0 ? "Expires today" : `Expires in ${spanText(c.days_to_expiry)}`;
    case "Upcoming":
      return start ? `Starts in ${spanText(Math.round((start - today) / 864e5))}` : "Not started";
    case "Active":
      return end ? `Ends in ${spanText(c.days_to_expiry)}` : "No end date found";
    default:
      return c.processing_status === "failed" ? "Could not be read" : "No dates found";
  }
}

/** Position of "today" within [start, end] as 0..1, plus whether it lies outside. */
export function termProgress(startIso, endIso) {
  const s = parseISO(startIso);
  const e = parseISO(endIso);
  if (!s || !e || e <= s) return null;
  const raw = (startOfToday() - s) / (e - s);
  return { pct: Math.min(1, Math.max(0, raw)), before: raw < 0, after: raw > 1 };
}

export const confLevel = (v) => (v == null ? "none" : v >= 0.75 ? "high" : v >= 0.5 ? "mid" : "low");
export const pct = (v) => `${Math.round((v || 0) * 100)}%`;
