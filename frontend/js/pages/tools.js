import { api } from "../api.js";
import { $, esc, fmt, days, inr, loading, errorBox, table, kv, chart, css, series, statusBadge } from "../ui.js";

export async function mapTool(main) {
  main.innerHTML = `
  <div class="page-head"><div><h1>Passive MAP designer</h1>
  <p>Design a breathable package for fresh produce: the tool balances O₂ ingress through the film (and laser micro-perforations, Fishman 1996 model) against respiration (Michaelis-Menten kinetics with CO₂ inhibition) to hit a target atmosphere.</p></div></div>
  <div class="grid g2">
    <form class="card" id="mapForm">
      <div class="fields">
        <label class="f">Commodity preset<select id="preset"><option value="">— custom —</option></select></label>
        <label class="f">Respiration rate (mg CO₂/kg·h)<input name="respiration_rate" type="number" step="0.1" value="25" required></label>
        <label class="f">…measured at (°C)<input name="rr_temp" type="number" step="0.5" value="1"></label>
        <label class="f">Q10<input name="q10" type="number" step="0.1" value="2.5"></label>
        <label class="f">Storage temperature (°C)<input name="storage_temp" type="number" step="0.5" value="2"></label>
        <label class="f">Fill weight (kg)<input name="weight_kg" type="number" step="0.05" value="0.5"></label>
        <label class="f">Package area (m²)<input name="area_m2" type="number" step="0.001" placeholder="auto"></label>
        <label class="f">Film<select name="film_id">
          <option value="ldpe">LDPE</option><option value="lldpe">LLDPE</option><option value="bopp">BOPP</option><option value="cpp">CPP</option>
          <option value="hdpe">HDPE</option><option value="pla">PLA</option><option value="pbat_pla">PBAT/PLA</option></select></label>
        <label class="f">Film thickness (µm)<input name="thickness_um" type="number" step="1" value="30"></label>
        <label class="f">Target O₂ min / max (%)<span class="row" style="flex-wrap:nowrap"><input name="o2_min" type="number" step="0.5" value="1"><input name="o2_max" type="number" step="0.5" value="2"></span></label>
        <label class="f">Target CO₂ min / max (%)<span class="row" style="flex-wrap:nowrap"><input name="co2_min" type="number" step="0.5" value="5"><input name="co2_max" type="number" step="0.5" value="10"></span></label>
      </div>
      <div class="row" style="margin-top:12px"><button class="btn">Design package</button></div>
    </form>
    <div class="card" id="mapOut"><div class="empty">Results appear here.</div></div>
  </div>
  <div class="card" style="margin-top:16px"><h3>Headspace evolution (recommended design)</h3><div class="chart-box"><canvas id="mapT"></canvas></div></div>`;
  const list = (await api.get("/api/commodities")).filter(c => c.respiring);
  $("#preset").innerHTML += list.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  const f = $("#mapForm");
  $("#preset").addEventListener("change", async e => {
    if (!e.target.value) return;
    const c = await api.get(`/api/commodities/${e.target.value}`);
    f.respiration_rate.value = c.rr; f.rr_temp.value = c.t_opt; f.q10.value = c.q10; f.storage_temp.value = c.t_opt;
    if (c.o2) { f.o2_min.value = c.o2[0]; f.o2_max.value = Math.min(c.o2[1], 19); f.co2_min.value = c.co2[0]; f.co2_max.value = c.co2[1]; }
  });
  f.addEventListener("submit", async e => {
    e.preventDefault();
    const body = {};
    for (const [k, v] of new FormData(f).entries()) if (v !== "") body[k] = k === "film_id" ? v : +v;
    const out = $("#mapOut"); loading(out, "Solving mass balance…");
    try {
      const r = await api.post("/api/tools/map-design", body);
      out.innerHTML = `<h3>${esc(r.note)}</h3>
        ${kv({
          "Respiration at storage": `${fmt(r.respiration_at_storage_ml_o2_kg_h, 2)} mL O₂/kg·h`,
          "Package area": `${fmt(r.area_m2, 4)} m²`,
          "Film OTR at storage": `${fmt(r.film_otr_at_storage, 0)} cc/m²·day·atm`,
          "Film only → equilibrium": `${fmt(r.film_only.eq_o2)} % O₂ / ${fmt(r.film_only.eq_co2)} % CO₂`,
          "Film OTR needed (no holes)": `${fmt(r.required_film_otr_spec_23c, 0)} cc/m²·day at 23 °C`,
          "Ideal β vs film β": `${fmt(r.ideal_beta)} vs ${fmt(r.film_beta)}`,
        })}
        <h4 style="margin-top:12px">Perforation options</h4>
        ${table([{ label: "Hole Ø (µm)", num: true, key: "diameter_um" }, { label: "Holes / pack", num: true, key: "perforations" },
          { label: "O₂ %", num: true, render: o => fmt(o.eq_o2) }, { label: "CO₂ %", num: true, render: o => fmt(o.eq_co2) },
          { label: "Respiration ↓", num: true, render: o => fmt(o.rr_reduction_pct, 0) + " %" },
          { label: "Window", render: o => o.in_window ? statusBadge("good", "in window") : statusBadge("warn", "outside") }], r.options)}`;
      const S = series(), lab = r.transient.map(p => p.h);
      chart($("#mapT"), { type: "line", data: { labels: lab, datasets: [
        { label: "O₂ %", data: r.transient.map(p => p.o2), borderColor: S[0], backgroundColor: S[0], borderWidth: 2, pointRadius: 0 },
        { label: "CO₂ %", data: r.transient.map(p => p.co2), borderColor: S[1], backgroundColor: S[1], borderWidth: 2, pointRadius: 0 }] },
        options: { scales: { x: { title: { text: "Hours" }, ticks: { maxTicksLimit: 8, callback(v) { return Math.round(this.getLabelForValue(v)); } } }, y: { title: { text: "Gas %" }, min: 0 } } } });
    } catch (err) { errorBox(out, err); }
  });
  f.requestSubmit();
}

