import { api } from "../api.js";
import { t } from "../i18n.js";
import { $, $$, esc, fmt, days, inr, toast, loading, errorBox, statusBadge, scoreBar, kv, table, chart, css, series } from "../ui.js";

let COMMODITIES = null;
async function commodities() {
  if (!COMMODITIES) COMMODITIES = await api.get("/api/commodities");
  return COMMODITIES;
}

const CATS = [
  ["fruit", "Fresh fruit"], ["vegetable", "Fresh vegetable"], ["leafy", "Leafy greens"], ["fresh_cut", "Fresh-cut"],
  ["root_bulb", "Roots & bulbs"], ["dairy_liquid", "Liquid dairy"], ["dairy_fresh", "Fresh dairy"], ["dairy_fat", "Ghee & butter"],
  ["dairy_powder", "Dairy powders"], ["meat", "Meat & poultry"], ["seafood", "Seafood"], ["bakery", "Bakery"],
  ["snack", "Snacks"], ["biscuit", "Biscuits & confectionery"], ["grain", "Grains & pulses"], ["flour", "Flours"],
  ["sugar_salt", "Sugar, salt, jaggery"], ["spice", "Spices, tea, coffee"], ["dry_fruit", "Dry fruits & nuts"],
  ["dehydrated", "Dehydrated foods"], ["oil", "Edible oils"], ["sauce", "Pickles & sauces"], ["beverage", "Beverages"],
  ["rte", "Ready-to-eat"], ["frozen", "Frozen foods"], ["egg", "Eggs"], ["batter", "Batters"],
];

