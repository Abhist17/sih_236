import { api } from "../api.js";
import { $, esc, fmt, table, chart, series, kv } from "../ui.js";

export async function materialsPage(main) {
  main.innerHTML = `<div class="page-head"><div><h1>Materials explorer</h1>
    <p>Barrier, mechanical, cost, carbon and end-of-life data for every packaging structure in the knowledge base. OTR at 23 °C / 0 % RH, WVTR at 38 °C / 90 % RH, at the reference build shown.</p></div></div>
    <div class="card"><h3>Barrier map</h3><p class="muted">Lower-left = higher barrier. Hover a point for details. Open/ventilated formats are excluded (no barrier).</p>
      <div class="chart-box tall"><canvas id="barrierMap" aria-label="Barrier map of OTR against WVTR"></canvas></div></div>
    <div class="card"><div class="row" style="margin-bottom:10px"><input id="mq" placeholder="Filter by name, use or family…" style="max-width:340px">
      <select id="mk" style="max-width:200px"><option value="">All kinds</option><option value="mono">Mono films</option><option value="laminate">Laminates</option><option value="rigid">Rigid</option><option value="open">Ventilated</option></select>
      <label class="check"><input type="checkbox" id="mr">Widely recyclable</label></div><div id="mt"></div></div>`;
  const ms = await api.get("/api/materials");
  const S = series();
  const groups = [["mono", "Mono-layer film"], ["laminate", "Multilayer laminate"], ["rigid", "Rigid container"]];
  chart($("#barrierMap"), {
    type: "scatter",
    data: { datasets: groups.map(([k, l], i) => ({ label: l, data: ms.filter(m => m.kind === k && m.otr && m.wvtr).map(m => ({ x: m.otr, y: m.wvtr, name: m.name || m.short })),
      backgroundColor: S[i], borderColor: css2(), borderWidth: 2, pointRadius: 6, pointHoverRadius: 9, pointStyle: ["circle", "rectRot", "triangle"][i] })) },
    options: { scales: { x: { type: "logarithmic", title: { text: "OTR (cc/m²·day·atm, log)" } }, y: { type: "logarithmic", title: { text: "WVTR (g/m²·day, log)" } } },
      plugins: { tooltip: { callbacks: { label: c => `${c.raw.name}: OTR ${fmt(c.raw.x, 3)}, WVTR ${fmt(c.raw.y, 3)}` } } } },
  });
  const draw = () => {
    const q = $("#mq").value.toLowerCase(), k = $("#mk").value, rec = $("#mr").checked;
    const rows = ms.filter(m => (!k || m.kind === k) && (!rec || m.recycle === "widely") &&
      (!q || `${m.name} ${m.short} ${m.uses} ${m.family_label}`.toLowerCase().includes(q)));
    $("#mt").innerHTML = table([
      { label: "Material / structure", render: m => `<b>${esc(m.name || m.short)}</b><br><small class="muted">${esc(m.structure || "")}</small>` },
      { label: "Family", render: m => esc(m.family_label) },
      { label: "OTR", num: true, render: m => fmt(m.otr, 3) },
      { label: "WVTR", num: true, render: m => fmt(m.wvtr, 3) },
      { label: "Seal °C", render: m => m.seal ? `${m.seal[0]}–${m.seal[1]}` : "–" },
      { label: "Use °C", render: m => `${m.tmin ?? "–"} / ${m.tmax ?? "–"}` },
      { label: "Light block", num: true, render: m => fmt((m.light_block || 0) * 100, 0) + " %" },
      { label: "₹/kg", num: true, render: m => fmt(m.cost_inr_kg ?? (m.cost_inr_m2 && m.grammage ? m.cost_inr_m2 / m.grammage * 1000 : null), 0) },
      { label: "End of life", render: m => `${esc(m.recycle)}${m.pwm_cat ? ` · EPR ${m.pwm_cat}` : ""}` },
      { label: "Typical uses", render: m => `<small>${esc(m.uses || "")}</small>` },
    ], rows, { maxh: 620 });
  };
  ["input", "change"].forEach(ev => { $("#mq").addEventListener(ev, draw); $("#mk").addEventListener(ev, draw); $("#mr").addEventListener(ev, draw); });
  draw();
}
function css2() { return getComputedStyle(document.documentElement).getPropertyValue("--surface").trim(); }

