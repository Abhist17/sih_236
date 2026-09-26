// Thin JSON API client
async function req(method, url, body, headers = {}) {
  const opts = { method, headers: { ...headers } };
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
  const r = await fetch(url, opts);
  const ct = r.headers.get("content-type") || "";
  const data = ct.includes("json") ? await r.json() : await r.text();
  if (!r.ok) {
    let msg = typeof data === "string" ? data : data.detail;
    if (Array.isArray(msg)) msg = msg.map(d => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`).join("; ");
    throw new Error(msg || `HTTP ${r.status}`);
  }
  return data;
}
export const api = {
  get: (u, h) => req("GET", u, undefined, h),
  post: (u, b, h) => req("POST", u, b, h),
};

// Actor credentials for PackChain (custodial keys live on the server; API key identifies the actor)
export const actorStore = {
  list() { try { return JSON.parse(localStorage.getItem("packai-actors") || "[]"); } catch { return []; } },
  save(a) { const l = this.list().filter(x => x.actor_id !== a.actor_id); l.unshift(a); try { localStorage.setItem("packai-actors", JSON.stringify(l)); } catch {} },
  current() { const id = (() => { try { return localStorage.getItem("packai-actor"); } catch { return null; } })(); return this.list().find(a => a.actor_id === id) || this.list()[0] || null; },
  use(id) { try { localStorage.setItem("packai-actor", id); } catch {} },
  headers(a = this.current()) { return a ? { "X-Actor-Id": a.actor_id, "X-Api-Key": a.api_key } : {}; },
};
