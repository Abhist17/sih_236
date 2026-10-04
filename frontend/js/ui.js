// Shared UI helpers
import { L } from "./i18n.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function fmt(v, d = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  if (typeof v !== "number") return esc(v);
  const a = Math.abs(v);
  if (a >= 10000) return v.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  if (a > 0 && a < 0.01) return v.toExponential(1);
  if (a >= 100) d = 0; else if (a >= 10) d = Math.min(d, 1);
  return v.toLocaleString("en-IN", { maximumFractionDigits: d });
}
export function days(v) {
  if (v === null || v === undefined) return "–";
  if (v > 3650) return L("> 10 years", "> 10 वर्ष");
  if (v >= 730) return `${fmt(v / 365, 1)} ${L("years", "वर्ष")}`;
  return `${fmt(v, v < 10 ? 1 : 0)} ${L("days", "दिन")}`;
}
export const inr = v => (v === null || v === undefined) ? "–" : "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: v < 100 ? 2 : 0 });
export function toast(msg, ms = 3000) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), ms);
}
export function loading(el, text) { el.innerHTML = `<div class="loading"><span class="spinner"></span>${esc(text || L("Loading…", "लोड हो रहा है…"))}</div>`; }
export function errorBox(el, e) { el.innerHTML = `<div class="wrap page-body"><div class="callout crit">⚠ ${esc(e.message || e)}</div></div>`; }
export function statusBadge(level, text) {
  const icon = { good: "✓", warn: "⚠", crit: "✕", brand: "●" }[level] || "";
  return `<span class="badge ${level}">${icon} ${esc(text)}</span>`;
}
export function scoreBar(v, max = 100) {
  return `<div class="bar" role="img" aria-label="${fmt(v)} / ${max}"><i style="width:${Math.max(0, Math.min(100, v / max * 100))}%"></i></div>`;
}
export function kv(obj) {
  return `<dl class="kv">${Object.entries(obj).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v ?? "–"}</dd>`).join("")}</dl>`;
}
export function table(cols, rows, opts = {}) {
  return `<div class="table-wrap"${opts.maxh ? ` style="max-height:${opts.maxh}px"` : ""}><table><thead><tr>${cols.map(c => `<th class="${c.num ? "num" : ""}" scope="col">${esc(c.label)}</th>`).join("")}</tr></thead><tbody>${
    rows.length ? rows.map(r => `<tr>${cols.map(c => `<td class="${c.num ? "num" : ""}">${c.render ? c.render(r) : esc(r[c.key])}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${cols.length}" class="empty">${L("No data yet", "अभी कोई डेटा नहीं")}</td></tr>`}</tbody></table></div>`;
}

// Government-style page banner with breadcrumb
export function pageHead({ title, desc = "", crumbs = [], actions = "" }) {
  const trail = [[L("Home", "मुखपृष्ठ"), "/"], ...crumbs];
  return `<section class="page-banner"><div class="wrap">
    <nav aria-label="${L("Breadcrumb", "ब्रेडक्रम्ब")}"><ol class="crumbs">${trail.map(([t, h]) => `<li>${h ? `<a href="${h}" data-link>${esc(t)}</a>` : esc(t)}</li>`).join("")}<li aria-current="page">${esc(title)}</li></ol></nav>
    <h1>${esc(title)}</h1>
    ${desc ? `<p>${desc}</p>` : ""}
    ${actions ? `<div class="page-actions">${actions}</div>` : ""}
  </div></section>`;
}

// Minimal line-icon set (inline SVG, inherits currentColor)
const P = {
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19l7-7"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  gas: '<circle cx="8" cy="15" r="3"/><circle cx="16" cy="9" r="3"/><circle cx="17" cy="17" r="2"/><circle cx="7" cy="6" r="2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7.5 15h9"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2"/>',
  chain: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><circle cx="12" cy="17.5" r=".6"/>',
  farmer: '<circle cx="12" cy="7" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3"/><path d="M5 7h14"/>',
  factory: '<path d="M3 21V10l6 3V10l6 3V6h6v15z"/><path d="M7 17h2M12 17h2M17 17h2"/>',
  lab: '<path d="M9 3v6L4 19a1.5 1.5 0 0 0 1.3 2h13.4A1.5 1.5 0 0 0 20 19l-5-10V3"/><path d="M8 3h8"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h11L21 7H6"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r=".6"/>',
  doc: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
  thermo: '<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/>',
  truck: '<path d="M2 6h11v10H2zM13 10h4l4 4v2h-8"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 8v4l3 2"/>',
  ai: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
};
export function icon(name, size = 22) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.leaf}</svg>`;
}

// ---------------------------------------------------------------- charts (Chart.js)
const charts = new Set();
export function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
export const series = () => [css("--series-1"), css("--series-2"), css("--series-3"), css("--series-4")];
export function destroyCharts() { charts.forEach(c => c.destroy()); charts.clear(); }
export function chart(canvas, cfg) {
  if (!window.Chart || !canvas) return null;
  const text2 = css("--text-2"), grid = css("--grid");
  Chart.defaults.font.family = css("--font");
  Chart.defaults.color = text2;
  const base = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    interaction: { mode: "nearest", intersect: false },
    plugins: {
      legend: { labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, color: text2 } },
      tooltip: { backgroundColor: css("--navy") || "#0b2e59", titleColor: "#fff", bodyColor: "#fff", padding: 10, cornerRadius: 8 },
    },
    scales: {},
  };
  cfg.options = deepMerge(base, cfg.options || {});
  for (const k of Object.keys(cfg.options.scales || {})) {
    const s = cfg.options.scales[k];
    s.grid = { color: grid, drawTicks: false, ...(s.grid || {}) };
    s.border = { display: false, ...(s.border || {}) };
    s.ticks = { color: text2, padding: 6, ...(s.ticks || {}) };
    if (s.title) s.title = { display: true, color: text2, ...s.title };
  }
  const c = new Chart(canvas, cfg);
  charts.add(c);
  return c;
}
function deepMerge(a, b) {
  const o = { ...a };
  for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" ? deepMerge(a[k], v) : v;
  return o;
}