export async function commoditiesPage(main) {
  main.innerHTML = `<div class="page-head"><div><h1>Commodity library</h1>
    <p>Physico-chemical and physiological properties used by the engine (Kader 2002 respiration & CA data, sorption isotherms, oxygen tolerance, microbial kinetics) plus the packaging the Indian market typically uses.</p></div></div>
    <div class="grid g2" style="grid-template-columns:minmax(0,1.2fr) minmax(0,1fr)">
      <div class="card"><div class="row" style="margin-bottom:10px"><input id="cq" placeholder="Search…" style="max-width:300px"><select id="cc" style="max-width:240px"><option value="">All categories</option></select></div><div id="ct"></div></div>
      <div class="card" id="cd"><div class="empty">Select a commodity to see its full profile.</div></div></div>`;
  const [cs, cats] = await Promise.all([api.get("/api/commodities"), api.get("/api/categories")]);
  $("#cc").innerHTML += cats.map(c => `<option value="${c.id}">${esc(c.label)}</option>`).join("");
  const draw = () => {
    const q = $("#cq").value.toLowerCase(), c = $("#cc").value;
    const rows = cs.filter(x => (!c || x.category === c) && (!q || x.name.toLowerCase().includes(q) || (x.hi || "").includes(q)));
    $("#ct").innerHTML = table([
      { label: "Commodity", render: x => `<a href="#" data-cid="${x.id}">${esc(x.name)}</a> <small class="muted">${esc(x.hi || "")}</small>` },
      { label: "Category", render: x => esc(x.category_label) },
      { label: "Storage", render: x => esc(x.storage) },
      { label: "", render: x => x.respiring ? '<span class="badge brand">respiring</span>' : "" }], rows, { maxh: 640 });
  };
  $("#cq").addEventListener("input", draw); $("#cc").addEventListener("change", draw); draw();
  $("#ct").addEventListener("click", async e => {
    const a = e.target.closest("[data-cid]"); if (!a) return; e.preventDefault();
    const c = await api.get(`/api/commodities/${a.dataset.cid}`);
    const fam = await api.get("/api/families");
    const fl = Object.fromEntries(fam.map(f => [f.id, f.label]));
    $("#cd").innerHTML = `<h2>${esc(c.name)} <small class="muted">${esc(c.hi || "")}</small></h2>
      ${kv({
        "State": esc(c.state), "Moisture / fat / protein": `${c.moisture} % / ${c.fat} % / ${c.protein} %`, "pH · aw": `${c.ph} · ${c.aw}`,
        "Respiration": c.rr ? `${c.rr} mg CO₂/kg·h at ${c.t_opt} °C (Q10 ${c.q10})` : "non-respiring",
        "Ethylene": c.rr ? `${esc(c.eth)} producer${c.eth_sens ? " · sensitive" : ""}${c.climacteric ? " · climacteric" : ""}` : "–",
        "Optimum storage": `${c.t_opt} °C · ${c.rh_opt} % RH`, "Chilling threshold": c.chill !== null ? `${c.chill} °C` : "–",
        "MAP window": c.o2 ? `${c.o2[0]}–${c.o2[1]} % O₂ · ${c.co2[0]}–${c.co2[1]} % CO₂` : (c.map_gas ? Object.entries(c.map_gas).map(([k, v]) => `${k} ${v}%`).join(", ") : "–"),
        "O₂ tolerance": c.o2_tol ? `${c.o2_tol} mg/kg` : "–", "Critical aw (texture/caking)": c.aw_c ?? "–",
        "Light sensitivity": c.light, "Base storage life": c.base_life ? `${c.base_life} d at ${c.t_opt} °C` : "–",
        "Insect-prone / sharp / fragile": [c.insect && "insect", c.sharp && "sharp", c.fragile && "fragile"].filter(Boolean).join(", ") || "–",
        "Farm-gate footprint": `${c.food_co2e} kg CO₂e/kg`,
        "Typical industry packaging": (c.practice || []).map(p => `<span class="badge">${esc(fl[p] || p)}</span>`).join(" ") || "–",
      })}
      <div class="row" style="margin-top:12px"><a class="btn" href="/recommend?c=${c.id}" data-link>Recommend packaging →</a></div>`;
  });
}
