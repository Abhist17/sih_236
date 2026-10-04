import { api } from "../api.js";
import { L, cname, mechLabel } from "../i18n.js";
import { $, esc, fmt, days, inr, loading, table, kv, chart, css, series, statusBadge, pageHead } from "../ui.js";

const toolCrumb = () => [[L("Tools", "उपकरण"), null]];

export async function mapTool(main) {
  main.innerHTML = pageHead({
    title: L("MAP pack designer", "MAP पैक डिज़ाइनर"), icon: "gas", crumbs: toolCrumb(),
    desc: L("Fruits and vegetables keep breathing after harvest. This tool calculates how many tiny laser holes a bag needs so that the air inside reaches the ideal oxygen/carbon-dioxide level — slowing ripening without suffocating the produce.",
      "फल और सब्ज़ियाँ कटाई के बाद भी साँस लेती रहती हैं। यह उपकरण बताता है कि थैली में कितने सूक्ष्म लेज़र छिद्र चाहिए ताकि अंदर की हवा आदर्श ऑक्सीजन/कार्बन डाइऑक्साइड स्तर पर पहुँचे — पकना धीमा हो पर उपज का दम न घुटे।"),
  }) + `<div class="wrap page-body">
  <div class="grid g2">
    <form class="card" id="mapForm">
      <h2 class="card-title">${L("Inputs", "इनपुट")}</h2>
      <div class="fields">
        <label class="f">${L("Produce (auto-fill)", "उपज (स्वतः भरें)")}<select id="preset"><option value="">${L("— custom —", "— स्वयं भरें —")}</option></select></label>
        <label class="f">${L("Respiration rate (mg CO₂/kg·h)", "श्वसन दर (mg CO₂/kg·h)")}<input name="respiration_rate" type="number" step="0.1" value="25" required></label>
        <label class="f">${L("…measured at (°C)", "…मापन तापमान (°C)")}<input name="rr_temp" type="number" step="0.5" value="1"></label>
        <label class="f">Q10<input name="q10" type="number" step="0.1" value="2.5"></label>
        <label class="f">${L("Storage temperature (°C)", "भंडारण तापमान (°C)")}<input name="storage_temp" type="number" step="0.5" value="2"></label>
        <label class="f">${L("Weight per bag (kg)", "प्रति थैली वज़न (kg)")}<input name="weight_kg" type="number" step="0.05" value="0.5"></label>
        <label class="f">${L("Bag area (m²)", "थैली क्षेत्रफल (m²)")}<input name="area_m2" type="number" step="0.001" placeholder="${L("auto", "स्वतः")}"></label>
        <label class="f">${L("Film", "फ़िल्म")}<select name="film_id">
          <option value="ldpe">LDPE</option><option value="lldpe">LLDPE</option><option value="bopp">BOPP</option><option value="cpp">CPP</option>
          <option value="hdpe">HDPE</option><option value="pla">PLA</option><option value="pbat_pla">PBAT/PLA</option></select></label>
        <label class="f">${L("Film thickness (µm)", "फ़िल्म मोटाई (µm)")}<input name="thickness_um" type="number" step="1" value="30"></label>
        <label class="f">${L("Target O₂ min / max (%)", "लक्ष्य O₂ न्यूनतम / अधिकतम (%)")}<span class="row" style="flex-wrap:nowrap"><input name="o2_min" type="number" step="0.5" value="1" aria-label="O2 min"><input name="o2_max" type="number" step="0.5" value="2" aria-label="O2 max"></span></label>
        <label class="f">${L("Target CO₂ min / max (%)", "लक्ष्य CO₂ न्यूनतम / अधिकतम (%)")}<span class="row" style="flex-wrap:nowrap"><input name="co2_min" type="number" step="0.5" value="5" aria-label="CO2 min"><input name="co2_max" type="number" step="0.5" value="10" aria-label="CO2 max"></span></label>
      </div>
      <div class="row" style="margin-top:14px"><button class="btn saffron">${L("Design the bag", "थैली डिज़ाइन करें")}</button></div>
    </form>
    <div class="card" id="mapOut"><div class="empty">${L("Results will appear here.", "परिणाम यहाँ दिखेंगे।")}</div></div>
  </div>
  <div class="card" style="margin-top:16px"><h3 class="card-title">${L("Air inside the bag over time (recommended design)", "समय के साथ थैली के अंदर की हवा (अनुशंसित डिज़ाइन)")}</h3><div class="chart-box"><canvas id="mapT"></canvas></div></div>
  </div>`;
  const list = (await api.get("/api/commodities")).filter(c => c.respiring);
  $("#preset").innerHTML += list.map(c => `<option value="${c.id}">${esc(cname(c))}</option>`).join("");
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
    const out = $("#mapOut"); loading(out, L("Calculating…", "गणना हो रही है…"));
    try {
      const r = await api.post("/api/tools/map-design", body);
      const best = r.recommended;
      const note = best.perforations === 0 ? L("The film alone is enough — no holes needed.", "केवल फ़िल्म पर्याप्त है — छिद्रों की आवश्यकता नहीं।")
        : L(`Make ${best.perforations} laser micro-holes of ${fmt(best.diameter_um, 0)} µm in each bag.`, `हर थैली में ${fmt(best.diameter_um, 0)} µm के ${best.perforations} लेज़र सूक्ष्म-छिद्र बनाएँ।`);
      out.innerHTML = `<div class="callout good" style="margin-bottom:12px"><b>${esc(note)}</b><br>${L("Expected air inside", "अंदर अपेक्षित हवा")}: ${fmt(best.eq_o2)} % O₂ · ${fmt(best.eq_co2)} % CO₂ · ${L("breathing slowed by", "श्वसन में कमी")} ${fmt(best.rr_reduction_pct, 0)} %</div>
        ${kv({
          [L("Respiration at storage", "भंडारण पर श्वसन")]: `${fmt(r.respiration_at_storage_ml_o2_kg_h, 2)} mL O₂/kg·h`,
          [L("Bag area", "थैली क्षेत्रफल")]: `${fmt(r.area_m2, 4)} m²`,
          [L("Film OTR at storage", "भंडारण पर फ़िल्म OTR")]: `${fmt(r.film_otr_at_storage, 0)} cc/m²·day·atm`,
          [L("Film only (no holes) →", "केवल फ़िल्म (बिना छिद्र) →")]: `${fmt(r.film_only.eq_o2)} % O₂ / ${fmt(r.film_only.eq_co2)} % CO₂`,
          [L("Film OTR needed without holes", "बिना छिद्र आवश्यक फ़िल्म OTR")]: `${fmt(r.required_film_otr_spec_23c, 0)} cc/m²·day (23 °C)`,
          [L("Ideal β vs film β", "आदर्श β बनाम फ़िल्म β")]: `${fmt(r.ideal_beta)} vs ${fmt(r.film_beta)}`,
        })}
        <h4 style="margin-top:12px">${L("Hole options", "छिद्र विकल्प")}</h4>
        ${table([{ label: L("Hole size (µm)", "छिद्र आकार (µm)"), num: true, key: "diameter_um" }, { label: L("Holes per bag", "प्रति थैली छिद्र"), num: true, key: "perforations" },
          { label: "O₂ %", num: true, render: o => fmt(o.eq_o2) }, { label: "CO₂ %", num: true, render: o => fmt(o.eq_co2) },
          { label: L("Breathing ↓", "श्वसन ↓"), num: true, render: o => fmt(o.rr_reduction_pct, 0) + " %" },
          { label: L("Result", "परिणाम"), render: o => o.in_window ? statusBadge("good", L("ideal", "आदर्श")) : statusBadge("warn", L("outside range", "सीमा से बाहर")) }], r.options)}`;
      const S = series(), lab = r.transient.map(p => p.h);
      chart($("#mapT"), { type: "line", data: { labels: lab, datasets: [
        { label: L("Oxygen O₂ %", "ऑक्सीजन O₂ %"), data: r.transient.map(p => p.o2), borderColor: S[0], backgroundColor: S[0], borderWidth: 2, pointRadius: 0 },
        { label: L("Carbon dioxide CO₂ %", "कार्बन डाइऑक्साइड CO₂ %"), data: r.transient.map(p => p.co2), borderColor: S[1], backgroundColor: S[1], borderWidth: 2, pointRadius: 0 }] },
        options: { scales: { x: { title: { text: L("Hours after packing", "पैकिंग के बाद घंटे") }, ticks: { maxTicksLimit: 8, callback(v) { return Math.round(this.getLabelForValue(v)); } } }, y: { title: { text: L("Gas %", "गैस %") }, min: 0 } } } });
    } catch (err) { out.innerHTML = `<div class="callout crit">⚠ ${esc(err.message)}</div>`; }
  });
  f.requestSubmit();
}

