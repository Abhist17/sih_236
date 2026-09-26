// Shared UI helpers
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
  if (v > 3650) return "> 10 yr";
  if (v >= 730) return `${fmt(v / 365, 1)} yr`;
  return `${fmt(v, v < 10 ? 1 : 0)} d`;
}
export const inr = v => (v === null || v === undefined) ? "–" : "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: v < 100 ? 2 : 0 });
export function toast(msg, ms = 2800) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), ms);
}
export function loading(el, text = "Working…") { el.innerHTML = `<div class="loading"><span class="spinner"></span>${esc(text)}</div>`; }
export function errorBox(el, e) { el.innerHTML = `<div class="callout crit">⚠ ${esc(e.message || e)}</div>`; }
export function statusBadge(level, text) {
  const icon = { good: "✓", warn: "⚠", crit: "✕", brand: "●" }[level] || "";
  return `<span class="badge ${level}">${icon} ${esc(text)}</span>`;
}
export function scoreBar(v, max = 100) {
  return `<div class="bar" role="img" aria-label="${fmt(v)} of ${max}"><i style="width:${Math.max(0, Math.min(100, v / max * 100))}%"></i></div>`;
}
export function kv(obj) {
  return `<dl class="kv">${Object.entries(obj).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v ?? "–"}</dd>`).join("")}</dl>`;
}
export function table(cols, rows, opts = {}) {
  return `<div class="table-wrap"${opts.maxh ? ` style="max-height:${opts.maxh}px"` : ""}><table><thead><tr>${cols.map(c => `<th class="${c.num ? "num" : ""}">${esc(c.label)}</th>`).join("")}</tr></thead><tbody>${
    rows.length ? rows.map(r => `<tr>${cols.map(c => `<td class="${c.num ? "num" : ""}">${c.render ? c.render(r) : esc(r[c.key])}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${cols.length}" class="empty">No data</td></tr>`}</tbody></table></div>`;
}

// ---------------------------------------------------------------- charts (Chart.js)
const charts = new Set();
export function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
export const series = () => [css("--series-1"), css("--series-2"), css("--series-3"), css("--series-4")];
export function destroyCharts() { charts.forEach(c => c.destroy()); charts.clear(); }
export function chart(canvas, cfg) {
  if (!window.Chart) return null;
  const text2 = css("--text-2"), grid = css("--grid");
  Chart.defaults.font.family = css("--font");
  Chart.defaults.color = text2;
  const base = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    interaction: { mode: "nearest", intersect: false },
    plugins: {
      legend: { labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, color: text2 } },
      tooltip: { backgroundColor: css("--text"), titleColor: css("--bg"), bodyColor: css("--bg"), padding: 10, cornerRadius: 8 },
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
export function download(name, text, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
