import { api } from "../api.js";
import { L, isHi, cname, catLabel, famLabel, famFromLabel, packDims, mechLabel, techLabel, recycleLabel, storageLabel, transportLabel, driverLabel,
  CATEGORIES, TRANSPORT, PROCESS, PRIORITY, STATES } from "../i18n.js";
import { $, $$, esc, fmt, days, inr, toast, loading, errorBox, statusBadge, scoreBar, kv, table, chart, css, series, pageHead, icon } from "../ui.js";

let COMMODITIES = null;
async function commodities() {
  if (!COMMODITIES) COMMODITIES = await api.get("/api/commodities");
  return COMMODITIES;
}
const opt = (map, sel) => Object.entries(map).map(([v, [en, hi]]) => `<option value="${v}" ${v === sel ? "selected" : ""}>${esc(L(en, hi))}</option>`).join("");

function field(name, label, attrs = "", hint = "") {
  return `<label class="f"><span>${esc(label)}</span><input name="${name}" ${attrs}>${hint ? `<span class="hint">${esc(hint)}</span>` : ""}</label>`;
}
function selectF(name, label, options) {
  return `<label class="f"><span>${esc(label)}</span><select name="${name}">${options}</select></label>`;
}
function seg(name, map, checked) {
  return `<div class="seg" role="radiogroup">${Object.entries(map).map(([v, [en, hi]]) => `<label><input type="radio" name="${name}" value="${v}" ${v === checked ? "checked" : ""}><span>${esc(L(en, hi))}</span></label>`).join("")}</div>`;
}

const STEPS = () => [L("Product", "उत्पाद"), L("Storage & transport", "भंडारण और परिवहन"), L("Pack details", "पैक विवरण"), L("Preferences", "प्राथमिकताएँ")];

