import { api } from "../api.js";
import { $, esc, fmt, days, toast, table, kv, chart, series, statusBadge } from "../ui.js";

export async function aiPage(main) {
  const info = await api.get("/api/ml/info");
  const m = info.meta;
  main.innerHTML = `<div class="page-head"><div><h1>AI model</h1>
    <p>The physics engine guarantees technical feasibility; the ML layer learns <b>industry packaging practice</b> as a function of food properties and conditions, so it generalises to new commodities and keeps improving from field feedback and uploaded lab data. Its probability becomes one TOPSIS criterion.</p></div>
    <div class="row"><button class="btn" id="rt">${info.training.running ? "Training…" : "Retrain now"}</button><a class="btn secondary" href="/api/ml/template.csv" download>CSV template</a></div></div>
  ${!m ? `<div class="callout warn">Model not trained yet — training runs automatically at first start-up.</div>` : `
  <div class="grid g4">
    <div class="card stat"><span class="l">Hold-out accuracy</span><span class="v">${fmt(m.holdout.accuracy * 100, 1)} %</span><span class="l">macro-F1 ${fmt(m.holdout.macro_f1, 3)} · top-3 ${fmt(m.holdout.top3_accuracy * 100, 0)} %</span></div>
    <div class="card stat"><span class="l">Unseen-commodity top-3</span><span class="v">${fmt(m.leave_commodity_out.top3_accuracy * 100, 1)} %</span><span class="l">top-1 ${fmt(m.leave_commodity_out.accuracy * 100, 1)} % (leave-commodity-out)</span></div>
    <div class="card stat"><span class="l">OTR / WVTR surrogate R²</span><span class="v">${fmt(m.regressors.y_otr?.r2, 3)} / ${fmt(m.regressors.y_wvtr?.r2, 3)}</span><span class="l">shelf-life R² ${fmt(m.regressors.y_life?.r2, 3)}</span></div>
    <div class="card stat"><span class="l">Training samples</span><span class="v">${fmt(m.n_samples, 0)}</span><span class="l">${m.n_user_samples} from users · ${m.n_classes} classes · ${m.n_features} features</span></div>
  </div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Feature importance (top 15)</h3><div class="chart-box tall"><canvas id="fi"></canvas></div></div>
    <div class="card"><h3>Class distribution</h3><div class="chart-box tall"><canvas id="cd"></canvas></div></div>
  </div>
  <div class="card"><h3>Model card</h3>${kv({
    "Algorithm": `${esc(m.classifier.algorithm)} · ${m.classifier.n_estimators} trees · min leaf ${m.classifier.min_samples_leaf} · class weight ${esc(m.classifier.class_weight)}`,
    "Version / trained": `${esc(m.version)} · ${esc(m.trained_at)} (${m.train_seconds} s)`,
    "Label source": "First industry-practice family (curated from IIP / APEDA / FSSAI / retail audits) that the physics engine finds feasible for each Monte-Carlo scenario; 25 % secondary-practice labels model market diversity.",
    "Validation": "Stratified 80/20 hold-out + GroupShuffleSplit leave-commodity-out (20 % of commodities never seen in training).",
    "Held-out commodities": esc((m.leave_commodity_out.held_out_commodities || []).join(", ")),
    "Limitations": "Labels are expert-distilled, not measured outcomes; field feedback (weight ×3) and uploaded lab datasets progressively replace them.",
  })}</div>`}
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Upload lab / company dataset</h3><p class="muted">CSV with the feature columns (see template) and a <span class="mono">label</span> column containing a packaging family id.</p>
      <form id="up" class="row"><input type="file" name="file" accept=".csv" required><button class="btn sm">Upload</button></form>
      <p class="muted" style="margin-top:8px">User rows stored: ${info.user_training_rows} · feedback received: ${info.feedback_count}</p>
      <details><summary>Family ids</summary><ul class="clean">${Object.entries(info.families).map(([k, v]) => `<li><span class="mono">${k}</span> — ${esc(v)}</li>`).join("")}</ul></details></div>
    <div class="card"><h3>Recent field feedback</h3><div id="fb"></div></div>
  </div>`;
  if (m) {
    const S = series();
    const fi = m.feature_importance.slice(0, 15);
    chart($("#fi"), { type: "bar", data: { labels: fi.map(f => f.feature), datasets: [{ data: fi.map(f => f.importance), backgroundColor: S[0], borderRadius: 4, maxBarThickness: 18 }] },
      options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { title: { text: "Gini importance" } }, y: { grid: { display: false }, ticks: { autoSkip: false } } } } });
    const cd = Object.entries(m.class_distribution).sort((a, b) => b[1] - a[1]);
    chart($("#cd"), { type: "bar", data: { labels: cd.map(c => info.families[c[0]] || c[0]), datasets: [{ data: cd.map(c => c[1]), backgroundColor: S[0], borderRadius: 4, maxBarThickness: 18 }] },
      options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { title: { text: "Samples" } }, y: { grid: { display: false }, ticks: { autoSkip: false } } } } });
  }
  const fb = await api.get("/api/ml/feedback");
  $("#fb").innerHTML = table([{ label: "Report", render: f => `<a href="/result/${f.rec_id}" data-link>${f.rec_id}</a>` }, { label: "Solution", key: "solution_id" },
    { label: "Rating", num: true, key: "rating" }, { label: "Observed", num: true, render: f => days(f.observed_days) }], fb, { maxh: 300 });
  $("#rt").addEventListener("click", async () => {
    const r = await api.post("/api/ml/retrain"); toast(r.started ? "Retraining started (≈10 s)…" : r.message);
    if (r.started) setTimeout(() => aiPage(main), 12000);
  });
  $("#up").addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try { const r = await api.post("/api/ml/upload", fd); toast(`${r.rows_added} rows added — retrain to use them`); } catch (err) { toast(err.message); }
  });
}