export async function shelfTool(main) {
  main.innerHTML = `
  <div class="page-head"><div><h1>Shelf-life simulator</h1>
  <p>Pick a commodity and up to four packaging options; the mechanistic model predicts shelf life across storage temperatures and shows the limiting deterioration mechanism.</p></div></div>
  <form class="card" id="slForm"><div class="fields">
    <label class="f">Commodity<select name="commodity_id" id="slC"></select></label>
    <label class="f">Net weight (kg)<input name="net_weight_kg" type="number" step="0.01" value="0.5"></label>
    <label class="f">RH (%)<input name="rh" type="number" value="" placeholder="default"></label>
    <label class="f">Target shelf life (days)<input name="desired_shelf_life_days" type="number" placeholder="default"></label>
  </div>
  <p class="muted" style="margin:12px 0 6px">Packaging options (max 4):</p>
  <div class="chips" id="slSols"></div>
  <div class="row" style="margin-top:12px"><button class="btn">Simulate</button></div></form>
  <div id="slOut" style="margin-top:16px"></div>`;
  const [cs, ms] = await Promise.all([api.get("/api/commodities"), api.get("/api/materials")]);
  $("#slC").innerHTML = cs.map(c => `<option value="${c.id}" ${c.id === "potato_chips" ? "selected" : ""}>${esc(c.name)}</option>`).join("");
  const usable = ms.filter(m => m.standalone !== false);
  const picked = new Set(["bopp_bopp", "bopp_metbopp", "pet_metpet_pe", "mdope_evoh_pe"]);
  const renderChips = () => $("#slSols").innerHTML = usable.map(m => `<button type="button" class="chip" data-id="${m.id}" aria-pressed="${picked.has(m.id)}" style="${picked.has(m.id) ? "background:var(--brand);color:var(--on-brand);border-color:var(--brand)" : ""}">${esc(m.name || m.short)}</button>`).join("");
  renderChips();
  $("#slSols").addEventListener("click", e => {
    const b = e.target.closest("[data-id]"); if (!b) return;
    if (picked.has(b.dataset.id)) picked.delete(b.dataset.id); else if (picked.size < 4) picked.add(b.dataset.id);
    renderChips();
  });
  const f = $("#slForm");
  f.addEventListener("submit", async e => {
    e.preventDefault();
    const sc = { commodity_id: f.commodity_id.value, net_weight_kg: +f.net_weight_kg.value || 0.5 };
    if (f.rh.value) sc.rh = +f.rh.value;
    if (f.desired_shelf_life_days.value) sc.desired_shelf_life_days = +f.desired_shelf_life_days.value;
    const out = $("#slOut"); loading(out, "Simulating…");
    try {
      const r = await api.post("/api/tools/compare", { scenario: sc, solution_ids: [...picked] });
      const items = r.items.filter(i => !i.error);
      const S = series();
      out.innerHTML = `<div class="card"><h3>${esc(r.profile.name)} · stored at ${fmt(r.profile.temp)} °C, ${fmt(r.profile.rh, 0)} % RH · target ${fmt(r.profile.desired_days, 0)} d</h3>
        <div class="chart-box tall"><canvas id="slChart"></canvas></div></div>
        <div class="card">${table([
          { label: "Package", render: i => `<b>${esc(i.name)}</b><br><small class="muted">${esc(i.specs.structure)}</small>` },
          { label: "Compatible", render: i => i.compatible ? statusBadge("good", "yes") : statusBadge("crit", esc(i.issues[0] || "no")) },
          { label: "Shelf life", num: true, render: i => days(i.shelf_life.predicted_days) },
          { label: "Limited by", render: i => esc(i.shelf_life.limiting) },
          { label: "₹/pack", num: true, render: i => inr(i.cost.per_pack_inr) },
          { label: "Eco", num: true, render: i => fmt(i.sustainability.score, 0) }], items)}</div>`;
      chart($("#slChart"), { type: "line", data: { labels: items[0]?.curve.map(c => c.temp) || [], datasets: [
        ...items.map((it, k) => ({ label: it.name, data: it.curve.map(c => c.days), borderColor: S[k], backgroundColor: S[k], borderWidth: 2, pointRadius: 3, tension: .25 })),
        { label: "Target", data: (items[0]?.curve || []).map(() => r.profile.desired_days), borderColor: css("--text-3"), borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0 }] },
        options: { scales: { x: { title: { text: "Storage temperature (°C)" } }, y: { type: "logarithmic", title: { text: "Shelf life (days, log)" } } },
          plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt(c.parsed.y)} d` } } } } });
    } catch (err) { errorBox(out, err); }
  });
  f.requestSubmit();
}