function field(name, label, attrs = "", hint = "") {
  return `<label class="f"><span data-i18n="f.${name}">${label}</span><input name="${name}" ${attrs}>${hint ? `<span class="hint">${hint}</span>` : ""}</label>`;
}
function select(name, label, opts, attrs = "") {
  return `<label class="f"><span data-i18n="f.${name}">${label}</span><select name="${name}" ${attrs}>${opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select></label>`;
}
function seg(name, opts, checked) {
  return `<div class="seg" role="radiogroup">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${v === checked ? "checked" : ""}><span data-i18n="p.${v}">${esc(l)}</span></label>`).join("")}</div>`;
}

export async function recommendPage(main) {
  const params = new URLSearchParams(location.search);
  main.innerHTML = `
  <div class="page-head"><div><h1 data-i18n="nav.recommend">New recommendation</h1>
    <p>Pick a commodity (properties auto-fill from the knowledge base) or describe a custom product. The engine derives barrier requirements, evaluates ~40 packaging structures and ranks them by shelf life, cost, sustainability and industry practice.</p></div></div>
  <form id="recForm" class="stack" autocomplete="off" novalidate>
    <div class="section">
      <h3 data-i18n="f.commodity">Commodity</h3>
      <div class="fields" style="grid-template-columns:2fr 1fr">
        <div class="picker">
          <label class="f"><span>Search commodity (English / हिन्दी)</span>
            <input id="cSearch" placeholder="e.g. tomato, paneer, चावल, potato chips" role="combobox" aria-expanded="false" aria-controls="cList"></label>
          <div class="picker-list" id="cList" role="listbox" hidden></div>
        </div>
        ${select("category", "Category (for custom products)", [["", "— from commodity —"], ...CATS])}
      </div>
      <input type="hidden" name="commodity_id">
      <div class="row" style="margin-top:10px"><span class="muted">Quick picks:</span><div class="chips" id="quick"></div></div>
      <p id="cInfo" class="muted" style="margin:10px 0 0"></p>
    </div>
    <div class="section">
      <h3 data-i18n="f.product">Product properties</h3>
      <div class="fields">
        ${field("name", "Product name", 'placeholder="Custom product name"')}
        ${select("state", "Physical state", [["solid", "Solid"], ["liquid", "Liquid"], ["paste", "Paste / semi-solid"], ["powder", "Powder"], ["granular", "Granular"]])}
        ${field("moisture", "Moisture (%)", 'type="number" step="0.1" min="0" max="99.9"', "wet basis")}
        ${field("fat", "Fat / oil (%)", 'type="number" step="0.1" min="0" max="100"')}
        ${field("protein", "Protein (%)", 'type="number" step="0.1" min="0" max="100"')}
        ${field("ph", "pH", 'type="number" step="0.1" min="1" max="14"')}
        ${field("aw", "Water activity (aw)", 'type="number" step="0.01" min="0.05" max="1"')}
        ${field("respiration_rate", "Resp. rate (mg CO₂/kg·h)", 'type="number" step="0.1" min="0"', "0 for non-respiring foods")}
        ${field("respiration_temp", "…measured at (°C)", 'type="number" step="0.5"')}
      </div>
    </div>
    <div class="section">
      <h3 data-i18n="f.storage">Storage &amp; distribution</h3>
      <div class="row" style="margin-bottom:12px"><span class="muted" data-i18n="f.stype">Storage type</span>
        ${seg("storage_type", [["ambient", "Ambient"], ["chilled", "Chilled"], ["frozen", "Frozen"]], "ambient")}</div>
      <div class="fields">
        ${field("storage_temp", "Storage temperature (°C)", 'type="number" step="0.5" min="-40" max="50"')}
        ${field("rh", "Relative humidity (%)", 'type="number" step="1" min="10" max="100"')}
        ${field("desired_shelf_life_days", "Desired shelf life (days)", 'type="number" step="1" min="1" max="3650" required')}
        ${select("transport", "Transport", [["local", "Local (<100 km)"], ["regional", "Regional road (100-500 km)"], ["long_road", "Long-distance road (>500 km)"], ["rail", "Rail / Kisan Rail"], ["sea_export", "Sea export"], ["air_export", "Air export"]])}
      </div>
      <div class="row" style="margin-top:10px">
        <label class="check"><input type="checkbox" name="cold_chain"><span data-i18n="f.cold">Cold chain available during transport</span></label>
        <label class="check"><input type="checkbox" name="retail_display" checked>Retail shelf display (light exposure)</label>
      </div>
    </div>
    <div class="section">
      <h3 data-i18n="f.pack">Pack details</h3>
      <div class="fields">
        ${field("net_weight_kg", "Net weight per pack (kg)", 'type="number" step="0.01" min="0.01" max="100" value="1" required')}
        ${select("process", "Processing", [["none", "None / fresh"], ["pasteurised", "Pasteurised"], ["hot_fill", "Hot-fill (85-92 °C)"], ["retort", "Retort sterilised (121 °C)"], ["aseptic", "Aseptic (UHT)"]])}
        ${field("package_area_m2", "Package area (m²)", 'type="number" step="0.001" min="0"', "optional — estimated if blank")}
        ${field("headspace_ml", "Headspace (mL)", 'type="number" step="1" min="0"', "optional")}
      </div>
    </div>
    <div class="section">
      <h3 data-i18n="f.prefs">Preferences</h3>
      <div class="row" style="margin-bottom:12px"><span class="muted" data-i18n="f.priority">Optimise for</span>
        ${seg("priority", [["balanced", "Balanced"], ["performance", "Performance"], ["cost", "Low cost"], ["eco", "Eco-friendly"]], "balanced")}</div>
      <div class="row">
        <label class="check"><input type="checkbox" name="require_transparency">Transparent pack required</label>
        <label class="check"><input type="checkbox" name="require_microwavable">Microwavable</label>
        <label class="check"><input type="checkbox" name="recyclable_only">Widely recyclable only</label>
        <label class="check"><input type="checkbox" name="compostable_only">Compostable only</label>
      </div>
      <div class="fields" style="margin-top:12px">${field("max_cost_per_pack", "Budget per pack (₹)", 'type="number" step="0.1" min="0"', "optional")}</div>
      <details style="margin-top:14px"><summary>Advanced food-science overrides</summary>
        <div class="fields" style="margin-top:12px">
          ${field("o2_tolerance", "O₂ tolerance (mg/kg)", 'type="number" step="1" min="0"', "absorbable O₂ before rancidity")}
          ${field("light_sensitivity", "Light sensitivity (0-1)", 'type="number" step="0.05" min="0" max="1"')}
          ${field("aw_critical", "Critical aw", 'type="number" step="0.01" min="0.05" max="0.99"', "texture/caking limit")}
          ${field("map_o2_min", "MAP O₂ min (%)", 'type="number" step="0.5" min="0" max="21"')}
          ${field("map_o2_max", "MAP O₂ max (%)", 'type="number" step="0.5" min="0" max="21"')}
          ${field("map_co2_min", "MAP CO₂ min (%)", 'type="number" step="0.5" min="0" max="100"')}
          ${field("map_co2_max", "MAP CO₂ max (%)", 'type="number" step="0.5" min="0" max="100"')}
        </div></details>
    </div>
    <div class="row"><button class="btn" type="submit" id="goBtn" data-i18n="f.submit">Get recommendation</button>
      <button class="btn ghost" type="reset">Reset</button><span id="formMsg" class="muted"></span></div>
  </form>`;

  const form = $("#recForm");
  const list = await commodities();
  const quick = ["tomato", "mango", "potato_chips", "paneer", "rice", "milk", "chicken", "coffee", "spinach", "ghee"];
  $("#quick").innerHTML = quick.map(id => list.find(c => c.id === id)).filter(Boolean)
    .map(c => `<button type="button" class="chip" data-id="${c.id}">${esc(c.name.split(" (")[0])}</button>`).join("");
  $("#quick").addEventListener("click", e => { const b = e.target.closest("[data-id]"); if (b) pick(b.dataset.id); });

  const input = $("#cSearch"), lb = $("#cList");
  let active = -1;
  function showList() {
    const q = input.value.trim().toLowerCase();
    const items = list.filter(c => !q || c.name.toLowerCase().includes(q) || c.id.includes(q) || (c.hi || "").includes(q)).slice(0, 40);
    lb.innerHTML = items.map((c, i) => `<button type="button" role="option" data-id="${c.id}" aria-selected="${i === active}"><span>${esc(c.name)} <small class="muted">${esc(c.hi || "")}</small></span><small class="muted">${esc(c.category_label)}</small></button>`).join("")
      + `<button type="button" data-id="__custom"><span>➕ Custom product “${esc(input.value || "…")}”</span><small class="muted">enter properties manually</small></button>`;
    lb.hidden = false; input.setAttribute("aria-expanded", "true");
  }
  input.addEventListener("input", () => { active = -1; showList(); });
  input.addEventListener("focus", showList);
  input.addEventListener("keydown", e => {
    const opts = $$("button", lb);
    if (e.key === "ArrowDown") { active = Math.min(active + 1, opts.length - 1); e.preventDefault(); }
    else if (e.key === "ArrowUp") { active = Math.max(active - 1, 0); e.preventDefault(); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); opts[active].click(); return; }
    else if (e.key === "Escape") { lb.hidden = true; return; }
    else return;
    opts.forEach((o, i) => o.setAttribute("aria-selected", i === active));
    opts[active]?.scrollIntoView({ block: "nearest" });
  });
  lb.addEventListener("click", e => { const b = e.target.closest("[data-id]"); if (b) pick(b.dataset.id); });
  document.addEventListener("click", e => { if (!e.target.closest(".picker")) { lb.hidden = true; input.setAttribute("aria-expanded", "false"); } });

  async function pick(id) {
    lb.hidden = true;
    if (id === "__custom") {
      form.commodity_id.value = "";
      form.name.value = input.value || "Custom product";
      $("#cInfo").innerHTML = "Custom product — enter composition; missing physiology is estimated from composition.";
      return;
    }
    const c = await api.get(`/api/commodities/${id}`);
    input.value = c.name;
    form.commodity_id.value = c.id;
    form.name.value = "";
    form.category.value = "";
    form.state.value = c.state;
    for (const k of ["moisture", "fat", "protein", "ph", "aw"]) form[k].value = c[k];
    form.respiration_rate.value = c.rr || 0;
    form.respiration_temp.value = c.rr ? c.t_opt : "";
    const st = c.storage;
    form.querySelector(`input[name=storage_type][value=${st}]`).checked = true;
    let temp = st === "frozen" ? -18 : (st === "chilled" || (c.rr > 0 && c.t_opt > 10)) ? c.t_opt : 30;
    form.storage_temp.value = temp;
    form.rh.value = st === "ambient" && !(c.rr > 0) ? 70 : c.rh_opt;
    form.desired_shelf_life_days.value = c.desired;
    form.cold_chain.checked = st !== "ambient";
    form.process.value = c.process || "none";
    form.transport.value = "regional";
    const typ = { snack: 0.1, biscuit: 0.2, spice: 0.2, dairy_powder: 0.5, grain: 5, flour: 5, oil: 1, dairy_liquid: 0.5, egg: 0.36, meat: 0.5, seafood: 0.5, leafy: 0.25, fresh_cut: 0.25, frozen: 0.5, rte: 0.3, bakery: 0.4, beverage: 1, sauce: 0.5, dairy_fresh: 0.2, dry_fruit: 0.25 }[c.cat];
    form.net_weight_kg.value = typ || 1;
    const facts = [];
    if (c.rr) facts.push(`respiration ${c.rr} mg CO₂/kg·h at ${c.t_opt} °C`);
    if (c.o2) facts.push(`MAP ${c.o2[0]}-${c.o2[1]} % O₂ / ${c.co2[0]}-${c.co2[1]} % CO₂`);
    if (c.chill !== null && c.chill !== undefined) facts.push(`chilling-sensitive below ${c.chill} °C`);
    if (c.o2_tol) facts.push(`oxygen-sensitive (${c.o2_tol} mg/kg)`);
    if (c.aw_c) facts.push(`critical aw ${c.aw_c}`);
    if (c.insect) facts.push("insect-prone");
    $("#cInfo").innerHTML = `<b>${esc(c.name)}</b> ${esc(c.hi || "")} · ${facts.map(esc).join(" · ") || "knowledge-base defaults loaded"}`;
  }

  form.addEventListener("change", e => {
    if (e.target.name === "storage_type") {
      const v = e.target.value;
      form.storage_temp.value = v === "frozen" ? -18 : v === "chilled" ? 4 : 30;
      form.cold_chain.checked = v !== "ambient";
    }
  });

  const from = params.get("from");
  if (from) {
    try {
      const r = await api.get(`/api/recommendations/${from}`);
      const inp = r.input || {};
      if (inp.commodity_id) await pick(inp.commodity_id);
      for (const [k, v] of Object.entries(inp)) {
        const el = form.elements[k];
        if (!el) continue;
        if (el instanceof RadioNodeList) { const r2 = form.querySelector(`input[name=${k}][value="${v}"]`); if (r2) r2.checked = true; }
        else if (el.type === "checkbox") el.checked = !!v; else el.value = v;
      }
    } catch { /* ignore */ }
  } else {
    await pick(params.get("c") || "tomato");
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = {};
    for (const [k, v] of fd.entries()) {
      if (v === "" || k === "cSearch") continue;
      body[k] = ["commodity_id", "name", "category", "state", "storage_type", "transport", "process", "priority"].includes(k) ? v : Number(v);
    }
    for (const k of ["cold_chain", "retail_display", "require_transparency", "require_microwavable", "recyclable_only", "compostable_only"]) body[k] = form[k].checked;
    if (!body.commodity_id && !body.name) { $("#formMsg").textContent = "Choose a commodity or enter a custom product name."; return; }
    if (!body.commodity_id) delete body.commodity_id;
    if (body.respiration_rate === 0) { delete body.respiration_rate; delete body.respiration_temp; if (!body.commodity_id) body.respiration_rate = 0; }
    const btn = $("#goBtn"); btn.disabled = true; $("#formMsg").innerHTML = `<span class="spinner"></span> analysing…`;
    try {
      const r = await api.post("/api/recommend", body);
      window.packaiNavigate(`/result/${r.id}`);
    } catch (err) { $("#formMsg").textContent = "⚠ " + err.message; btn.disabled = false; }
  });
}

// =========================================================================== result page

export async function resultPage(main, id) {
  loading(main, "Loading recommendation…");
  let r;
  try { r = await api.get(`/api/recommendations/${id}`); } catch (e) { return errorBox(main, e); }
  const p = r.profile, q = r.requirements, recs = r.recommendations;
  const top = recs[0];
  main.innerHTML = `
  <div class="page-head">
    <div><h1>${esc(p.name)} <small class="muted" style="font-size:.9rem">${esc(p.category_label)}</small></h1>
      <div class="row">
        <span class="badge">${esc(p.storage)} · ${fmt(p.temp)} °C · ${fmt(p.rh, 0)} % RH</span>
        <span class="badge">target ${fmt(p.desired_days, 0)} d</span>
        <span class="badge">${fmt(p.weight_kg, 3)} kg / pack</span>
        <span class="badge">${esc(p.transport.replace("_", " "))} · transit ${fmt(p.transit_temp)} °C</span>
        ${p.is_produce ? `<span class="badge brand">respiring · ${fmt(p.respiration_rate)} mg CO₂/kg·h</span>` : ""}
        <span class="badge">ID ${esc(r.id)}</span>
      </div></div>
    <div class="row">
      <a class="btn secondary" href="/api/recommendations/${r.id}/report.pdf" target="_blank" rel="noopener">⬇ PDF report</a>
      <button class="btn secondary" id="certBtn">${r.certified_tx ? "✓ Certified on PackChain" : "⛓ Certify on PackChain"}</button>
      <a class="btn" href="/trace?rec=${r.id}" data-link>Create traceable batch</a>
      <a class="btn ghost" href="/recommend?from=${r.id}" data-link>Edit inputs</a>
    </div>
  </div>
  ${(r.notes || []).map(n => `<div class="callout warn" style="margin-bottom:10px">⚠ ${esc(n)}</div>`).join("")}
  ${!recs.length ? `<div class="callout crit">No packaging solution satisfies all constraints. Relax preferences (budget, recyclable-only, transparency) or review conditions. See rejected options below.</div>` : ""}
  <div class="grid g3" style="margin-bottom:16px">
    ${top ? `<div class="card"><div class="stat"><span class="l">Best match</span><span class="v" style="font-size:1.15rem">${esc(top.name)}</span>
      <span class="l">${esc(top.specs.structure)}</span></div></div>
    <div class="card"><div class="stat"><span class="l">Predicted shelf life (best)</span><span class="v">${days(top.shelf_life.predicted_days)}</span>
      <span class="l">${top.meets_target ? statusBadge("good", "meets target") : statusBadge("warn", `${Math.round(top.shelf_life.ratio * 100)} % of target`)} · limited by ${esc((top.shelf_life.limiting_label || "").toLowerCase())}</span></div></div>
    <div class="card"><div class="stat"><span class="l">Cost & footprint (best)</span><span class="v">${inr(top.cost.per_pack_inr)}<small class="muted" style="font-size:.9rem"> /pack</small></span>
      <span class="l">${fmt(top.cost.co2e_g)} g CO₂e · eco score ${fmt(top.sustainability.score, 0)}/100</span></div></div>` : ""}
  </div>

  <div class="card"><h2>Derived packaging requirements</h2>
    <p>${esc(q.summary)}</p>
    <div class="grid g2">${kv({
      "Deterioration drivers": q.drivers.length ? q.drivers.map(d => `<span class="badge">${esc(d)}</span>`).join(" ") : "none critical",
      "Max OTR (23 °C, 0 % RH)": q.otr_max_spec !== null ? `≤ ${fmt(q.otr_max_spec, 3)} cc/m²·day · ${esc(q.otr_class)}` : esc(q.otr_class),
      "OTR window for passive MAP": q.otr_range_for_map_spec ? `${fmt(q.otr_range_for_map_spec[0], 0)} – ${fmt(q.otr_range_for_map_spec[1], 0)} cc/m²·day` : "–",
      "Ideal CO₂/O₂ selectivity (β)": q.beta_range_for_map ? `${fmt(q.beta_range_for_map[0])} – ${fmt(q.beta_range_for_map[1])}` : "–",
      "Max WVTR (38 °C, 90 % RH)": q.wvtr_max_spec !== null ? `≤ ${fmt(q.wvtr_max_spec, 3)} g/m²·day · ${esc(q.wvtr_class)}` : esc(q.wvtr_class),
    })}${kv({
      "Light barrier": q.light_barrier_min_pct ? `≥ ${q.light_barrier_min_pct} %` : "not required",
      "Grease resistance": esc(q.grease_resistance),
      "Mechanical (LDPE-equiv.)": `≥ ${fmt(q.min_ldpe_equivalent_thickness_um, 0)} µm · puncture ${esc(q.puncture_resistance)}`,
      "Service temperature": `${fmt(q.service_temperature_c[0])} → ${fmt(q.service_temperature_c[1])} °C`,
      "MAP": q.map.applicable ? (q.map.o2_window ? `${q.map.o2_window[0]}–${q.map.o2_window[1]} % O₂, ${q.map.co2_window?.[0]}–${q.map.co2_window?.[1]} % CO₂` : Object.entries(q.map.gas_mix || {}).map(([k, v]) => `${k} ${v}%`).join(", ")) : "not applicable",
    })}</div>
  </div>

  <h2 style="margin:22px 0 10px">Ranked packaging solutions</h2>
  <div id="recList">${recs.map((x, i) => recCard(x, i === 0)).join("")}</div>

  <div class="grid g2" style="margin-top:18px">
    <div class="card"><h3>Shelf life vs storage temperature</h3><p class="muted">Predicted days (storage-only) for the top solutions. Dashed line = target.</p>
      <div class="chart-box"><canvas id="tempChart" aria-label="Shelf life versus temperature chart"></canvas></div></div>
    ${r.map_simulation ? `<div class="card"><h3>In-pack atmosphere (passive MAP)</h3><p class="muted">${esc(r.map_simulation.name)} · shaded bands = recommended window.</p>
      <div class="chart-box"><canvas id="mapChart" aria-label="Headspace gas composition over time"></canvas></div></div>`
      : `<div class="card"><h3>Cost vs sustainability</h3><p class="muted">₹ per kg of product (bars) for each ranked solution; eco score in the table.</p><div class="chart-box"><canvas id="costChart"></canvas></div></div>`}
  </div>
  ${r.map_simulation ? `<div class="card" style="margin-top:16px"><h3>Cost per kg of product</h3><div class="chart-box short"><canvas id="costChart"></canvas></div></div>` : ""}

  <div class="grid g3" style="margin-top:16px">
    ${Object.entries(r.alternatives || {}).map(([k, a]) => `<div class="card"><div class="stat"><span class="l">${esc(k.replace(/_/g, " "))}</span>
      <span class="v" style="font-size:1.05rem">${esc(a.name)}</span>
      <span class="l">${days(a.shelf_life_days)} · ${inr(a.cost_per_pack)}/pack · eco ${fmt(a.eco_score, 0)} · ${esc(a.recyclability)} ${a.meets_target ? "" : statusBadge("warn", "below target")}</span></div></div>`).join("")}
  </div>

  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>🤖 AI insights</h3>${mlBlock(r.ml, top)}</div>
    <div class="card"><h3>Secondary packaging, storage &amp; handling</h3>
      <ul class="clean">${(r.secondary_packaging || []).map(s => `<li><b>${esc(s.item)}</b> — ${esc(s.detail)}</li>`).join("")}
      ${(r.storage_guidance || []).map(g => `<li>${esc(g)}</li>`).join("")}</ul></div>
  </div>

  <div class="card" style="margin-top:16px"><details><summary>Rejected options (${r.rejected.length}) — why they were excluded</summary>
    <div style="margin-top:10px">${table([{ label: "Solution", key: "name" }, { label: "Reason(s)", render: x => esc(x.reasons.join("; ")) }], r.rejected, { maxh: 360 })}</div></details></div>

  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Field feedback → improves the AI</h3>
      <form id="fbForm" class="fields" style="grid-template-columns:1fr 1fr">
        <label class="f">Solution adopted<select name="solution_id">${recs.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></label>
        <label class="f">Rating<select name="rating">${[5, 4, 3, 2, 1].map(v => `<option>${v}</option>`).join("")}</select></label>
        <label class="f">Observed shelf life (days)<input name="observed_shelf_life_days" type="number" min="0" step="1"></label>
        <label class="f">Notes<input name="notes" maxlength="500"></label>
        <div><button class="btn sm" type="submit">Submit feedback</button></div>
      </form></div>
    <div class="card"><h3>Integrity</h3>${kv({
      "Result SHA-256": `<span class="mono">${esc(r.result_hash)}</span>`,
      "PackChain tx": r.certified_tx ? `<a class="mono" href="/ledger?tx=${r.certified_tx}" data-link>${esc(r.certified_tx.slice(0, 24))}…</a>` : "not certified",
      "Verify": `<a href="/verify-report/${r.id}" data-link>Public verification page</a>`,
      "Engine / ML": `v${esc(r.engine_version)} / ${esc(r.ml?.model_version || "–")} · ${fmt(r.compute_ms)} ms · ${r.evaluated} feasible evaluated`,
    })}</div>
  </div>`;

  // accordions & tabs
  $$(".rec", main).forEach(card => {
    card.querySelector(".rec-head").addEventListener("click", () => {
      const b = card.querySelector(".rec-body"); b.hidden = !b.hidden;
      card.querySelector(".rec-head").setAttribute("aria-expanded", !b.hidden);
      if (!b.hidden) drawMech(card);
    });
    card.querySelector(".rec-head").addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } });
    $$(".tabs button", card).forEach(btn => btn.addEventListener("click", () => {
      $$(".tabs button", card).forEach(b => b.setAttribute("aria-selected", b === btn));
      $$("[data-pane]", card).forEach(pn => pn.hidden = pn.dataset.pane !== btn.dataset.tab);
      if (btn.dataset.tab === "life") drawMech(card);
    }));
  });
  const first = $(".rec", main); if (first) drawMech(first);

  $("#certBtn").addEventListener("click", async () => {
    if (r.certified_tx) return window.packaiNavigate(`/verify-report/${r.id}`);
    try { const c = await api.post(`/api/recommendations/${r.id}/certify`); toast(`Certified in block #${c.block_index}`); resultPage(main, id); }
    catch (e) { toast(e.message); }
  });
  $("#fbForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target;
    try {
      const res = await api.post(`/api/recommendations/${r.id}/feedback`, { solution_id: f.solution_id.value, rating: +f.rating.value,
        observed_shelf_life_days: f.observed_shelf_life_days.value ? +f.observed_shelf_life_days.value : null, notes: f.notes.value || null });
      toast(res.used_for_training ? "Thanks! Added to the AI training set." : "Thanks! Feedback saved.");
      f.reset();
    } catch (err) { toast(err.message); }
  });

  // charts
  const S = series();
  if (r.temperature_curve) {
    const tc = r.temperature_curve;
    chart($("#tempChart"), {
      type: "line",
      data: { labels: tc.temps, datasets: [
        ...tc.series.slice(0, 4).map((s, i) => ({ label: s.name, data: s.days, borderColor: S[i], backgroundColor: S[i], borderWidth: 2, pointRadius: 3, pointHoverRadius: 6, tension: .25 })),
        { label: "Target", data: tc.temps.map(() => p.desired_days), borderColor: css("--text-3"), borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0 },
      ] },
      options: { scales: { x: { title: { text: "Storage temperature (°C)" } }, y: { type: "logarithmic", title: { text: "Shelf life (days, log)" } } },
        plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt(c.parsed.y)} d` } } } },
    });
  }
  if (r.map_simulation) {
    const m = r.map_simulation, lab = m.curve.map(pt => pt.h);
    const band = (win, color) => win ? [
      { label: "_lo", data: lab.map(() => win[0]), borderWidth: 0, pointRadius: 0, fill: false },
      { label: "_hi", data: lab.map(() => win[1]), borderWidth: 0, pointRadius: 0, backgroundColor: color + "22", fill: "-1" },
    ] : [];
    chart($("#mapChart"), {
      type: "line",
      data: { labels: lab, datasets: [
        { label: "O₂ %", data: m.curve.map(pt => pt.o2), borderColor: S[0], backgroundColor: S[0], borderWidth: 2, pointRadius: 0, tension: .2 },
        { label: "CO₂ %", data: m.curve.map(pt => pt.co2), borderColor: S[1], backgroundColor: S[1], borderWidth: 2, pointRadius: 0, tension: .2 },
        ...band(m.target_o2, S[0]), ...band(m.target_co2, S[1]),
      ] },
      options: { scales: { x: { title: { text: "Hours after packing" }, ticks: { maxTicksLimit: 8, callback(v) { return Math.round(this.getLabelForValue(v)); } } }, y: { title: { text: "Gas (%)" }, min: 0 } },
        plugins: { legend: { labels: { filter: it => !it.text.startsWith("_") } }, tooltip: { filter: it => !it.dataset.label.startsWith("_") } } },
    });
  }
  if (recs.length) {
    chart($("#costChart"), {
      type: "bar",
      data: { labels: recs.map(x => shortName(x.name)), datasets: [{ label: "₹ per kg product", data: recs.map(x => x.cost.per_kg_product_inr), backgroundColor: S[0], borderRadius: 4, maxBarThickness: 34 }] },
      options: { indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `₹${fmt(c.parsed.x, 2)} per kg · eco ${fmt(recs[c.dataIndex].sustainability.score, 0)}/100` } } },
        scales: { x: { title: { text: "₹ per kg of product" }, beginAtZero: true }, y: { grid: { display: false } } } },
    });
  }
}

function shortName(n) { return n.length > 32 ? n.slice(0, 30) + "…" : n; }

function recCard(x, open) {
  const s = x.specs, sl = x.shelf_life, m = s.map || {};
  const seal = s.seal || {};
  const ratio = Math.min(1, sl.ratio);
  return `<article class="rec ${open ? "top" : ""}" data-id="${x.id}">
    <div class="rec-head" role="button" tabindex="0" aria-expanded="${open}">
      <div class="rec-rank">${x.rank}</div>
      <div><div class="rec-title">${esc(x.name)}</div>
        <div class="rec-sub">${esc(s.structure)}</div>
        <div class="row" style="margin-top:6px">
          <span class="badge">${esc(x.family_label)}</span>
          ${x.meets_target ? statusBadge("good", `${days(sl.predicted_days)} shelf life`) : statusBadge("warn", `${days(sl.predicted_days)} (< target)`)}
          ${m.suitable ? `<span class="badge brand">MAP: ${esc(m.technique.replace("_", " "))}</span>` : ""}
          ${x.warnings.some(w => w.level === "major") ? statusBadge("crit", "major watch-out") : ""}
          <span class="badge">${esc(x.sustainability.recyclability)}</span>
        </div></div>
      <div class="rec-score"><div class="v">${fmt(x.scores.overall, 0)}</div><small class="muted">overall score</small></div>
    </div>
    <div class="rec-body" ${open ? "" : "hidden"}>
      <div class="mini-metrics">
        <div class="mm"><div class="l">Predicted shelf life</div><div class="v">${days(sl.predicted_days)}</div>${scoreBar(ratio * 100)}</div>
        <div class="mm"><div class="l">Cost per pack</div><div class="v">${inr(x.cost.per_pack_inr)}</div><small class="muted">${inr(x.cost.per_1000_inr)} / 1000</small></div>
        <div class="mm"><div class="l">Sustainability</div><div class="v">${fmt(x.sustainability.score, 0)}/100</div>${scoreBar(x.sustainability.score)}</div>
        <div class="mm"><div class="l">Scores: tech / AI / cost</div><div class="v" style="font-size:.95rem">${fmt(x.scores.technical, 0)} / ${fmt(x.scores.ml, 0)} / ${inr(x.scores.cost_per_kg)}/kg</div></div>
      </div>
      <div class="tabs" role="tablist">
        <button data-tab="spec" aria-selected="true">Specifications</button>
        <button data-tab="life" aria-selected="false">Shelf life</button>
        <button data-tab="eco" aria-selected="false">Cost & sustainability</button>
        <button data-tab="reg" aria-selected="false">Compliance</button>
      </div>
      <div data-pane="spec"><div class="grid g2">
        ${kv({
          "Structure": esc(s.structure),
          "Total thickness / grammage": `${fmt(s.total_thickness_um, 0)} µm · ${fmt(s.grammage_gsm, 1)} g/m²`,
          "OTR (23 °C, 0 % RH)": s.otr_spec !== null ? `${fmt(s.otr_spec, 3)} cc/m²·day · ${esc(s.otr_class)}` : "open / ventilated",
          "OTR at storage": s.otr_at_storage !== null ? `${fmt(s.otr_at_storage, 3)} cc/m²·day·atm` : "–",
          "WVTR (38 °C, 90 % RH)": s.wvtr_spec !== null ? `${fmt(s.wvtr_spec, 3)} g/m²·day · ${esc(s.wvtr_class)}` : "open / ventilated",
          "WVTR at storage": s.wvtr_at_storage !== null ? `${fmt(s.wvtr_at_storage, 3)} g/m²·day` : "–",
          "CO₂TR / β (CO₂:O₂)": s.co2tr_spec !== null ? `${fmt(s.co2tr_spec)} / ${fmt(s.beta_co2_o2)}` : "–",
          "Pack size": esc(s.pack_dimensions),
        })}
        ${kv({
          "Sealing": `${esc(seal.method)}${seal.temp_range ? ` · ${seal.temp_range[0]}–${seal.temp_range[1]} °C` : ""}${seal.min_strength_n_15mm ? ` · ≥ ${seal.min_strength_n_15mm} N/15 mm` : ""}`,
          "Mechanical": `${s.tensile_mpa !== null ? fmt(s.tensile_mpa, 0) + " MPa" : "–"} tensile · ${s.elongation_pct !== null && s.elongation_pct !== undefined ? fmt(s.elongation_pct, 0) + " % elong." : ""} · puncture ${esc(s.puncture_resistance)}`,
          "MAP": m.suitable ? `${esc(m.technique.replace("_", " "))}${m.gas ? " · " + Object.entries(m.gas).map(([k, v]) => `${k} ${v}%`).join(", ") : ""}${m.eq_o2 !== undefined ? ` · equilibrium ${fmt(m.eq_o2)} % O₂ / ${fmt(m.eq_co2)} % CO₂` : ""}${m.perforations ? ` · ${m.perforations} × ${fmt(m.perf_diameter_um, 0)} µm perforations` : ""}` : "not required",
          "Light barrier / transparency": `${s.light_barrier_pct} % · ${esc(s.transparency)}`,
          "Service temperature": `${s.service_temp_c[0]} → ${s.service_temp_c[1]} °C${s.retortable ? " · retortable" : ""}${s.microwavable ? " · microwavable" : ""}`,
          "Formats": esc((s.formats || []).join(", ")),
          "Typical uses": esc(x.uses || ""),
        })}</div>
        ${x.addons.length ? `<h4 style="margin-top:14px">Recommended add-ons</h4>${table([{ label: "Add-on", key: "item" }, { label: "Detail", key: "detail" }, { label: "₹/pack", num: true, render: a => fmt(a.cost, 2) }], x.addons)}` : ""}
      </div>
      <div data-pane="life" hidden>
        <div class="grid g2">
          <div><div class="chart-box short"><canvas class="mechChart" aria-label="Shelf life by deterioration mechanism"></canvas></div>
            <p class="muted" style="margin-top:6px">Each bar = days until that mechanism causes failure at ${fmt(sl.storage_only_days)} d storage-only; the shortest one limits shelf life. Transport consumed ${fmt(sl.transit_consumed_pct)} %.</p></div>
          <div><h4>Why this package</h4><ul class="clean ticks">${x.reasons.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
            ${x.warnings.length ? `<h4 style="margin-top:10px">Watch-outs</h4><ul class="clean warns">${x.warnings.map(w => `<li>${w.level === "major" ? "<b>" : ""}${esc(w.text)}${w.level === "major" ? "</b>" : ""}</li>`).join("")}</ul>` : ""}</div>
        </div>
      </div>
      <div data-pane="eco" hidden><div class="grid g2">
        ${kv({
          "Material / conversion / add-ons": `${inr(x.cost.material_inr)} / ${inr(x.cost.conversion_inr)} / ${inr(x.cost.addons_inr)}`,
          "Per pack · per 1000 · per kg": `${inr(x.cost.per_pack_inr)} · ${inr(x.cost.per_1000_inr)} · ${inr(x.cost.per_kg_product_inr)}`,
          "Pack mass": `${fmt(x.cost.pack_mass_g)} g`,
          "Carbon footprint": `${fmt(x.cost.co2e_g)} g CO₂e/pack (${fmt(x.cost.co2e_g_per_kg_food)} g per kg food)`,
          "Packaging share of footprint": `${fmt(x.footprint.packaging_share_pct)} %`,
        })}
        ${kv({
          "Eco score": `${fmt(x.sustainability.score, 0)}/100 (recyclability ${x.sustainability.breakdown.recyclability}, carbon ${x.sustainability.breakdown.carbon}, efficiency ${x.sustainability.breakdown.material_efficiency}, bio ${x.sustainability.breakdown.bio_based})`,
          "Recyclability": esc(x.sustainability.recyclability),
          "End of life": esc(x.sustainability.end_of_life),
          "EPR category (PWM Rules)": x.sustainability.pwm_category ? `Category ${esc(x.sustainability.pwm_category)}` : "non-plastic",
          "Resin code": esc(x.sustainability.resin_code || "–"),
        })}</div><p class="muted" style="margin-top:8px">${esc(x.footprint.message)}</p></div>
      <div data-pane="reg" hidden>${table([{ label: "Area", key: "area" }, { label: "Requirement", key: "requirement" }], x.compliance)}</div>
    </div>
    <script type="application/json" class="mech-data">${JSON.stringify({ mech: sl.mechanisms, target: sl.target_days }).replace(/</g, "\\u003c")}</script>
  </article>`;
}

function drawMech(card) {
  const cv = card.querySelector(".mechChart");
  if (!cv || cv._drawn || cv.closest("[hidden]")) return;
  cv._drawn = true;
  const d = JSON.parse(card.querySelector(".mech-data").textContent);
  const entries = Object.entries(d.mech).sort((a, b) => a[1] - b[1]);
  const S = series();
  chart(cv, {
    type: "bar",
    data: { labels: entries.map(e => e[0]), datasets: [{ label: "Days", data: entries.map(e => Math.min(e[1], 3650)),
      backgroundColor: entries.map((e, i) => i === 0 ? S[1] : S[0]), borderRadius: 4, maxBarThickness: 26 }] },
    options: { indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${fmt(entries[c.dataIndex][1])} days${c.dataIndex === 0 ? " (limiting)" : ""}` } } },
      scales: { x: { type: "logarithmic", title: { text: `Days (log) · target ${d.target}` } }, y: { grid: { display: false }, ticks: { autoSkip: false } } } },
  });
}

