import { api } from "../api.js";
import { L, cname, catLabel, famLabel, kindLabel, recycleLabel, storageLabel, CATEGORIES } from "../i18n.js";
import { $, esc, fmt, table, chart, series, kv, css, pageHead } from "../ui.js";

const res = () => [[L("Tools", "उपकरण"), null]];

export async function materialsPage(main) {
  main.innerHTML = pageHead({
    title: L("Packaging materials", "पैकेजिंग सामग्री"), icon: "flask", crumbs: res(),
    desc: L("Barrier, strength, cost, carbon and recyclability data for every film, laminate and container in the database. OTR is measured at 23 °C / 0 % RH and WVTR at 38 °C / 90 % RH — lower numbers mean better protection.",
      "डेटाबेस की हर फ़िल्म, लेमिनेट और पात्र का बैरियर, मज़बूती, लागत, कार्बन और पुनर्चक्रण डेटा। OTR 23 °C / 0 % RH और WVTR 38 °C / 90 % RH पर — कम संख्या = बेहतर सुरक्षा।"),
  }) + `<div class="wrap page-body">
    <div class="card"><h2 class="card-title">${L("Barrier map", "बैरियर मानचित्र")}</h2><p class="muted">${L("Bottom-left = best protection against oxygen and moisture. Hover a point for its name.", "नीचे-बाएँ = ऑक्सीजन और नमी से सर्वोत्तम सुरक्षा। नाम देखने हेतु बिंदु पर माउस ले जाएँ।")}</p>
      <div class="chart-box tall"><canvas id="barrierMap" aria-label="${L("Barrier map of OTR against WVTR", "OTR बनाम WVTR बैरियर मानचित्र")}"></canvas></div></div>
    <div class="card"><div class="row" style="margin-bottom:12px">
      <input id="mq" placeholder="${L("Filter by name, use or family…", "नाम, उपयोग या श्रेणी से खोजें…")}" style="max-width:340px" aria-label="${L("Filter", "फ़िल्टर")}">
      <select id="mk" style="max-width:220px" aria-label="${L("Type", "प्रकार")}"><option value="">${L("All types", "सभी प्रकार")}</option>${["mono", "laminate", "rigid", "open"].map(k => `<option value="${k}">${esc(kindLabel(k))}</option>`).join("")}</select>
      <label class="check"><input type="checkbox" id="mr">${L("Widely recyclable only", "केवल व्यापक पुनर्चक्रण योग्य")}</label></div><div id="mt"></div></div></div>`;
  const ms = await api.get("/api/materials");
  const S = series();
  const groups = ["mono", "laminate", "rigid"];
  chart($("#barrierMap"), {
    type: "scatter",
    data: { datasets: groups.map((k, i) => ({ label: kindLabel(k), data: ms.filter(m => m.kind === k && m.otr && m.wvtr).map(m => ({ x: m.otr, y: m.wvtr, name: m.name || m.short })),
      backgroundColor: S[i], borderColor: css("--surface"), borderWidth: 2, pointRadius: 6, pointHoverRadius: 9, pointStyle: ["circle", "rectRot", "triangle"][i] })) },
    options: { scales: { x: { type: "logarithmic", title: { text: L("OTR — oxygen transmission (cc/m²·day, log)", "OTR — ऑक्सीजन पारगम्यता (cc/m²·दिन, लॉग)") } }, y: { type: "logarithmic", title: { text: L("WVTR — moisture transmission (g/m²·day, log)", "WVTR — नमी पारगम्यता (g/m²·दिन, लॉग)") } } },
      plugins: { tooltip: { callbacks: { label: c => `${c.raw.name}: OTR ${fmt(c.raw.x, 3)}, WVTR ${fmt(c.raw.y, 3)}` } } } },
  });
  const draw = () => {
    const q = $("#mq").value.toLowerCase(), k = $("#mk").value, rec = $("#mr").checked;
    const rows = ms.filter(m => (!k || m.kind === k) && (!rec || m.recycle === "widely") &&
      (!q || `${m.name} ${m.short} ${m.uses} ${m.family_label} ${famLabel(m.family)}`.toLowerCase().includes(q)));
    $("#mt").innerHTML = table([
      { label: L("Material / structure", "सामग्री / संरचना"), render: m => `<b>${esc(m.name || m.short)}</b><br><small class="muted">${esc(m.structure || "")}</small>` },
      { label: L("Family", "श्रेणी"), render: m => esc(famLabel(m.family, m.family_label)) },
      { label: "OTR", num: true, render: m => fmt(m.otr, 3) },
      { label: "WVTR", num: true, render: m => fmt(m.wvtr, 3) },
      { label: L("Seal °C", "सील °C"), render: m => m.seal ? `${m.seal[0]}–${m.seal[1]}` : "–" },
      { label: L("Use °C", "उपयोग °C"), render: m => `${m.tmin ?? "–"} / ${m.tmax ?? "–"}` },
      { label: L("Light block", "प्रकाश रोध"), num: true, render: m => fmt((m.light_block || 0) * 100, 0) + " %" },
      { label: "₹/kg", num: true, render: m => fmt(m.cost_inr_kg ?? (m.cost_inr_m2 && m.grammage ? m.cost_inr_m2 / m.grammage * 1000 : null), 0) },
      { label: L("End of life", "उपयोग के बाद"), render: m => `${esc(recycleLabel(m.recycle))}${m.pwm_cat ? ` · EPR ${m.pwm_cat}` : ""}` },
      { label: L("Typical uses", "सामान्य उपयोग"), render: m => `<small>${esc(m.uses || "")}</small>` },
    ], rows, { maxh: 620 });
  };
  ["input", "change"].forEach(ev => { $("#mq").addEventListener(ev, draw); $("#mk").addEventListener(ev, draw); $("#mr").addEventListener(ev, draw); });
  draw();
}