export async function recommendPage(main) {
  const params = new URLSearchParams(location.search);
  main.innerHTML = pageHead({
    title: L("Get packaging advice", "पैकेजिंग सलाह लें"), icon: "box",
    desc: L("Answer four short steps. Choose your product and typical values are filled in automatically — change them only if you know better.",
      "चार छोटे चरण पूरे करें। उत्पाद चुनते ही सामान्य मान अपने-आप भर जाते हैं — जानकारी हो तभी बदलें।"),
  }) + `
  <div class="wrap page-body">
  <form id="recForm" autocomplete="off" novalidate>
    <ol class="stepper" id="stepper">${STEPS().map((s, i) => `<li data-step="${i}"><button type="button" data-goto="${i}">${esc(s)}</button></li>`).join("")}</ol>

    <!-- STEP 1 -->
    <fieldset class="section" data-pane="0" style="border-width:1px">
      <legend class="sr-only">${L("Product", "उत्पाद")}</legend>
      <h3 class="card-title">${L("1. Which product do you want to pack?", "1. आप कौन-सा उत्पाद पैक करना चाहते हैं?")}</h3>
      <div class="fields" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr)">
        <div class="picker">
          <label class="f"><span>${L("Search product (English / हिन्दी)", "उत्पाद खोजें (English / हिन्दी)")}</span>
            <input id="cSearch" placeholder="${L("e.g. tomato, paneer, चावल, potato chips", "जैसे टमाटर, पनीर, rice, आलू चिप्स")}" role="combobox" aria-expanded="false" aria-controls="cList" aria-autocomplete="list"></label>
          <div class="picker-list" id="cList" role="listbox" hidden></div>
        </div>
        ${selectF("category", L("Category (only for a new product)", "श्रेणी (केवल नए उत्पाद हेतु)"), `<option value="">${L("— as per product —", "— उत्पाद अनुसार —")}</option>` + Object.entries(CATEGORIES).map(([k, [en, hi]]) => `<option value="${k}">${esc(L(en, hi))}</option>`).join(""))}
      </div>
      <input type="hidden" name="commodity_id">
      <div class="row" style="margin-top:12px"><span class="muted">${L("Popular:", "लोकप्रिय:")}</span><div class="chips" id="quick"></div></div>
      <div id="cInfo" class="callout" style="margin-top:14px" hidden></div>
      <details style="margin-top:16px" id="propDetails"><summary>${L("Product properties (auto-filled — edit if you have lab values)", "उत्पाद के गुण (स्वतः भरे — प्रयोगशाला मान हों तो बदलें)")}</summary>
        <div class="fields" style="margin-top:14px">
          ${field("name", L("Product name (new product)", "उत्पाद का नाम (नया उत्पाद)"), `placeholder="${L("Custom product name", "नए उत्पाद का नाम")}"`)}
          ${selectF("state", L("Physical form", "भौतिक रूप"), opt(STATES, "solid"))}
          ${field("moisture", L("Moisture (%)", "नमी (%)"), 'type="number" step="0.1" min="0" max="99.9"', L("wet basis", "गीले आधार पर"))}
          ${field("fat", L("Fat / oil (%)", "वसा / तेल (%)"), 'type="number" step="0.1" min="0" max="100"')}
          ${field("protein", L("Protein (%)", "प्रोटीन (%)"), 'type="number" step="0.1" min="0" max="100"')}
          ${field("ph", "pH", 'type="number" step="0.1" min="1" max="14"')}
          ${field("aw", L("Water activity (aw)", "जल सक्रियता (aw)"), 'type="number" step="0.01" min="0.05" max="1"')}
          ${field("respiration_rate", L("Respiration rate (mg CO₂/kg·h)", "श्वसन दर (mg CO₂/kg·h)"), 'type="number" step="0.1" min="0"', L("0 for non-living foods", "निर्जीव खाद्य हेतु 0"))}
          ${field("respiration_temp", L("…measured at (°C)", "…मापन तापमान (°C)"), 'type="number" step="0.5"')}
        </div></details>
    </fieldset>

    <!-- STEP 2 -->
    <fieldset class="section" data-pane="1" hidden>
      <legend class="sr-only">${L("Storage & transport", "भंडारण और परिवहन")}</legend>
      <h3 class="card-title">${L("2. How will it be stored and transported?", "2. इसे कैसे रखा और भेजा जाएगा?")}</h3>
      <div class="row" style="margin-bottom:14px"><span class="muted">${L("Storage type", "भंडारण प्रकार")}</span>
        ${seg("storage_type", { ambient: ["Room temperature", "सामान्य तापमान"], chilled: ["Refrigerated", "रेफ़्रिजरेटेड"], frozen: ["Frozen", "जमा हुआ"] }, "ambient")}</div>
      <div class="fields">
        ${field("storage_temp", L("Storage temperature (°C)", "भंडारण तापमान (°C)"), 'type="number" step="0.5" min="-40" max="50"')}
        ${field("rh", L("Relative humidity (%)", "सापेक्ष आर्द्रता (%)"), 'type="number" step="1" min="10" max="100"')}
        ${field("desired_shelf_life_days", L("Shelf life needed (days)", "आवश्यक शेल्फ-लाइफ (दिन)"), 'type="number" step="1" min="1" max="3650" required')}
        ${selectF("transport", L("Transport", "परिवहन"), opt(TRANSPORT, "regional"))}
      </div>
      <div class="row" style="margin-top:14px">
        <label class="check"><input type="checkbox" name="cold_chain">${L("Cold chain (refrigerated vehicle) available", "कोल्ड चेन (रेफ़्रिजरेटेड वाहन) उपलब्ध")}</label>
        <label class="check"><input type="checkbox" name="retail_display" checked>${L("Displayed on shop shelves (light exposure)", "दुकान की शेल्फ़ पर प्रदर्शन (रोशनी)")}</label>
      </div>
    </fieldset>

    <!-- STEP 3 -->
    <fieldset class="section" data-pane="2" hidden>
      <legend class="sr-only">${L("Pack details", "पैक विवरण")}</legend>
      <h3 class="card-title">${L("3. Pack details", "3. पैक विवरण")}</h3>
      <div class="fields">
        ${field("net_weight_kg", L("Product weight per pack (kg)", "प्रति पैक उत्पाद वज़न (kg)"), 'type="number" step="0.01" min="0.01" max="100" value="1" required')}
        ${selectF("process", L("Processing", "प्रसंस्करण"), opt(PROCESS, "none"))}
        ${field("package_area_m2", L("Package area (m²)", "पैकेज क्षेत्रफल (m²)"), 'type="number" step="0.001" min="0"', L("optional — estimated if blank", "वैकल्पिक — खाली हो तो अनुमानित"))}
        ${field("headspace_ml", L("Headspace / air in pack (mL)", "पैक में हवा का स्थान (mL)"), 'type="number" step="1" min="0"', L("optional", "वैकल्पिक"))}
      </div>
    </fieldset>

    <!-- STEP 4 -->
    <fieldset class="section" data-pane="3" hidden>
      <legend class="sr-only">${L("Preferences", "प्राथमिकताएँ")}</legend>
      <h3 class="card-title">${L("4. What matters most to you?", "4. आपके लिए सबसे ज़रूरी क्या है?")}</h3>
      <div class="row" style="margin-bottom:14px">${seg("priority", PRIORITY, "balanced")}</div>
      <div class="row">
        <label class="check"><input type="checkbox" name="require_transparency">${L("Customer must see the product (transparent)", "ग्राहक को उत्पाद दिखना चाहिए (पारदर्शी)")}</label>
        <label class="check"><input type="checkbox" name="require_microwavable">${L("Microwavable", "माइक्रोवेव योग्य")}</label>
        <label class="check"><input type="checkbox" name="recyclable_only">${L("Only widely recyclable", "केवल पुनर्चक्रण योग्य")}</label>
        <label class="check"><input type="checkbox" name="compostable_only">${L("Only compostable", "केवल कम्पोस्टेबल")}</label>
      </div>
      <div class="fields" style="margin-top:14px">${field("max_cost_per_pack", L("Budget per pack (₹)", "प्रति पैक बजट (₹)"), 'type="number" step="0.1" min="0"', L("optional", "वैकल्पिक"))}</div>
      <details style="margin-top:16px"><summary>${L("Advanced food-science settings (experts)", "उन्नत खाद्य-विज्ञान सेटिंग (विशेषज्ञों हेतु)")}</summary>
        <div class="fields" style="margin-top:14px">
          ${field("o2_tolerance", L("O₂ tolerance (mg/kg)", "O₂ सहनशीलता (mg/kg)"), 'type="number" step="1" min="0"')}
          ${field("light_sensitivity", L("Light sensitivity (0-1)", "प्रकाश संवेदनशीलता (0-1)"), 'type="number" step="0.05" min="0" max="1"')}
          ${field("aw_critical", L("Critical aw", "क्रांतिक aw"), 'type="number" step="0.01" min="0.05" max="0.99"')}
          ${field("map_o2_min", L("MAP O₂ min (%)", "MAP O₂ न्यूनतम (%)"), 'type="number" step="0.5" min="0" max="21"')}
          ${field("map_o2_max", L("MAP O₂ max (%)", "MAP O₂ अधिकतम (%)"), 'type="number" step="0.5" min="0" max="21"')}
          ${field("map_co2_min", L("MAP CO₂ min (%)", "MAP CO₂ न्यूनतम (%)"), 'type="number" step="0.5" min="0" max="100"')}
          ${field("map_co2_max", L("MAP CO₂ max (%)", "MAP CO₂ अधिकतम (%)"), 'type="number" step="0.5" min="0" max="100"')}
        </div></details>
    </fieldset>

    <div class="wizard-nav">
      <button class="btn ghost" type="button" id="backBtn">← ${L("Back", "पीछे")}</button>
      <span id="formMsg" class="muted" role="status"></span>
      <span class="row">
        <button class="btn secondary" type="button" id="nextBtn">${L("Next", "आगे")} →</button>
        <button class="btn saffron" type="submit" id="goBtn">${icon("check", 18)} ${L("Get recommendation", "सिफ़ारिश प्राप्त करें")}</button>
      </span>
    </div>
  </form></div>`;

  const form = $("#recForm");
  let step = 0;
  const showStep = n => {
    step = Math.max(0, Math.min(3, n));
    $$("[data-pane]", form).forEach(p => p.hidden = +p.dataset.pane !== step);
    $$("#stepper li").forEach(li => { const i = +li.dataset.step; li.className = i < step ? "done" : i === step ? "current" : ""; li.querySelector("button").setAttribute("aria-current", i === step ? "step" : "false"); });
    $("#backBtn").style.visibility = step === 0 ? "hidden" : "visible";
    $("#nextBtn").hidden = step === 3;
    $("#formMsg").textContent = L(`Step ${step + 1} of 4`, `चरण ${step + 1} / 4`);
  };
  const valid = () => {
    if (step === 0 && !form.commodity_id.value && !form.name.value) { $("#formMsg").textContent = "⚠ " + L("Choose a product or enter a new product name.", "उत्पाद चुनें या नए उत्पाद का नाम लिखें।"); return false; }
    return true;
  };
  $("#nextBtn").addEventListener("click", () => { if (valid()) showStep(step + 1); });
  $("#backBtn").addEventListener("click", () => showStep(step - 1));
  $("#stepper").addEventListener("click", e => { const b = e.target.closest("[data-goto]"); if (b && (+b.dataset.goto <= step || valid())) showStep(+b.dataset.goto); });

  const list = await commodities();
  const quick = ["tomato", "mango", "potato_chips", "paneer", "rice", "milk", "chicken", "coffee", "spinach", "ghee", "onion", "biscuit"];
  $("#quick").innerHTML = quick.map(id => list.find(c => c.id === id)).filter(Boolean)
    .map(c => `<button type="button" class="chip" data-id="${c.id}">${esc(isHi() && c.hi ? c.hi : c.name.split(" (")[0])}</button>`).join("");
  $("#quick").addEventListener("click", e => { const b = e.target.closest("[data-id]"); if (b) pick(b.dataset.id); });

  const input = $("#cSearch"), lb = $("#cList");
  let active = -1;
  function showList() {
    const q = input.value.trim().toLowerCase();
    const items = list.filter(c => !q || c.name.toLowerCase().includes(q) || c.id.includes(q) || (c.hi || "").includes(q)).slice(0, 40);
    lb.innerHTML = items.map((c, i) => `<button type="button" role="option" data-id="${c.id}" aria-selected="${i === active}"><span>${esc(c.name)} <small class="muted">${esc(c.hi || "")}</small></span><small class="muted">${esc(catLabel(c.category))}</small></button>`).join("")
      + `<button type="button" data-id="__custom"><span>➕ ${L("New product", "नया उत्पाद")} “${esc(input.value || "…")}”</span><small class="muted">${L("enter properties yourself", "गुण स्वयं भरें")}</small></button>`;
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
    const info = $("#cInfo");
    if (id === "__custom") {
      form.commodity_id.value = "";
      form.name.value = input.value || L("New product", "नया उत्पाद");
      $("#propDetails").open = true;
      info.hidden = false;
      info.innerHTML = L("New product — please fill in the product properties below and choose a category. Missing values are estimated from composition.",
        "नया उत्पाद — कृपया नीचे उत्पाद के गुण भरें और श्रेणी चुनें। शेष मान संरचना से अनुमानित होंगे।");
      return;
    }
    const c = await api.get(`/api/commodities/${id}`);
    input.value = isHi() && c.hi ? `${c.hi} (${c.name})` : c.name;
    form.commodity_id.value = c.id;
    form.name.value = ""; form.category.value = "";
    form.state.value = c.state;
    for (const k of ["moisture", "fat", "protein", "ph", "aw"]) form[k].value = c[k];
    form.respiration_rate.value = c.rr || 0;
    form.respiration_temp.value = c.rr ? c.t_opt : "";
    const st = c.storage;
    form.querySelector(`input[name=storage_type][value=${st}]`).checked = true;
    form.storage_temp.value = st === "frozen" ? -18 : (st === "chilled" || (c.rr > 0 && c.t_opt > 10)) ? c.t_opt : 30;
    form.rh.value = st === "ambient" && !(c.rr > 0) ? 70 : c.rh_opt;
    form.desired_shelf_life_days.value = c.desired;
    form.cold_chain.checked = st !== "ambient";
    form.process.value = c.process || "none";
    form.transport.value = "regional";
    const typ = { snack: 0.1, biscuit: 0.2, spice: 0.2, dairy_powder: 0.5, grain: 5, flour: 5, oil: 1, dairy_liquid: 0.5, egg: 0.36, meat: 0.5, seafood: 0.5, leafy: 0.25, fresh_cut: 0.25, frozen: 0.5, rte: 0.3, bakery: 0.4, beverage: 1, sauce: 0.5, dairy_fresh: 0.2, dry_fruit: 0.25 }[c.cat];
    form.net_weight_kg.value = typ || 1;
    const facts = [];
    if (c.rr) facts.push(L(`living produce — breathes at ${c.rr} mg CO₂/kg·h`, `जीवित उपज — श्वसन दर ${c.rr} mg CO₂/kg·h`));
    if (c.o2) facts.push(L(`best atmosphere ${c.o2[0]}-${c.o2[1]} % O₂ / ${c.co2[0]}-${c.co2[1]} % CO₂`, `उत्तम वातावरण ${c.o2[0]}-${c.o2[1]} % O₂ / ${c.co2[0]}-${c.co2[1]} % CO₂`));
    if (c.chill !== null && c.chill !== undefined) facts.push(L(`do not store below ${c.chill} °C`, `${c.chill} °C से कम पर न रखें`));
    if (c.o2_tol) facts.push(L("sensitive to oxygen (rancidity)", "ऑक्सीजन के प्रति संवेदनशील (बासीपन)"));
    if (c.aw_c) facts.push(L("absorbs moisture easily", "नमी जल्दी सोखता है"));
    if (c.insect) facts.push(L("prone to insects", "कीट लगने की संभावना"));
    info.hidden = false;
    info.innerHTML = `<b>${esc(c.name)}</b> ${esc(c.hi || "")} · ${esc(catLabel(c.cat))}<br><small>${facts.map(esc).join(" · ") || L("typical values loaded", "सामान्य मान भरे गए")}</small>`;
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
  } else if (params.get("c")) {
    await pick(params.get("c"));
  }
  showStep(0);

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!form.commodity_id.value && !form.name.value) { showStep(0); valid(); return; }
    const fd = new FormData(form);
    const body = {};
    for (const [k, v] of fd.entries()) {
      if (v === "") continue;
      body[k] = ["commodity_id", "name", "category", "state", "storage_type", "transport", "process", "priority"].includes(k) ? v : Number(v);
    }
    for (const k of ["cold_chain", "retail_display", "require_transparency", "require_microwavable", "recyclable_only", "compostable_only"]) body[k] = form[k].checked;
    if (!body.commodity_id) delete body.commodity_id;
    if (body.respiration_rate === 0) { delete body.respiration_rate; delete body.respiration_temp; if (!body.commodity_id) body.respiration_rate = 0; }
    const btn = $("#goBtn"); btn.disabled = true; $("#formMsg").innerHTML = `<span class="spinner"></span> ${L("Analysing ~40 packaging options…", "~40 पैकेजिंग विकल्पों का विश्लेषण…")}`;
    try {
      const r = await api.post("/api/recommend", body);
      window.packaiNavigate(`/result/${r.id}`);
    } catch (err) { $("#formMsg").textContent = "⚠ " + err.message; btn.disabled = false; }
  });
}

