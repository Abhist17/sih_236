// Offline-first app shell; API calls always go to the network (fresh data).
const CACHE = "packai-v2";
const SHELL = ["/", "/css/app.css", "/js/app.js", "/js/api.js", "/js/ui.js", "/js/i18n.js", "/js/pages/dashboard.js",
  "/js/pages/recommend.js", "/js/pages/tools.js", "/js/pages/catalog.js", "/js/pages/trace.js", "/js/pages/insight.js", "/js/pages/help.js",
  "/vendor/chart.umd.min.js", "/icons/icon.svg", "/manifest.webmanifest"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.pathname.startsWith("/api") || url.pathname.startsWith("/docs")) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match("/"))));
});
