import { applyI18n, getLang, toggleLang } from "./i18n.js";
import { $, $$, destroyCharts, errorBox } from "./ui.js";
import { api } from "./api.js";
import dashboard from "./pages/dashboard.js";
import { recommendPage, resultPage } from "./pages/recommend.js";
import { mapTool, shelfTool } from "./pages/tools.js";
import { materialsPage, commoditiesPage } from "./pages/catalog.js";
import { tracePage, ledgerPage, verifyPage, verifyReportPage } from "./pages/trace.js";
import { aiPage, historyPage, aboutPage } from "./pages/insight.js";

const routes = [
  [/^\/$/, dashboard],
  [/^\/recommend$/, recommendPage],
  [/^\/result\/([\w-]+)$/, resultPage],
  [/^\/tools\/map$/, mapTool],
  [/^\/tools\/shelf-life$/, shelfTool],
  [/^\/materials$/, materialsPage],
  [/^\/commodities$/, commoditiesPage],
  [/^\/trace$/, tracePage],
  [/^\/ledger$/, ledgerPage],
  [/^\/verify(?:\/([\w-]+))?$/, verifyPage],
  [/^\/verify-report\/([\w-]+)$/, verifyReportPage],
  [/^\/ai$/, aiPage],
  [/^\/history$/, historyPage],
  [/^\/about$/, aboutPage],
];

export function navigate(path, replace = false) {
  if (replace) history.replaceState({}, "", path); else history.pushState({}, "", path);
  render();
}
window.packaiNavigate = navigate;

async function render() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const main = $("#main");
  destroyCharts();
  $$(".nav a").forEach(a => a.classList.toggle("active", a.getAttribute("href") === path || (path.startsWith("/result") && a.getAttribute("href") === "/recommend")));
  $("#sidebar").classList.remove("open");
  const m = routes.find(([re]) => re.test(path));
  if (!m) { main.innerHTML = `<div class="empty"><h1>Page not found</h1><a href="/" data-link>Go home</a></div>`; return; }
  const args = path.match(m[0]).slice(1);
  try {
    await m[1](main, ...args);
    applyI18n(main);
  } catch (e) { console.error(e); errorBox(main, e); }
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

document.addEventListener("click", e => {
  const a = e.target.closest("a[data-link], a[href^='/']");
  if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey || a.hasAttribute("download")) return;
  const href = a.getAttribute("href");
  if (!href || href.startsWith("/api") || href.startsWith("/docs")) return;
  e.preventDefault(); navigate(href);
});
window.addEventListener("popstate", render);

$("#menuBtn").addEventListener("click", () => {
  const s = $("#sidebar"); s.classList.toggle("open");
  $("#menuBtn").setAttribute("aria-expanded", s.classList.contains("open"));
});
$("#themeBtn").addEventListener("click", () => {
  const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("packai-theme", next); } catch {}
  render();
});
const langBtn = $("#langBtn");
const setLangLabel = () => { langBtn.textContent = getLang() === "hi" ? "English" : "हिन्दी"; };
langBtn.addEventListener("click", () => { toggleLang(); setLangLabel(); applyI18n(); render(); });
setLangLabel();
applyI18n();
api.get("/api/health").then(h => { $("#healthDot").classList.add("ok"); $("#healthDot").title = `API ok · engine ${h.engine} · ML ${h.ml_model ? "loaded" : "training"}`; }).catch(() => {});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
render();