// =========================================================================== result page
function simpleSummary(r, pname) {
  const top = r.recommendations[0];
  if (!top) return "";
  const p = r.profile, m = top.specs.map || {}, sl = top.shelf_life;
  const steps = [];
  steps.push(L(`Pack it in <b>${esc(top.name)}</b> (${esc(top.specs.structure)}).`, `इसे <b>${esc(top.name)}</b> (${esc(top.specs.structure)}) में पैक करें।`));
  if (m.technique === "passive_map" && m.perforations) steps.push(L(`The bag needs <b>${m.perforations} tiny laser holes</b> (${fmt(m.perf_diameter_um, 0)} µm) so the produce can breathe — oxygen settles near ${fmt(m.eq_o2)} %.`, `थैली में <b>${m.perforations} सूक्ष्म लेज़र छिद्र</b> (${fmt(m.perf_diameter_um, 0)} µm) रखें ताकि उपज साँस ले सके — ऑक्सीजन लगभग ${fmt(m.eq_o2)} % पर स्थिर होगी।`));
  else if (m.technique === "active_map" && m.gas) steps.push(L(`Fill the pack with gas before sealing: <b>${Object.entries(m.gas).map(([k, v]) => `${k} ${v}%`).join(", ")}</b>.`, `सील करने से पहले पैक में गैस भरें: <b>${Object.entries(m.gas).map(([k, v]) => `${k} ${v}%`).join(", ")}</b>।`));
  else if (m.technique === "n2_flush") steps.push(L("Flush the pack with <b>nitrogen gas</b> before sealing to remove oxygen.", "ऑक्सीजन हटाने के लिए सील से पहले पैक में <b>नाइट्रोजन गैस</b> भरें।"));
  else if (m.technique === "vacuum") steps.push(L("<b>Vacuum pack</b> it (remove all air before sealing).", "इसे <b>वैक्यूम पैक</b> करें (सील से पहले सारी हवा निकालें)।"));
  else if (m.technique === "ventilated") steps.push(L("Use a <b>ventilated</b> pack so air can move freely.", "<b>हवादार</b> पैक उपयोग करें ताकि हवा आती-जाती रहे।"));
  steps.push(L(`Keep it at <b>${fmt(p.temp)} °C</b> and about ${fmt(p.rh, 0)} % humidity.`, `इसे <b>${fmt(p.temp)} °C</b> और लगभग ${fmt(p.rh, 0)} % आर्द्रता पर रखें।`));
  const addons = (top.addons || []).filter(a => a.cost > 0 && !/^(Vacuum packing|Gas flushing)/.test(a.item)).slice(0, 2).map(a => a.item);
  if (addons.length) steps.push(L(`Recommended extras: ${esc(addons.join(", "))}.`, `अनुशंसित अतिरिक्त: ${esc(addons.join(", "))}।`));
  const head = sl.ratio >= 1
    ? L(`Your ${esc(pname)} should stay good for about <b>${days(sl.predicted_days)}</b> — your target was ${fmt(sl.target_days, 0)} days.`, `आपका ${esc(pname)} लगभग <b>${days(sl.predicted_days)}</b> तक ठीक रहेगा — आपका लक्ष्य ${fmt(sl.target_days, 0)} दिन था।`)
    : L(`Even the best option gives about <b>${days(sl.predicted_days)}</b>, below your ${fmt(sl.target_days, 0)}-day target. Improve cold storage or shorten the supply chain.`, `सर्वोत्तम विकल्प भी लगभग <b>${days(sl.predicted_days)}</b> देता है, जो आपके ${fmt(sl.target_days, 0)} दिन के लक्ष्य से कम है। शीत भंडारण सुधारें या आपूर्ति शृंखला छोटी करें।`);
  return `<section class="simple" aria-labelledby="simpleH"><div class="ico">${icon("check", 26)}</div><div>
    <h2 id="simpleH">${L("In simple words", "सरल शब्दों में")}</h2><p style="margin:0">${head}</p>
    <ol>${steps.map(s => `<li>${s}</li>`).join("")}</ol>
    <p class="muted" style="margin:8px 0 0;font-size:.9rem">${L(`Cost: about ${inr(top.cost.per_pack_inr)} per pack · ${recycleLabel(top.sustainability.recyclability)}`, `लागत: लगभग ${inr(top.cost.per_pack_inr)} प्रति पैक · ${recycleLabel(top.sustainability.recyclability)}`)}</p>
  </div></section>`;
}