export async function shelfTool(main) {
  main.innerHTML = pageHead({
    title: L("Shelf-life calculator", "शेल्फ-लाइफ कैलकुलेटर"), icon: "clock", crumbs: toolCrumb(),
    desc: L("Choose a product and up to four packaging options. See how many days each will keep the product good at different storage temperatures, and what spoils it first.",
      "एक उत्पाद और अधिकतम चार पैकेजिंग विकल्प चुनें। देखें कि अलग-अलग भंडारण तापमान पर हर विकल्प उत्पाद को कितने दिन ठीक रखेगा और सबसे पहले क्या ख़राब करता है।"),
  }) + `<div class="wrap page-body">
  <form class="card" id="slForm"><div class="fields">
    <label class="f">${L("Product", "उत्पाद")}<select name="commodity_id" id="slC"></select></label>
    <label class="f">${L("Weight per pack (kg)", "प्रति पैक वज़न (kg)")}<input name="net_weight_kg" type="number" step="0.01" value="0.05"></label>
    <label class="f">${L("Humidity (%)", "आर्द्रता (%)")}<input name="rh" type="number" placeholder="${L("default", "डिफ़ॉल्ट")}"></label>
    <label class="f">${L("Target shelf life (days)", "लक्ष्य शेल्फ-लाइफ (दिन)")}<input name="desired_shelf_life_days" type="number" placeholder="${L("default", "डिफ़ॉल्ट")}"></label>
  </div>
  <p class="muted" style="margin:14px 0 8px">${L("Packaging options to compare (max 4):", "तुलना हेतु पैकेजिंग विकल्प (अधिकतम 4):")}</p>
  <div class="chips" id="slSols"></div>
  <div class="row" style="margin-top:14px"><button class="btn saffron">${L("Calculate", "गणना करें")}</button></div></form>
  <div id="slOut" style="margin-top:16px"></div></div>`;
  const [cs, ms] = await Promise.all([api.get("/api/commodities"), api.get("/api/materials")]);
  $("#slC").innerHTML = cs.map(c => `<option value="${c.id}" ${c.id === "potato_chips" ? "selected" : ""}>${esc(cname(c))}</option>`).join("");
  const usable = ms.filter(m => m.standalone !== false);
  const picked = new Set(["bopp_bopp", "bopp_metbopp", "pet_metpet_pe", "mdope_evoh_pe"]);
  const renderChips = () => $("#slSols").innerHTML = usable.map(m => `<button type="button" class="chip" data-id="${m.id}" aria-pressed="${picked.has(m.id)}">${esc(m.name || m.short)}</button>`).join("");
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
    const out = $("#slOut"); loading(out, L("Calculating…", "गणना हो रही है…"));
    try {
      const r = await api.post("/api/tools/compare", { scenario: sc, solution_ids: [...picked] });
      const items = r.items.filter(i => !i.error);
      const c = cs.find(x => x.id === sc.commodity_id);
      const S = series();
      out.innerHTML = `<div class="card"><h3 class="card-title">${esc(cname(c))} · ${fmt(r.profile.temp)} °C, ${fmt(r.profile.rh, 0)} % RH · ${L("target", "लक्ष्य")} ${fmt(r.profile.desired_days, 0)} ${L("days", "दिन")}</h3>
        <div class="chart-box tall"><canvas id="slChart"></canvas></div></div>
        <div class="card">${table([
          { label: L("Package", "पैक"), render: i => `<b>${esc(i.name)}</b><br><small class="muted">${esc(i.specs.structure)}</small>` },
          { label: L("Suitable?", "उपयुक्त?"), render: i => i.compatible ? statusBadge("good", L("yes", "हाँ")) : statusBadge("crit", esc(i.issues[0] || L("no", "नहीं"))) },
          { label: L("Shelf life", "शेल्फ-लाइफ"), num: true, render: i => days(i.shelf_life.predicted_days) },
          { label: L("Spoils first by", "पहले ख़राबी का कारण"), render: i => esc(mechLabel(i.shelf_life.limiting)) },
          { label: L("₹/pack", "₹/पैक"), num: true, render: i => inr(i.cost.per_pack_inr) },
          { label: L("Eco", "पर्यावरण"), num: true, render: i => fmt(i.sustainability.score, 0) }], items)}</div>`;
      chart($("#slChart"), { type: "line", data: { labels: items[0]?.curve.map(x => x.temp) || [], datasets: [
        ...items.map((it, k) => ({ label: it.name, data: it.curve.map(x => x.days), borderColor: S[k], backgroundColor: S[k], borderWidth: 2, pointRadius: 3, tension: .25 })),
        { label: L("Target", "लक्ष्य"), data: (items[0]?.curve || []).map(() => r.profile.desired_days), borderColor: css("--text-3"), borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0 }] },
        options: { scales: { x: { title: { text: L("Storage temperature (°C)", "भंडारण तापमान (°C)") } }, y: { type: "logarithmic", title: { text: L("Shelf life (days, log scale)", "शेल्फ-लाइफ (दिन, लॉग स्केल)") } } },
          plugins: { tooltip: { callbacks: { label: x => `${x.dataset.label}: ${fmt(x.parsed.y)} ${L("days", "दिन")}` } } } } });
    } catch (err) { out.innerHTML = `<div class="callout crit">⚠ ${esc(err.message)}</div>`; }
  });
  f.requestSubmit();
}
