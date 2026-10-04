import { applyI18n, getLang, setLang, L } from "./i18n.js";
import { $, $$, destroyCharts, errorBox } from "./ui.js";
import { api } from "./api.js";
import dashboard from "./pages/dashboard.js";
import { recommendPage, resultPage } from "./pages/recommend.js";
import { mapTool, shelfTool } from "./pages/tools.js";
import { materialsPage, commoditiesPage } from "./pages/catalog.js";
import { tracePage, ledgerPage, verifyPage, verifyReportPage } from "./pages/trace.js";
import { aiPage, historyPage, aboutPage } from "./pages/insight.js";
import helpPage from "./pages/help.js";

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
  [/^\/help$/, helpPage],
];

export function navigate(path, replace = false) {
  if (replace) history.replaceState({}, "", path); else history.pushState({}, "", path);
  render();
}
window.packaiNavigate = navigate;

function markActive(path) {
  $$(".menu a").forEach(a => {
    const href = a.getAttribute("href");
    const on = href === path || (path.startsWith("/result") && href === "/recommend") || (path.startsWith("/verify") && href === "/verify");
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  $$(".has-sub").forEach(li => li.classList.toggle("active", !!li.querySelector("a.active")));
}

function closeMenus() {
  $$(".has-sub").forEach(li => { li.classList.remove("open"); li.querySelector("button").setAttribute("aria-expanded", "false"); });
  $("#navMenu").classList.remove("open");
  $("#menuBtn").setAttribute("aria-expanded", "false");
}

async function render() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const main = $("#main");
  destroyCharts();
  closeMenus();
  markActive(path);
  applyI18n();
  const m = routes.find(([re]) => re.test(path));
  if (!m) {
    main.innerHTML = `<div class="wrap page-body"><div class="empty"><h1>${L("Page not found", "पृष्ठ नहीं मिला")}</h1><a href="/" data-link>${L("Go to home page", "मुखपृष्ठ पर जाएँ")}</a></div></div>`;
    return;
  }
  const args = path.match(m[0]).slice(1);
  try {
    await m[1](main, ...args);
    applyI18n(main);
  } catch (e) { console.error(e); errorBox(main, e); }
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  else { main.focus({ preventScroll: true }); window.scrollTo(0, 0); }
}

// ---- link interception (SPA)
document.addEventListener("click", e => {
  const a = e.target.closest("a[data-link], a[href^='/']");
  if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey || a.hasAttribute("download")) return;
  const href = a.getAttribute("href");
  if (!href || href.startsWith("/api") || href.startsWith("/docs")) return;
  e.preventDefault();
  navigate(href);
});
window.addEventListener("popstate", render);

// ---- navigation menus
$("#menuBtn").addEventListener("click", () => {
  const m = $("#navMenu"); m.classList.toggle("open");
  $("#menuBtn").setAttribute("aria-expanded", m.classList.contains("open"));
});
$$(".has-sub > button").forEach(btn => btn.addEventListener("click", e => {
  e.stopPropagation();
  const li = btn.parentElement, open = !li.classList.contains("open");
  $$(".has-sub").forEach(x => { x.classList.remove("open"); x.querySelector("button").setAttribute("aria-expanded", "false"); });
  li.classList.toggle("open", open); btn.setAttribute("aria-expanded", open);
}));
document.addEventListener("click", e => { if (!e.target.closest(".has-sub")) $$(".has-sub").forEach(x => { x.classList.remove("open"); x.querySelector("button").setAttribute("aria-expanded", "false"); }); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeMenus(); });

// ---- accessibility controls: text size, contrast
const FONT_STEPS = ["14px", "16px", "18px", "20px"];
$$("[data-font]").forEach(b => b.addEventListener("click", () => {
  const cur = getComputedStyle(document.documentElement).getPropertyValue("--fs").trim() || "16px";
  let i = Math.max(0, FONT_STEPS.indexOf(cur));
  const d = +b.dataset.font;
  i = d === 0 ? 1 : Math.min(FONT_STEPS.length - 1, Math.max(0, i + d));
  document.documentElement.style.setProperty("--fs", FONT_STEPS[i]);
  try { localStorage.setItem("packai-font", FONT_STEPS[i]); } catch {}
}));
const contrastBtn = $("#contrastBtn");
const syncContrast = () => contrastBtn.setAttribute("aria-pressed", document.documentElement.dataset.theme === "contrast");
contrastBtn.addEventListener("click", () => {
  const on = document.documentElement.dataset.theme !== "contrast";
  if (on) document.documentElement.dataset.theme = "contrast"; else delete document.documentElement.dataset.theme;
  try { localStorage.setItem("packai-theme", on ? "contrast" : "default"); } catch {}
  syncContrast(); render();
});
syncContrast();

// ---- language
const syncLang = () => $$("[data-lang]").forEach(b => b.setAttribute("aria-pressed", b.dataset.lang === getLang()));
$$("[data-lang]").forEach(b => b.addEventListener("click", () => {
  if (b.dataset.lang === getLang()) return;
  setLang(b.dataset.lang); syncLang(); render();
}));
syncLang();

// ---- header search → commodity library
$("#headerSearch").addEventListener("submit", e => {
  e.preventDefault();
  const q = $("#hq").value.trim();
  navigate(`/commodities${q ? `?q=${encodeURIComponent(q)}` : ""}`);
});

// footer visitor counter: count once per browser session
(() => {
  let fresh = true;
  try { fresh = !sessionStorage.getItem("packai-visited"); sessionStorage.setItem("packai-visited", "1"); } catch { /* ignore */ }
  api.post(`/api/visit?new=${fresh}`).then(r => { $("#visitorCount").textContent = String(r.visitors).padStart(6, "0"); }).catch(() => {});
})();
api.get("/api/health").then(h => { $("#healthDot").classList.add("ok"); $("#healthDot").title = `Service online · engine ${h.engine}`; }).catch(() => {});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
render();