export async function commoditiesPage(main) {
  const sp = new URLSearchParams(location.search);
  const q0 = sp.get("q") || "", cat0 = sp.get("cat") || "";
  main.innerHTML = pageHead({
    title: L("Commodity library", "उत्पाद सूची"), icon: "list", crumbs: res(),
    desc: L("Scientific profile of 96 food products — moisture, fat, breathing rate, ideal storage and the packaging the Indian market typically uses. Select a product to see details or get packaging advice.",
      "96 खाद्य उत्पादों की वैज्ञानिक प्रोफ़ाइल — नमी, वसा, श्वसन दर, आदर्श भंडारण और भारतीय बाज़ार में प्रचलित पैकेजिंग। विवरण या पैकेजिंग सलाह हेतु उत्पाद चुनें।"),
  }) + `<div class="wrap page-body">
    <div class="grid g2" style="grid-template-columns:minmax(0,1.2fr) minmax(0,1fr)">
      <div class="card"><div class="row" style="margin-bottom:12px"><input id="cq" value="${esc(q0)}" placeholder="${L("Search (English / हिन्दी)…", "खोजें (English / हिन्दी)…")}" style="max-width:300px" aria-label="${L("Search", "खोजें")}">
        <select id="cc" style="max-width:260px" aria-label="${L("Category", "श्रेणी")}"><option value="">${L("All categories", "सभी श्रेणियाँ")}</option>${Object.keys(CATEGORIES).map(k => `<option value="${k}" ${k === cat0 ? "selected" : ""}>${esc(catLabel(k))}</option>`).join("")}</select></div><div id="ct"></div></div>
      <div class="card" id="cd"><div class="empty">${L("Select a product to see its full profile.", "पूर्ण प्रोफ़ाइल देखने हेतु उत्पाद चुनें।")}</div></div></div></div>`;
  const [cs, fam] = await Promise.all([api.get("/api/commodities"), api.get("/api/families")]);
  const draw = () => {
    const q = $("#cq").value.toLowerCase(), c = $("#cc").value;
    const rows = cs.filter(x => (!c || x.category === c) && (!q || x.name.toLowerCase().includes(q) || x.id.includes(q) || (x.hi || "").includes(q)));
    $("#ct").innerHTML = table([
      { label: L("Product", "उत्पाद"), render: x => `<a href="#" data-cid="${x.id}">${esc(x.name)}</a> <small class="muted">${esc(x.hi || "")}</small>` },
      { label: L("Category", "श्रेणी"), render: x => esc(catLabel(x.category)) },
      { label: L("Storage", "भंडारण"), render: x => esc(storageLabel(x.storage)) },
      { label: "", render: x => x.respiring ? `<span class="badge brand">${L("living produce", "जीवित उपज")}</span>` : "" }], rows, { maxh: 640 });
  };
  $("#cq").addEventListener("input", draw); $("#cc").addEventListener("change", draw); draw();
  const show = async id => {
    const c = await api.get(`/api/commodities/${id}`);
    const fl = Object.fromEntries(fam.map(f => [f.id, f.label]));
    $("#cd").innerHTML = `<h2 class="card-title">${esc(cname(c))}</h2>
      ${kv({
        [L("Form", "रूप")]: esc(c.state), [L("Moisture / fat / protein", "नमी / वसा / प्रोटीन")]: `${c.moisture} % / ${c.fat} % / ${c.protein} %`, "pH · aw": `${c.ph} · ${c.aw}`,
        [L("Breathing (respiration)", "श्वसन")]: c.rr ? `${c.rr} mg CO₂/kg·h @ ${c.t_opt} °C (Q10 ${c.q10})` : L("non-living food", "निर्जीव खाद्य"),
        [L("Ethylene", "एथिलीन")]: c.rr ? `${esc(c.eth)}${c.eth_sens ? L(" · sensitive", " · संवेदनशील") : ""}${c.climacteric ? L(" · climacteric", " · क्लाइमैक्टेरिक") : ""}` : "–",
        [L("Ideal storage", "आदर्श भंडारण")]: `${c.t_opt} °C · ${c.rh_opt} % RH`, [L("Chilling limit", "ठंड सीमा")]: c.chill !== null ? `${c.chill} °C` : "–",
        [L("Best atmosphere (MAP)", "उत्तम वातावरण (MAP)")]: c.o2 ? `${c.o2[0]}–${c.o2[1]} % O₂ · ${c.co2[0]}–${c.co2[1]} % CO₂` : (c.map_gas ? Object.entries(c.map_gas).map(([k, v]) => `${k} ${v}%`).join(", ") : "–"),
        [L("Oxygen tolerance", "ऑक्सीजन सहनशीलता")]: c.o2_tol ? `${c.o2_tol} mg/kg` : "–", [L("Critical aw", "क्रांतिक aw")]: c.aw_c ?? "–",
        [L("Light sensitivity", "प्रकाश संवेदनशीलता")]: c.light, [L("Storage life", "भंडारण अवधि")]: c.base_life ? `${c.base_life} ${L("days", "दिन")} @ ${c.t_opt} °C` : "–",
        [L("Special risks", "विशेष जोखिम")]: [c.insect && L("insects", "कीट"), c.sharp && L("sharp edges/bones", "नुकीले किनारे/हड्डी"), c.fragile && L("fragile", "नाज़ुक")].filter(Boolean).join(", ") || "–",
        [L("Farm-gate carbon", "खेत-स्तर कार्बन")]: `${c.food_co2e} kg CO₂e/kg`,
        [L("Typical industry packaging", "उद्योग में प्रचलित पैकेजिंग")]: (c.practice || []).map(p => `<span class="badge">${esc(famLabel(p, fl[p]))}</span>`).join(" ") || "–",
      })}
      <div class="row" style="margin-top:14px"><a class="btn saffron" href="/recommend?c=${c.id}" data-link>${L("Get packaging advice →", "पैकेजिंग सलाह लें →")}</a></div>`;
    $("#cd").scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  $("#ct").addEventListener("click", e => { const a = e.target.closest("[data-cid]"); if (a) { e.preventDefault(); show(a.dataset.cid); } });
  const exact = q0 && cs.filter(x => x.name.toLowerCase().includes(q0.toLowerCase()) || (x.hi || "").includes(q0));
  if (exact && exact.length === 1) show(exact[0].id);
}