function reqSummary(r) {
  const p = r.profile, q = r.requirements;
  const parts = [];
  if (p.is_produce) parts.push(L(`This is living produce — it breathes at ≈${fmt(q.map.respiration_rate_at_storage_ml_o2_kg_h)} mL O₂/kg·h, so the pack must let some air in.`, `यह जीवित उपज है — यह ≈${fmt(q.map.respiration_rate_at_storage_ml_o2_kg_h)} mL O₂/kg·h की दर से साँस लेती है, इसलिए पैक में कुछ हवा आनी चाहिए।`));
  if (q.otr_max_spec !== null) parts.push(L(`Oxygen must be kept out: OTR ≤ ${fmt(q.otr_max_spec, 2)} cc/m²·day.`, `ऑक्सीजन रोकनी होगी: OTR ≤ ${fmt(q.otr_max_spec, 2)} cc/m²·दिन।`));
  if (q.wvtr_max_spec !== null) parts.push(L(`Moisture must be controlled: WVTR ≤ ${fmt(q.wvtr_max_spec, 2)} g/m²·day.`, `नमी नियंत्रित करनी होगी: WVTR ≤ ${fmt(q.wvtr_max_spec, 2)} g/m²·दिन।`));
  if (q.light_barrier_min_pct) parts.push(L(`Needs ≥ ${q.light_barrier_min_pct} % light protection.`, `≥ ${q.light_barrier_min_pct} % प्रकाश सुरक्षा चाहिए।`));
  if (!parts.length) parts.push(L("Barrier needs are modest — strength and hygiene matter most.", "बैरियर की आवश्यकता कम है — मज़बूती और स्वच्छता सबसे ज़रूरी।"));
  return parts.join(" ");
}

