import { api } from "../api.js";
import { esc, fmt, days, table } from "../ui.js";

export default async function dashboard(main) {
  main.innerHTML = `
  <section class="hero">
    <div>
      <h1>Right package. Longer shelf life. Less waste.</h1>
      <p>PackAI recommends the optimal packaging material, structure and specification (OTR, WVTR, thickness, sealing, MAP gas mix) for any food commodity — using food-science physics, machine learning and blockchain traceability.</p>
      <div class="row"><a class="btn" href="/recommend" data-link>Start a recommendation</a>
        <a class="btn secondary" href="/tools/map" data-link>Design a MAP pack</a></div>
    </div>
    <div class="steps">
      <div>Describe the food — composition, respiration, storage, transport and target shelf life.</div>
      <div>Physics engine derives O₂ / water-vapour / light requirements and simulates shelf life for ~40 structures.</div>
      <div>AI + TOPSIS ranks options by performance, cost, sustainability and industry practice.</div>
      <div>Certify the report and track packed batches with QR codes on PackChain.</div>
    </div>
  </section>
  <div id="dash" style="margin-top:18px"><div class="loading"><span class="spinner"></span>Loading…</div></div>`;
  const s = await api.get("/api/stats");
  const el = main.querySelector("#dash");
  el.innerHTML = `
  <div class="grid g4">
    <div class="card stat"><span class="l">Commodities in knowledge base</span><span class="v">${s.knowledge_base.commodities}</span><span class="l">fruits · dairy · meat · grains · snacks…</span></div>
    <div class="card stat"><span class="l">Packaging structures</span><span class="v">${s.knowledge_base.packaging_solutions}</span><span class="l">${s.knowledge_base.families} material families</span></div>
    <div class="card stat"><span class="l">Recommendations generated</span><span class="v">${s.recommendations}</span><span class="l">${s.certified} certified on PackChain</span></div>
    <div class="card stat"><span class="l">Traceable batches</span><span class="v">${s.batches}</span><span class="l">${s.blocks} blocks · ${s.transactions} signed tx · ${s.actors} actors</span></div>
  </div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Recent recommendations</h3>
      ${s.recent.length ? table([
        { label: "Commodity", render: r => `<a href="/result/${r.id}" data-link>${esc(r.commodity)}</a>` },
        { label: "Top solution", render: r => esc(r.top_solution || "–") },
        { label: "Shelf life", num: true, render: r => days(r.predicted_days) },
        { label: "", render: r => r.certified ? '<span class="badge good">✓ certified</span>' : "" }], s.recent)
        : `<div class="empty">No recommendations yet. <a href="/recommend" data-link>Create the first one →</a></div>`}</div>
    <div class="card"><h3>AI model status</h3>
      ${s.ml.available ? `<dl class="kv"><dt>Model version</dt><dd>${esc(s.ml.version)}</dd>
        <dt>Hold-out accuracy</dt><dd>${fmt(s.ml.holdout_accuracy * 100, 1)} %</dd>
        <dt>Top-3 accuracy on unseen commodities</dt><dd>${fmt(s.ml.top3_unseen * 100, 1)} %</dd></dl>
        <p class="muted" style="margin-top:8px">Random-Forest trained on a knowledge-distilled industry-practice corpus + field feedback. <a href="/ai" data-link>Details →</a></p>`
        : `<p class="muted">Model is training in the background…</p>`}
      <h3 style="margin-top:14px">Most recommended families</h3>
      <ul class="clean">${s.top_families.map(([f, n]) => `<li>${esc(f)} <span class="badge">${n}</span></li>`).join("") || "<li class='muted'>–</li>"}</ul>
    </div>
  </div>
  <div class="grid g3" style="margin-top:16px">
    <a class="card" href="/tools/shelf-life" data-link style="text-decoration:none;color:inherit"><h3>⏱ Shelf-life simulator</h3><p class="muted">Compare packages across storage temperatures; see which mechanism limits life.</p></a>
    <a class="card" href="/materials" data-link style="text-decoration:none;color:inherit"><h3>🧪 Barrier map</h3><p class="muted">OTR vs WVTR of every film, laminate and container with cost, CO₂ and recyclability.</p></a>
    <a class="card" href="/verify" data-link style="text-decoration:none;color:inherit"><h3>🔍 Scan & verify</h3><p class="muted">Consumers and buyers verify origin, packaging spec and cold-chain history from the QR.</p></a>
  </div>`;
}