function mlBlock(ml, top) {
  if (!ml || ml.error || !ml.top_families) return `<p class="muted">ML model not available yet (training in background). Physics-based ranking shown.</p>`;
  return `<p class="muted">Industry-practice model (Random Forest, ${esc(ml.model_version)}): which packaging family the market typically uses for products with these properties.</p>
    ${ml.top_families.map(f => `<div style="margin:6px 0"><div class="row"><span>${esc(f.label)}</span><span class="spacer"></span><b>${fmt(f.probability * 100, 0)} %</b></div>${scoreBar(f.probability * 100)}</div>`).join("")}
    ${kv({
      "ML-predicted max OTR": ml.predicted_otr_max_spec ? `${fmt(ml.predicted_otr_max_spec, 3)} cc/m²·day` : "–",
      "ML-predicted max WVTR": ml.predicted_wvtr_max_spec ? `${fmt(ml.predicted_wvtr_max_spec, 3)} g/m²·day` : "–",
      "ML-predicted achievable life": ml.predicted_best_shelf_life_days ? days(ml.predicted_best_shelf_life_days) : "–",
    })}
    <h4 style="margin-top:12px">Similar commodities</h4>
    <ul class="clean">${(ml.similar_commodities || []).map(s => `<li><b>${esc(s.name)}</b> <small class="muted">similarity ${fmt(s.similarity, 2)}</small><br><small>${esc(s.typical_packaging.join(" · "))}</small></li>`).join("")}</ul>`;
}