export async function resultPage(main, id) {
  loading(main, L("Loading recommendation…", "सिफ़ारिश लोड हो रही है…"));
  let r;
  try { r = await api.get(`/api/recommendations/${id}`); } catch (e) { return errorBox(main, e); }
  const list = await commodities().catch(() => []);
  const cinfo = list.find(c => c.id === r.profile.commodity_id);
  const p = r.profile, q = r.requirements, recs = r.recommendations;
  const pname = cinfo ? cname(cinfo) : p.name;
  const top = recs[0];
  const engNote = isHi() ? `<p class="muted" style="font-size:.82rem;margin:6px 0 0">ℹ ${"तकनीकी विवरण (कारण, चेतावनियाँ, अनुपालन) अंग्रेज़ी में हैं।"}</p>` : "";

  main.innerHTML = pageHead({
    title: pname, icon: "doc",
    crumbs: [[L("Packaging advice", "पैकेजिंग सलाह"), "/recommend"]],
    desc: `${esc(catLabel(p.category))} · ${esc(storageLabel(p.storage))} ${fmt(p.temp)} °C · ${fmt(p.rh, 0)} % RH · ${L("target", "लक्ष्य")} ${fmt(p.desired_days, 0)} ${L("days", "दिन")} · ${fmt(p.weight_kg, 3)} kg · ${esc(transportLabel(p.transport))} · ${L("Report", "रिपोर्ट")} ${esc(r.id)}`,
    actions: `<a class="btn" href="/api/recommendations/${r.id}/report.pdf" target="_blank" rel="noopener">${icon("doc", 18)} ${L("Download PDF report", "PDF रिपोर्ट डाउनलोड")}</a>
      <button class="btn secondary" id="certBtn">${icon("shield", 18)} ${r.certified_tx ? L("Certified on PackChain ✓", "PackChain पर प्रमाणित ✓") : L("Certify on PackChain", "PackChain पर प्रमाणित करें")}</button>
      <a class="btn secondary" href="/trace?rec=${r.id}" data-link>${icon("qr", 18)} ${L("Create QR batch", "QR बैच बनाएँ")}</a>
      <a class="btn ghost" href="/recommend?from=${r.id}" data-link>${L("Edit inputs", "इनपुट बदलें")}</a>
      <button class="btn ghost" onclick="window.print()">${L("Print", "प्रिंट")}</button>`,
  }) + `<div class="wrap page-body">
  ${(r.notes || []).map(n => `<div class="callout warn" style="margin-bottom:10px">⚠ ${esc(n)}</div>`).join("")}
  ${!recs.length ? `<div class="callout crit">${L("No packaging option satisfies all your conditions. Relax the budget / recyclable-only / transparency choices, or review storage conditions. See the rejected options below.", "कोई भी पैकेजिंग विकल्प सभी शर्तें पूरी नहीं करता। बजट / केवल-पुनर्चक्रण / पारदर्शिता विकल्प ढीले करें या भंडारण स्थिति देखें। नीचे अस्वीकृत विकल्प देखें।")}</div>` : simpleSummary(r, pname)}

  ${top ? `<div class="grid g3" style="margin:18px 0">
    <div class="card"><div class="stat"><span class="l">${L("Best match", "सर्वोत्तम विकल्प")}</span><span class="v" style="font-size:1.15rem">${esc(top.name)}</span><span class="l">${esc(famLabel(top.family, top.family_label))}</span></div></div>
    <div class="card"><div class="stat"><span class="l">${L("Predicted shelf life", "अनुमानित शेल्फ-लाइफ")}</span><span class="v">${days(top.shelf_life.predicted_days)}</span>
      <span class="l">${top.meets_target ? statusBadge("good", L("meets target", "लक्ष्य पूरा")) : statusBadge("warn", L(`${Math.round(top.shelf_life.ratio * 100)} % of target`, `लक्ष्य का ${Math.round(top.shelf_life.ratio * 100)} %`))} · ${L("limited by", "सीमित कारक:")} ${esc(mechLabel(top.shelf_life.limiting_label || "").toLowerCase())}</span></div></div>
    <div class="card"><div class="stat"><span class="l">${L("Cost & footprint", "लागत और कार्बन")}</span><span class="v">${inr(top.cost.per_pack_inr)}<small class="muted" style="font-size:.9rem"> ${L("/pack", "/पैक")}</small></span>
      <span class="l">${fmt(top.cost.co2e_g)} g CO₂e · ${L("eco score", "पर्यावरण अंक")} ${fmt(top.sustainability.score, 0)}/100</span></div></div>
  </div>` : ""}

  <div class="card"><h2 class="card-title">${L("What your product needs from its package", "आपके उत्पाद को पैकेज से क्या चाहिए")}</h2>
    <p>${reqSummary(r)}</p>
    <div class="grid g2">${kv({
      [L("Main spoilage risks", "मुख्य ख़राबी जोखिम")]: q.drivers.length ? q.drivers.map(d => `<span class="badge">${esc(driverLabel(d))}</span>`).join(" ") : L("none critical", "कोई गंभीर नहीं"),
      [L("Max OTR (23 °C, 0 % RH)", "अधिकतम OTR (23 °C, 0 % RH)")]: q.otr_max_spec !== null ? `≤ ${fmt(q.otr_max_spec, 3)} cc/m²·day` : L(q.otr_range_for_map_spec ? "breathable (MAP)" : "not critical", q.otr_range_for_map_spec ? "श्वसनशील (MAP)" : "महत्वपूर्ण नहीं"),
      [L("OTR window for breathable pack", "श्वसनशील पैक हेतु OTR सीमा")]: q.otr_range_for_map_spec ? `${fmt(q.otr_range_for_map_spec[0], 0)} – ${fmt(q.otr_range_for_map_spec[1], 0)} cc/m²·day` : "–",
      [L("Ideal CO₂/O₂ selectivity (β)", "आदर्श CO₂/O₂ चयनात्मकता (β)")]: q.beta_range_for_map ? `${fmt(q.beta_range_for_map[0])} – ${fmt(q.beta_range_for_map[1])}` : "–",
      [L("Max WVTR (38 °C, 90 % RH)", "अधिकतम WVTR (38 °C, 90 % RH)")]: q.wvtr_max_spec !== null ? `≤ ${fmt(q.wvtr_max_spec, 3)} g/m²·day` : L("not critical", "महत्वपूर्ण नहीं"),
    })}${kv({
      [L("Light barrier", "प्रकाश बैरियर")]: q.light_barrier_min_pct ? `≥ ${q.light_barrier_min_pct} %` : L("not required", "आवश्यक नहीं"),
      [L("Grease resistance", "तेल-रोधकता")]: esc({ high: L("high", "उच्च"), moderate: L("moderate", "मध्यम"), low: L("low", "कम") }[q.grease_resistance] || q.grease_resistance),
      [L("Minimum strength (LDPE-equivalent)", "न्यूनतम मज़बूती (LDPE-समतुल्य)")]: `≥ ${fmt(q.min_ldpe_equivalent_thickness_um, 0)} µm`,
      [L("Temperature range", "तापमान सीमा")]: `${fmt(q.service_temperature_c[0])} → ${fmt(q.service_temperature_c[1])} °C`,
      "MAP": q.map.applicable ? (q.map.o2_window ? `${q.map.o2_window[0]}–${q.map.o2_window[1]} % O₂, ${q.map.co2_window?.[0]}–${q.map.co2_window?.[1]} % CO₂` : Object.entries(q.map.gas_mix || {}).map(([k, v]) => `${k} ${v}%`).join(", ")) : L("not applicable", "लागू नहीं"),
    })}</div>
  </div>

  <div class="section-title"><h2>${L("Ranked packaging options", "क्रमबद्ध पैकेजिंग विकल्प")}</h2><p>${L("Click an option to see full specifications.", "पूर्ण विनिर्देश देखने हेतु विकल्प पर क्लिक करें।")}</p></div>
  ${engNote}
  <div id="recList">${recs.map((x, i) => recCard(x, i === 0)).join("")}</div>

  <div class="grid g2" style="margin-top:18px">
    <div class="card"><h3 class="card-title">${L("Shelf life vs storage temperature", "शेल्फ-लाइफ बनाम भंडारण तापमान")}</h3><p class="muted">${L("Days for the top options at different temperatures. Dashed line = your target.", "विभिन्न तापमान पर शीर्ष विकल्पों के दिन। डैश रेखा = आपका लक्ष्य।")}</p>
      <div class="chart-box"><canvas id="tempChart" aria-label="${L("Shelf life versus temperature chart", "शेल्फ-लाइफ बनाम तापमान चार्ट")}"></canvas></div></div>
    ${r.map_simulation ? `<div class="card"><h3 class="card-title">${L("Air inside the pack over time", "समय के साथ पैक के अंदर की हवा")}</h3><p class="muted">${esc(r.map_simulation.name)} · ${L("shaded bands = recommended range", "छायांकित पट्टी = अनुशंसित सीमा")}</p>
      <div class="chart-box"><canvas id="mapChart"></canvas></div></div>`
      : `<div class="card"><h3 class="card-title">${L("Packaging cost per kg of product", "प्रति किलो उत्पाद पैकेजिंग लागत")}</h3><p class="muted">${L("Lower is cheaper.", "कम = सस्ता।")}</p><div class="chart-box"><canvas id="costChart"></canvas></div></div>`}
  </div>
  ${r.map_simulation ? `<div class="card" style="margin-top:16px"><h3 class="card-title">${L("Packaging cost per kg of product", "प्रति किलो उत्पाद पैकेजिंग लागत")}</h3><div class="chart-box short"><canvas id="costChart"></canvas></div></div>` : ""}

  <div class="section-title"><h2>${L("Trade-off alternatives", "वैकल्पिक चयन")}</h2></div>
  <div class="grid g3">
    ${Object.entries(r.alternatives || {}).map(([k, a]) => `<div class="card"><div class="stat"><span class="l">${esc({ most_sustainable: L("Most eco-friendly", "सबसे पर्यावरण-अनुकूल"), lowest_cost: L("Lowest cost", "सबसे कम लागत"), longest_shelf_life: L("Longest shelf life", "सबसे लंबी शेल्फ-लाइफ") }[k] || k)}</span>
      <span class="v" style="font-size:1.05rem">${esc(a.name)}</span>
      <span class="l">${days(a.shelf_life_days)} · ${inr(a.cost_per_pack)}${L("/pack", "/पैक")} · ${L("eco", "पर्यावरण")} ${fmt(a.eco_score, 0)} · ${esc(recycleLabel(a.recyclability))} ${a.meets_target ? "" : statusBadge("warn", L("below target", "लक्ष्य से कम"))}</span></div></div>`).join("")}
  </div>

  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3 class="card-title">${icon("ai", 20)} ${L("AI insights", "AI अंतर्दृष्टि")}</h3>${mlBlock(r.ml)}</div>
    <div class="card"><h3 class="card-title">${L("Outer packing, storage & handling", "बाहरी पैकिंग, भंडारण और रख-रखाव")}</h3>${engNote}
      <ul class="clean">${(r.secondary_packaging || []).map(s => `<li><b>${esc(s.item)}</b> — ${esc(s.detail)}</li>`).join("")}
      ${(r.storage_guidance || []).map(g => `<li>${esc(g)}</li>`).join("")}</ul></div>
  </div>

  <div class="card" style="margin-top:16px"><details><summary>${L(`Rejected options (${r.rejected.length}) — why they were excluded`, `अस्वीकृत विकल्प (${r.rejected.length}) — क्यों हटाए गए`)}</summary>
    <div style="margin-top:10px">${table([{ label: L("Option", "विकल्प"), key: "name" }, { label: L("Reason(s)", "कारण"), render: x => esc(x.reasons.join("; ")) }], r.rejected, { maxh: 360 })}</div></details></div>

  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3 class="card-title">${L("Tell us how it worked — this improves the AI", "बताइए यह कैसा रहा — इससे AI बेहतर होता है")}</h3>
      <form id="fbForm" class="fields" style="grid-template-columns:1fr 1fr">
        <label class="f">${L("Package you used", "आपने कौन-सा पैक उपयोग किया")}<select name="solution_id">${recs.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></label>
        <label class="f">${L("Rating", "रेटिंग")}<select name="rating">${[5, 4, 3, 2, 1].map(v => `<option value="${v}">${"★".repeat(v)}</option>`).join("")}</select></label>
        <label class="f">${L("Actual shelf life (days)", "वास्तविक शेल्फ-लाइफ (दिन)")}<input name="observed_shelf_life_days" type="number" min="0" step="1"></label>
        <label class="f">${L("Comments", "टिप्पणी")}<input name="notes" maxlength="500"></label>
        <div><button class="btn sm" type="submit">${L("Submit feedback", "प्रतिक्रिया भेजें")}</button></div>
      </form></div>
    <div class="card"><h3 class="card-title">${icon("shield", 20)} ${L("Report integrity", "रिपोर्ट की प्रामाणिकता")}</h3>${kv({
      [L("Report fingerprint (SHA-256)", "रिपोर्ट फ़िंगरप्रिंट (SHA-256)")]: `<span class="mono">${esc(r.result_hash)}</span>`,
      [L("PackChain record", "PackChain रिकॉर्ड")]: r.certified_tx ? `<a class="mono" href="/ledger?tx=${r.certified_tx}" data-link>${esc(r.certified_tx.slice(0, 24))}…</a>` : L("not certified yet", "अभी प्रमाणित नहीं"),
      [L("Verify", "सत्यापन")]: `<a href="/verify-report/${r.id}" data-link>${L("Public verification page", "सार्वजनिक सत्यापन पृष्ठ")}</a>`,
      [L("Engine / AI version", "इंजन / AI संस्करण")]: `v${esc(r.engine_version)} / ${esc(r.ml?.model_version || "–")} · ${fmt(r.compute_ms)} ms · ${r.evaluated} ${L("options evaluated", "विकल्प जाँचे")}`,
    })}</div>
  </div></div>`;

  $$(".rec", main).forEach(card => {
    const head = card.querySelector(".rec-head");
    head.addEventListener("click", () => {
      const b = card.querySelector(".rec-body"); b.hidden = !b.hidden;
      head.setAttribute("aria-expanded", !b.hidden);
      if (!b.hidden) drawMech(card);
    });
    head.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); head.click(); } });
    $$(".tabs button", card).forEach(btn => btn.addEventListener("click", () => {
      $$(".tabs button", card).forEach(b => b.setAttribute("aria-selected", b === btn));
      $$("[data-pane]", card).forEach(pn => pn.hidden = pn.dataset.pane !== btn.dataset.tab);
      if (btn.dataset.tab === "life") drawMech(card);
    }));
  });

  $("#certBtn").addEventListener("click", async () => {
    if (r.certified_tx) return window.packaiNavigate(`/verify-report/${r.id}`);
    try { const c = await api.post(`/api/recommendations/${r.id}/certify`); toast(L(`Certified in block #${c.block_index}`, `ब्लॉक #${c.block_index} में प्रमाणित`)); resultPage(main, id); }
    catch (e) { toast(e.message); }
  });
  $("#fbForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target;
    try {
      const res = await api.post(`/api/recommendations/${r.id}/feedback`, { solution_id: f.solution_id.value, rating: +f.rating.value,
        observed_shelf_life_days: f.observed_shelf_life_days.value ? +f.observed_shelf_life_days.value : null, notes: f.notes.value || null });
      toast(res.used_for_training ? L("Thank you! Added to the AI training data.", "धन्यवाद! AI प्रशिक्षण डेटा में जोड़ा गया।") : L("Thank you! Feedback saved.", "धन्यवाद! प्रतिक्रिया सहेजी गई।"));
      f.reset();
    } catch (err) { toast(err.message); }
  });

  const S = series();
  if (r.temperature_curve) {
    const tc = r.temperature_curve;
    chart($("#tempChart"), {
      type: "line",
      data: { labels: tc.temps, datasets: [
        ...tc.series.slice(0, 4).map((s, i) => ({ label: s.name, data: s.days, borderColor: S[i], backgroundColor: S[i], borderWidth: 2, pointRadius: 3, pointHoverRadius: 6, tension: .25 })),
        { label: L("Target", "लक्ष्य"), data: tc.temps.map(() => p.desired_days), borderColor: css("--text-3"), borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0 },
      ] },
      options: { scales: { x: { title: { text: L("Storage temperature (°C)", "भंडारण तापमान (°C)") } }, y: { type: "logarithmic", title: { text: L("Shelf life (days, log scale)", "शेल्फ-लाइफ (दिन, लॉग स्केल)") } } },
        plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt(c.parsed.y)} ${L("days", "दिन")}` } } } },
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
        { label: L("Oxygen O₂ %", "ऑक्सीजन O₂ %"), data: m.curve.map(pt => pt.o2), borderColor: S[0], backgroundColor: S[0], borderWidth: 2, pointRadius: 0, tension: .2 },
        { label: L("Carbon dioxide CO₂ %", "कार्बन डाइऑक्साइड CO₂ %"), data: m.curve.map(pt => pt.co2), borderColor: S[1], backgroundColor: S[1], borderWidth: 2, pointRadius: 0, tension: .2 },
        ...band(m.target_o2, S[0]), ...band(m.target_co2, S[1]),
      ] },
      options: { scales: { x: { title: { text: L("Hours after packing", "पैकिंग के बाद घंटे") }, ticks: { maxTicksLimit: 8, callback(v) { return Math.round(this.getLabelForValue(v)); } } }, y: { title: { text: L("Gas (%)", "गैस (%)") }, min: 0 } },
        plugins: { legend: { labels: { filter: it => !it.text.startsWith("_") } }, tooltip: { filter: it => !it.dataset.label.startsWith("_") } } },
    });
  }
  if (recs.length) {
    chart($("#costChart"), {
      type: "bar",
      data: { labels: recs.map(x => x.name.length > 32 ? x.name.slice(0, 30) + "…" : x.name), datasets: [{ label: L("₹ per kg of product", "₹ प्रति किलो उत्पाद"), data: recs.map(x => x.cost.per_kg_product_inr), backgroundColor: S[0], borderRadius: 4, maxBarThickness: 34 }] },
      options: { indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `₹${fmt(c.parsed.x, 2)} / kg · ${L("eco", "पर्यावरण")} ${fmt(recs[c.dataIndex].sustainability.score, 0)}/100` } } },
        scales: { x: { title: { text: L("₹ per kg of product", "₹ प्रति किलो उत्पाद") }, beginAtZero: true }, y: { grid: { display: false } } } },
    });
  }
  const first = $(".rec", main); if (first) drawMech(first);
}

function recCard(x, open) {
  const s = x.specs, sl = x.shelf_life, m = s.map || {}, seal = s.seal || {};
  const ratio = Math.min(1, sl.ratio);
  return `<article class="rec ${open ? "top" : ""}" data-id="${x.id}">
    ${open ? `<div class="top-ribbon">★ ${L("RECOMMENDED", "अनुशंसित")}</div>` : ""}
    <div class="rec-head" role="button" tabindex="0" aria-expanded="${open}">
      <div class="rec-rank">${x.rank}</div>
      <div><div class="rec-title">${esc(x.name)}</div>
        <div class="rec-sub">${esc(s.structure)}</div>
        <div class="row" style="margin-top:6px">
          <span class="badge">${esc(famLabel(x.family, x.family_label))}</span>
          ${x.meets_target ? statusBadge("good", `${days(sl.predicted_days)}`) : statusBadge("warn", `${days(sl.predicted_days)} (${L("< target", "< लक्ष्य")})`)}
          ${m.suitable ? `<span class="badge brand">${esc(techLabel(m.technique))}</span>` : ""}
          ${x.warnings.some(w => w.level === "major") ? statusBadge("crit", L("important caution", "महत्वपूर्ण सावधानी")) : ""}
          <span class="badge">${esc(recycleLabel(x.sustainability.recyclability))}</span>
        </div></div>
      <div class="rec-score"><div class="v">${fmt(x.scores.overall, 0)}</div><small class="muted">${L("score / 100", "अंक / 100")}</small></div>
    </div>
    <div class="rec-body" ${open ? "" : "hidden"}>
      <div class="mini-metrics">
        <div class="mm"><div class="l">${L("Shelf life", "शेल्फ-लाइफ")}</div><div class="v">${days(sl.predicted_days)}</div>${scoreBar(ratio * 100)}</div>
        <div class="mm"><div class="l">${L("Cost per pack", "प्रति पैक लागत")}</div><div class="v">${inr(x.cost.per_pack_inr)}</div><small class="muted">${inr(x.cost.per_1000_inr)} / 1000</small></div>
        <div class="mm"><div class="l">${L("Eco score", "पर्यावरण अंक")}</div><div class="v">${fmt(x.sustainability.score, 0)}/100</div>${scoreBar(x.sustainability.score)}</div>
        <div class="mm"><div class="l">${L("Science / AI / cost", "विज्ञान / AI / लागत")}</div><div class="v" style="font-size:.95rem">${fmt(x.scores.technical, 0)} / ${fmt(x.scores.ml, 0)} / ${inr(x.scores.cost_per_kg)}/kg</div></div>
      </div>
      <div class="tabs" role="tablist">
        <button data-tab="spec" aria-selected="true">${L("Specifications", "विनिर्देश")}</button>
        <button data-tab="life" aria-selected="false">${L("Shelf life & reasons", "शेल्फ-लाइफ और कारण")}</button>
        <button data-tab="eco" aria-selected="false">${L("Cost & environment", "लागत और पर्यावरण")}</button>
        <button data-tab="reg" aria-selected="false">${L("Compliance", "अनुपालन")}</button>
      </div>
      <div data-pane="spec"><div class="grid g2">
        ${kv({
          [L("Structure", "संरचना")]: esc(s.structure),
          [L("Thickness / weight", "मोटाई / वज़न")]: `${fmt(s.total_thickness_um, 0)} µm · ${fmt(s.grammage_gsm, 1)} g/m²`,
          [L("OTR (23 °C, 0 % RH)", "OTR (23 °C, 0 % RH)")]: s.otr_spec !== null ? `${fmt(s.otr_spec, 3)} cc/m²·day` : L("open / ventilated", "खुला / हवादार"),
          [L("OTR at storage", "भंडारण पर OTR")]: s.otr_at_storage !== null ? `${fmt(s.otr_at_storage, 3)} cc/m²·day·atm` : "–",
          [L("WVTR (38 °C, 90 % RH)", "WVTR (38 °C, 90 % RH)")]: s.wvtr_spec !== null ? `${fmt(s.wvtr_spec, 3)} g/m²·day` : L("open / ventilated", "खुला / हवादार"),
          [L("WVTR at storage", "भंडारण पर WVTR")]: s.wvtr_at_storage !== null ? `${fmt(s.wvtr_at_storage, 3)} g/m²·day` : "–",
          [L("CO₂TR / β (CO₂:O₂)", "CO₂TR / β (CO₂:O₂)")]: s.co2tr_spec !== null ? `${fmt(s.co2tr_spec)} / ${fmt(s.beta_co2_o2)}` : "–",
          [L("Pack size", "पैक आकार")]: esc(packDims(s.pack_dimensions)),
        })}
        ${kv({
          [L("Sealing", "सीलिंग")]: `${esc(seal.method)}${seal.temp_range ? ` · ${seal.temp_range[0]}–${seal.temp_range[1]} °C` : ""}${seal.min_strength_n_15mm ? ` · ≥ ${seal.min_strength_n_15mm} N/15 mm` : ""}`,
          [L("Strength", "मज़बूती")]: `${s.tensile_mpa !== null ? fmt(s.tensile_mpa, 0) + " MPa" : "–"} · ${L("puncture", "छेद-रोधकता")}: ${esc(s.puncture_resistance)}`,
          "MAP": m.suitable ? `${esc(techLabel(m.technique))}${m.gas ? " · " + Object.entries(m.gas).map(([k, v]) => `${k} ${v}%`).join(", ") : ""}${m.eq_o2 !== undefined ? ` · ${fmt(m.eq_o2)} % O₂ / ${fmt(m.eq_co2)} % CO₂` : ""}${m.perforations ? ` · ${m.perforations} × ${fmt(m.perf_diameter_um, 0)} µm ${L("holes", "छिद्र")}` : ""}` : L("not required", "आवश्यक नहीं"),
          [L("Light barrier / look", "प्रकाश बैरियर / दिखावट")]: `${s.light_barrier_pct} % · ${esc(s.transparency)}`,
          [L("Temperature range", "तापमान सीमा")]: `${s.service_temp_c[0]} → ${s.service_temp_c[1]} °C${s.retortable ? " · retort" : ""}${s.microwavable ? " · microwave" : ""}`,
          [L("Pack formats", "पैक प्रारूप")]: esc((s.formats || []).join(", ")),
          [L("Typical uses", "सामान्य उपयोग")]: esc(x.uses || ""),
        })}</div>
        ${x.addons.length ? `<h4 style="margin-top:14px">${L("Recommended add-ons", "अनुशंसित अतिरिक्त")}</h4>${table([{ label: L("Add-on", "अतिरिक्त"), key: "item" }, { label: L("Detail", "विवरण"), key: "detail" }, { label: "₹/pack", num: true, render: a => fmt(a.cost, 2) }], x.addons)}` : ""}
      </div>
      <div data-pane="life" hidden>
        <div class="grid g2">
          <div><div class="chart-box short"><canvas class="mechChart" aria-label="${L("Shelf life by spoilage cause", "ख़राबी कारण अनुसार शेल्फ-लाइफ")}"></canvas></div>
            <p class="muted" style="margin-top:6px">${L("Each bar shows days until that cause spoils the product; the shortest bar decides the shelf life.", "हर पट्टी बताती है कि वह कारण कितने दिन में उत्पाद ख़राब करेगा; सबसे छोटी पट्टी शेल्फ-लाइफ तय करती है।")} ${L("Transport used", "परिवहन में खर्च")} ${fmt(sl.transit_consumed_pct)} %.</p></div>
          <div><h4>${L("Why this package", "यह पैक क्यों")}</h4><ul class="clean ticks">${x.reasons.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
            ${x.warnings.length ? `<h4 style="margin-top:10px">${L("Cautions", "सावधानियाँ")}</h4><ul class="clean warns">${x.warnings.map(w => `<li>${w.level === "major" ? "<b>" : ""}${esc(w.text)}${w.level === "major" ? "</b>" : ""}</li>`).join("")}</ul>` : ""}</div>
        </div>
      </div>
      <div data-pane="eco" hidden><div class="grid g2">
        ${kv({
          [L("Material / conversion / add-ons", "सामग्री / निर्माण / अतिरिक्त")]: `${inr(x.cost.material_inr)} / ${inr(x.cost.conversion_inr)} / ${inr(x.cost.addons_inr)}`,
          [L("Per pack · per 1000 · per kg", "प्रति पैक · प्रति 1000 · प्रति kg")]: `${inr(x.cost.per_pack_inr)} · ${inr(x.cost.per_1000_inr)} · ${inr(x.cost.per_kg_product_inr)}`,
          [L("Pack weight", "पैक वज़न")]: `${fmt(x.cost.pack_mass_g)} g`,
          [L("Carbon footprint", "कार्बन फ़ुटप्रिंट")]: `${fmt(x.cost.co2e_g)} g CO₂e/pack (${fmt(x.cost.co2e_g_per_kg_food)} g/kg)`,
          [L("Packaging share of total footprint", "कुल फ़ुटप्रिंट में पैकेजिंग का हिस्सा")]: `${fmt(x.footprint.packaging_share_pct)} %`,
        })}
        ${kv({
          [L("Eco score", "पर्यावरण अंक")]: `${fmt(x.sustainability.score, 0)}/100`,
          [L("Recyclability", "पुनर्चक्रण")]: esc(recycleLabel(x.sustainability.recyclability)),
          [L("End of life", "उपयोग के बाद")]: esc(x.sustainability.end_of_life),
          [L("EPR category (PWM Rules 2022)", "EPR श्रेणी (PWM नियम 2022)")]: x.sustainability.pwm_category ? `${L("Category", "श्रेणी")} ${esc(x.sustainability.pwm_category)}` : L("non-plastic", "गैर-प्लास्टिक"),
          [L("Resin code", "रेज़िन कोड")]: esc(x.sustainability.resin_code || "–"),
        })}</div></div>
      <div data-pane="reg" hidden>${table([{ label: L("Area", "क्षेत्र"), key: "area" }, { label: L("Requirement", "आवश्यकता"), key: "requirement" }], x.compliance)}</div>
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
    data: { labels: entries.map(e => mechLabel(e[0])), datasets: [{ label: L("Days", "दिन"), data: entries.map(e => Math.min(e[1], 3650)),
      backgroundColor: entries.map((e, i) => i === 0 ? S[1] : S[0]), borderRadius: 4, maxBarThickness: 26 }] },
    options: { indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${fmt(entries[c.dataIndex][1])} ${L("days", "दिन")}${c.dataIndex === 0 ? L(" (limiting)", " (सीमित कारक)") : ""}` } } },
      scales: { x: { type: "logarithmic", title: { text: `${L("Days (log)", "दिन (लॉग)")} · ${L("target", "लक्ष्य")} ${d.target}` } }, y: { grid: { display: false }, ticks: { autoSkip: false } } } },
  });
}

function mlBlock(ml) {
  if (!ml || ml.error || !ml.top_families) return `<p class="muted">${L("AI model not available yet — science-based ranking shown.", "AI मॉडल अभी उपलब्ध नहीं — विज्ञान-आधारित क्रम दिखाया गया है।")}</p>`;
  return `<p class="muted">${L("What the packaging industry typically uses for products with these properties:", "ऐसे गुणों वाले उत्पादों के लिए पैकेजिंग उद्योग आमतौर पर क्या उपयोग करता है:")}</p>
    ${ml.top_families.map(f => `<div style="margin:6px 0"><div class="row"><span>${esc(famLabel(f.family, f.label))}</span><span class="spacer"></span><b>${fmt(f.probability * 100, 0)} %</b></div>${scoreBar(f.probability * 100)}</div>`).join("")}
    ${kv({
      [L("AI-estimated max OTR", "AI-अनुमानित अधिकतम OTR")]: ml.predicted_otr_max_spec ? `${fmt(ml.predicted_otr_max_spec, 3)} cc/m²·day` : "–",
      [L("AI-estimated max WVTR", "AI-अनुमानित अधिकतम WVTR")]: ml.predicted_wvtr_max_spec ? `${fmt(ml.predicted_wvtr_max_spec, 3)} g/m²·day` : "–",
      [L("AI-estimated achievable life", "AI-अनुमानित संभव शेल्फ-लाइफ")]: ml.predicted_best_shelf_life_days ? days(ml.predicted_best_shelf_life_days) : "–",
    })}
    <h4 style="margin-top:12px">${L("Similar products", "मिलते-जुलते उत्पाद")}</h4>
    <ul class="clean">${(ml.similar_commodities || []).map(s => `<li><b>${esc(cname((COMMODITIES || []).find(c => c.id === s.id) || s))}</b> <small class="muted">${L("similarity", "समानता")} ${fmt(s.similarity, 2)}</small><br><small>${esc(s.typical_packaging.map(famFromLabel).join(" · "))}</small></li>`).join("")}</ul>`;
}