export async function historyPage(main) {
  const list = await api.get("/api/recommendations?limit=200");
  main.innerHTML = `<div class="page-head"><div><h1>Recommendation history</h1><p>All generated reports on this server.</p></div></div>
    <div class="card">${table([
      { label: "ID", render: r => `<a class="mono" href="/result/${r.id}" data-link>${r.id}</a>` },
      { label: "Date", render: r => new Date(r.created_at + "Z").toLocaleString() },
      { label: "Commodity", render: r => esc(r.commodity) },
      { label: "Top solution", render: r => esc(r.top_solution_name || r.top_solution || "–") },
      { label: "Shelf life", num: true, render: r => days(r.predicted_days) },
      { label: "PackChain", render: r => r.certified ? statusBadge("good", "certified") : "" },
      { label: "", render: r => `<a href="/api/recommendations/${r.id}/report.pdf" target="_blank" rel="noopener">PDF</a>` }], list)}</div>`;
}

export async function aboutPage(main) {
  main.innerHTML = `<div class="page-head"><div><h1>Methodology</h1><p>How PackAI turns food properties into a packaging specification. Every number in a report can be traced to one of these models.</p></div></div>
  <div class="stack">
  <div class="card"><h2>1 · Hybrid architecture</h2><p>Knowledge base (96 commodities, 38 packaging structures built from 20 base polymers) → requirement derivation → candidate filtering (hard constraints) → per-candidate optimisation (gauge, sealant, perforations, gas technique) → mechanistic shelf-life simulation → ML industry-practice prior → TOPSIS multi-criteria ranking → explainable report → blockchain certification & traceability.</p></div>
  <div class="card"><h2>2 · Barrier physics</h2>
    <p>Permeation through homogeneous films scales inversely with thickness (Fick); laminates add resistances in series. Temperature follows Arrhenius; hydrophilic barriers (EVOH, PA, cellulose) are plasticised by humidity.</p>
    <div class="formula">OTR(L,T) = OTR_ref · (L_ref / L) · exp[−Ea/R · (1/T − 1/296 K)] · (1 + k_RH · x²)
1/OTR_laminate = Σ 1/OTR_i          (same for WVTR and CO₂TR)</div></div>
  <div class="card"><h2>3 · Oxygen-limited shelf life</h2>
    <div class="formula">t_ox = (tol_T · W − V_hs · y_O₂ · 1.429) / (OTR_T · A · 0.209 · 1.429),   t_ox ≥ t_air(T)
Required OTR = allowed O₂ / (A · t_target · 0.209 · 1.429)</div>
    <p>tol = oxygen absorbable before rancidity/flavour loss (calibrated to commercial references); headspace O₂ set by N₂ flushing or scavengers; light exposure divides life by 1 + 3·s·(1 − light block).</p></div>
  <div class="card"><h2>4 · Moisture: Labuza linear-isotherm model</h2>
    <div class="formula">t = (W_dry · b) / (K · A · p₀) · ln[(m_e − m_i) / (m_e − m_c)],   m = b·aw + c</div>
    <p>K = water-vapour permeance from WVTR at 38 °C / 90 % RH; m_c from the critical water activity (loss of crispness, caking). Moist and frozen foods use the drying / sublimation analogue with a maximum acceptable weight loss.</p></div>
  <div class="card"><h2>5 · Fresh produce: respiration & passive MAP</h2>
    <div class="formula">RR(O₂,CO₂) = Vm · O₂ / (Km + O₂ · (1 + CO₂/Ki))           (Michaelis-Menten, uncompetitive CO₂ inhibition)
Steady state:  (P_O₂·A/L + n·F_h)·(0.209 − y_O₂) = RR · W
               (P_CO₂·A/L + n·F_h,CO₂)·y_CO₂ = RQ · RR · W
F_h = D_gas · π r² / (L + r)                              (Fishman et al. 1996 micro-perforation model)</div>
    <p>Perforation count and diameter are solved to place the equilibrium inside Kader's recommended O₂/CO₂ window; senescence life scales with the reduced respiration rate, penalised for anaerobiosis, CO₂ injury and chilling injury. Open packs use transpiration coefficients (weight loss).</p></div>
  <div class="card"><h2>6 · Microbial, insect & frozen quality</h2>
    <div class="formula">Ratkowsky:  L(T) = L_ref · [(T_ref − T_min)/(T − T_min)]²      MAP/vacuum × benefit factor
Q10:        L(T) = L_ref · Q10^((T_ref − T)/10)
Transport:  L_total = t_transit + (1 − t_transit/L(T_transit)) · L(T_storage)</div>
    <p>Grains: hermetic packs (OTR ≤ 10) suppress insects by O₂ depletion; otherwise infestation limits storage. Batches on PackChain reuse the same kinetics with logged temperatures for dynamic remaining shelf life.</p></div>
  <div class="card"><h2>7 · Ranking</h2><p>Criteria: technical score (target attainment, over-packaging penalty, watch-outs), ML practice probability, sustainability (recyclability, carbon per kg food, material efficiency, bio-based) and cost per kg product. TOPSIS closeness is blended with a weighted sum; weights depend on the chosen priority (balanced / performance / cost / eco).</p></div>
  <div class="card"><h2>8 · PackChain</h2><p>Ed25519-signed transactions, SHA-256 Merkle trees, proof-of-work blocks, full-chain validation, Merkle inclusion proofs for QR verification, spec-hash binding of each batch to its packaging design, and optional anchoring to Polygon through the <span class="mono">PackChainAnchor</span> Solidity contract.</p></div>
  <div class="card"><h2>References</h2><ul class="clean">
    <li>Robertson G.L. (2013) <i>Food Packaging: Principles and Practice</i>, 3rd ed., CRC Press.</li>
    <li>Kader A.A. (2002) <i>Postharvest Technology of Horticultural Crops</i>, UC ANR 3311; Saltveit M.E. (2003) CA recommendations.</li>
    <li>Fishman S., Rodov V., Ben-Yehoshua S. (1996) Mathematical model for perforation effect on oxygen and water vapour dynamics in MAP. <i>J. Food Sci.</i> 61:956.</li>
    <li>Fonseca S.C., Oliveira F.A.R., Brecht J.K. (2002) Modelling respiration rate of fresh fruits and vegetables for MAP. <i>J. Food Eng.</i> 52:99.</li>
    <li>Mangaraj S., Goswami T.K., Mahajan P.V. (2009) Applications of plastic films for MAP of fruits and vegetables: a review. <i>Food Eng. Rev.</i> 1:133.</li>
    <li>Labuza T.P., Mizrahi S., Karel M. (1972) Mathematical models for optimization of flexible film packaging of foods for storage. <i>Trans. ASAE</i> 15:150.</li>
    <li>Ratkowsky D.A. et al. (1982) Relationship between temperature and growth rate of bacterial cultures. <i>J. Bacteriol.</i> 149:1.</li>
    <li>Siracusa V. (2012) Food packaging permeability behaviour: a report. <i>Int. J. Polym. Sci.</i></li>
    <li>Hwang C.L., Yoon K. (1981) <i>Multiple Attribute Decision Making</i> (TOPSIS).</li>
    <li>FSSAI Food Safety and Standards (Packaging) Regulations 2018; FSS (Labelling & Display) Regulations 2020; Plastic Waste Management (Amendment) Rules 2022 & EPR Guidelines; Legal Metrology (Packaged Commodities) Rules 2011; Jute Packaging Materials Act 1987.</li>
    <li>Poore J., Nemecek T. (2018) Reducing food's environmental impacts through producers and consumers. <i>Science</i> 360:987.</li>
  </ul></div></div>`;
}
