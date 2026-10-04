import { api, actorStore } from "../api.js";
import { L, roleLabel, eventLabel, techLabel, ROLES, EVENTS } from "../i18n.js";
import { $, esc, fmt, days, toast, loading, errorBox, table, kv, statusBadge, css, pageHead } from "../ui.js";

const traceCrumb = () => [[L("Traceability", "ट्रेसबिलिटी"), null]];
const when = ts => new Date(ts * 1000).toLocaleString(L("en-IN", "hi-IN"), { dateStyle: "medium", timeStyle: "short" });

function actorBar() {
  const cur = actorStore.current(), list = actorStore.list();
  return `<div class="row">
    <span class="muted">${L("Working as:", "किसके रूप में:")}</span>
    ${list.length ? `<select id="actSel" style="max-width:340px" aria-label="${L("Current stakeholder", "वर्तमान हितधारक")}">${list.map(a => `<option value="${a.actor_id}" ${cur && cur.actor_id === a.actor_id ? "selected" : ""}>${esc(a.name)} — ${esc(roleLabel(a.role))} (${a.actor_id})</option>`).join("")}</select>`
      : statusBadge("warn", L("Not registered on this device", "इस डिवाइस पर पंजीकरण नहीं"))}
  </div>`;
}

export async function tracePage(main) {
  const params = new URLSearchParams(location.search);
  main.innerHTML = pageHead({
    title: L("Batches & QR labels", "बैच और QR लेबल"), crumbs: traceCrumb(),
    desc: L("Register your organisation once, then create a packed batch from a packaging report and print its QR label. Every hand-over after that (dispatch, transport, cold store, shop) is recorded with a digital signature. Anyone who scans the QR can check the record and see how much shelf life is left.",
      "एक बार अपना संगठन पंजीकृत करें, फिर पैकेजिंग रिपोर्ट से पैक बैच बनाएँ और उसका QR लेबल छापें। उसके बाद हर हस्तांतरण (रवानगी, परिवहन, शीत भंडार, दुकान) डिजिटल हस्ताक्षर के साथ दर्ज होता है। QR स्कैन करने वाला कोई भी रिकॉर्ड जाँच सकता है और देख सकता है कि कितनी शेल्फ-लाइफ बची है।"),
  }) + `<div class="wrap page-body">
  <div class="grid g2">
    <div class="card"><h2 class="card-title">${L("Step 1: Your registration", "चरण 1: आपका पंजीकरण")}</h2>${actorBar()}
      <details style="margin-top:12px" ${actorStore.list().length ? "" : "open"}><summary>${L("Register a new organisation / person", "नया संगठन / व्यक्ति पंजीकृत करें")}</summary>
      <form id="actForm" class="fields" style="margin-top:10px">
        <label class="f"><span>${L("Name", "नाम")} <span class="req">*</span></span><input name="name" required minlength="2" placeholder="${L("e.g. Sahyadri FPO", "जैसे सह्याद्री FPO")}"></label>
        <label class="f">${L("Role", "भूमिका")}<select name="role">${Object.keys(ROLES).filter(k => !["consumer", "authority"].includes(k)).map(k => `<option value="${k}">${esc(roleLabel(k))}</option>`).join("")}</select></label>
        <label class="f">${L("Organisation", "संगठन")}<input name="org"></label>
        <label class="f">${L("District, State", "ज़िला, राज्य")}<input name="location"></label>
        <div><button class="btn sm">${L("Register", "पंजीकृत करें")}</button></div></form></details>
      <p class="muted" style="margin-top:10px;font-size:.84rem">${L("No crypto wallet is needed. Your signing key is kept encrypted on the server and the access key stays on this device.", "कोई क्रिप्टो वॉलेट नहीं चाहिए। आपकी हस्ताक्षर कुंजी सर्वर पर एन्क्रिप्टेड रहती है और एक्सेस कुंजी इसी डिवाइस पर।")}</p>
    </div>
    <div class="card"><h2 class="card-title">${L("Step 2: Create a packed batch", "चरण 2: पैक बैच बनाएँ")}</h2>
      <form id="batchForm" class="fields">
        <label class="f"><span>${L("Packaging report number", "पैकेजिंग रिपोर्ट संख्या")} <span class="req">*</span></span><input name="rec_id" value="${esc(params.get("rec") || "")}" placeholder="R1A2B3C4D5" required></label>
        <label class="f">${L("Packaging used", "उपयोग किया गया पैक")}<select name="solution_id"><option value="">${L("Top recommendation", "शीर्ष सिफ़ारिश")}</option></select></label>
        <label class="f"><span>${L("Quantity", "मात्रा")} <span class="req">*</span></span><input name="quantity" type="number" min="1" value="100" required></label>
        <label class="f">${L("Unit", "इकाई")}<select name="unit"><option value="packs">${L("packs", "पैक")}</option><option value="kg">kg</option><option value="crates">${L("crates", "क्रेट")}</option><option value="cartons">${L("cartons", "कार्टन")}</option></select></label>
        <label class="f">${L("Packing date", "पैकिंग तिथि")}<input name="pack_date" type="date" value="${new Date().toISOString().slice(0, 10)}"></label>
        <label class="f">${L("Origin (farm / plant)", "मूल स्थान (खेत / संयंत्र)")}<input name="origin"></label>
        <div><button class="btn saffron sm">${L("Create batch", "बैच बनाएँ")}</button></div></form>
      <p class="muted" style="font-size:.84rem;margin-top:8px">${L("Only a farmer, food processor or packhouse can create a batch.", "केवल किसान, खाद्य प्रसंस्करणकर्ता या पैकहाउस बैच बना सकते हैं।")}</p></div>
  </div>
  <div class="card" style="margin-top:14px"><h2 class="card-title">${L("All batches", "सभी बैच")}</h2><div id="batches"></div></div>
  <div class="card" id="batchDetail" hidden style="margin-top:14px"></div></div>`;

  const s = $("#actSel"); if (s) s.addEventListener("change", () => actorStore.use(s.value));
  $("#actForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target;
    try {
      const r = await api.post("/api/chain/actors", { name: f.name.value, role: f.role.value, org: f.org.value || null, location: f.location.value || null });
      actorStore.save({ ...r, name: f.name.value, role: f.role.value }); actorStore.use(r.actor_id);
      toast(L(`Registered: ${r.actor_id}`, `पंजीकृत: ${r.actor_id}`)); tracePage(main);
    } catch (err) { toast(err.message); }
  });
  const recInput = $("#batchForm").rec_id;
  const loadSolutions = async () => {
    const sel = $("#batchForm").solution_id;
    sel.innerHTML = `<option value="">${L("Top recommendation", "शीर्ष सिफ़ारिश")}</option>`;
    if (!recInput.value) return;
    try { const r = await api.get(`/api/recommendations/${recInput.value.trim()}`); sel.innerHTML += r.recommendations.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join(""); } catch { /* ignore */ }
  };
  recInput.addEventListener("change", loadSolutions); loadSolutions();
  $("#batchForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target;
    const body = { rec_id: f.rec_id.value.trim(), quantity: +f.quantity.value, unit: f.unit.value, pack_date: f.pack_date.value, origin: f.origin.value || null };
    if (f.solution_id.value) body.solution_id = f.solution_id.value;
    try { const b = await api.post("/api/chain/batches", body, actorStore.headers()); toast(L(`Batch ${b.id} created`, `बैच ${b.id} बनाया गया`)); loadBatches(b.id); }
    catch (err) { toast(err.message); }
  });

  async function loadBatches(openId) {
    const list = await api.get("/api/chain/batches");
    $("#batches").innerHTML = table([
      { label: L("Batch code", "बैच कोड"), render: b => `<a href="#" data-bid="${b.id}" class="mono">${b.id}</a>` },
      { label: L("Product", "उत्पाद"), render: b => esc(b.commodity) },
      { label: L("Packaging", "पैकेजिंग"), render: b => esc(b.solution_name) },
      { label: L("Quantity", "मात्रा"), num: true, render: b => `${fmt(b.quantity, 0)} ${esc(b.unit)}` },
      { label: L("Packed", "पैकिंग"), render: b => esc(b.pack_date) },
      { label: L("Best before", "उपयोग की अंतिम तिथि"), render: b => `<b>${esc(b.best_before)}</b>` },
      { label: L("Status", "स्थिति"), render: b => `<span class="badge">${esc(eventLabel(b.status))}</span>` },
      { label: "", render: b => `<a href="/verify/${b.id}" data-link>${L("Verify", "सत्यापित करें")}</a>` }], list, { maxh: 420 });
    if (openId) openBatch(openId);
  }
  $("#batches").addEventListener("click", e => { const a = e.target.closest("[data-bid]"); if (a) { e.preventDefault(); openBatch(a.dataset.bid); } });

  async function openBatch(id) {
    const box = $("#batchDetail"); box.hidden = false; loading(box);
    const v = await api.get(`/api/chain/verify/${id}`);
    const b = v.batch;
    box.innerHTML = `<h2 class="card-title">${L("Batch", "बैच")} ${b.id} · ${esc(b.commodity)}</h2>
      <div class="row" style="margin-bottom:12px">
        <a class="btn sm secondary" href="/api/chain/batches/${b.id}/label.pdf" target="_blank" rel="noopener">${L("Print QR label (PDF)", "QR लेबल प्रिंट करें (PDF)")}</a>
        <a class="btn sm" href="/verify/${b.id}" data-link>${L("Open public verification page", "सार्वजनिक सत्यापन पृष्ठ खोलें")}</a></div>
      <div class="grid g3" style="grid-template-columns:auto 1fr 1fr">
        <img class="qr" src="/api/chain/batches/${b.id}/qr.png" width="150" height="150" alt="${L(`QR code for batch ${b.id}`, `बैच ${b.id} का QR कोड`)}">
        <div>${kv({ [L("Packaging", "पैकेजिंग")]: esc(b.solution_name), [L("Structure", "संरचना")]: esc(b.structure), [L("Shelf life left", "बची शेल्फ-लाइफ")]: `${fmt(v.remaining_shelf_life.remaining_pct, 0)} % · ${days(v.remaining_shelf_life.remaining_days_at_storage)}` })}</div>
        <form id="evForm" class="section">
          <h3>${L("Record a hand-over / event", "हस्तांतरण / घटना दर्ज करें")}</h3>
          <div class="fields" style="grid-template-columns:1fr 1fr">
          <label class="f">${L("Event", "घटना")}<select name="event">${Object.keys(EVENTS).map(x => `<option value="${x}">${esc(eventLabel(x))}</option>`).join("")}</select></label>
          <label class="f">${L("Place", "स्थान")}<input name="location"></label>
          <label class="f">${L("Temperature (°C)", "तापमान (°C)")}<input name="temperature_c" type="number" step="0.5"></label>
          <label class="f">${L("For how many hours", "कितने घंटे")}<input name="duration_h" type="number" step="0.5" min="0"></label>
          <label class="f">${L("Humidity (%)", "आर्द्रता (%)")}<input name="rh" type="number" min="0" max="100"></label>
          <label class="f">${L("Remarks", "टिप्पणी")}<input name="notes"></label></div>
          <div class="row" style="margin-top:10px"><button class="btn sm">${L("Save with digital signature", "डिजिटल हस्ताक्षर के साथ सहेजें")}</button></div></form>
      </div>
      <details style="margin-top:12px"><summary>${L("For packaging suppliers and labs: certify the material of this batch", "पैकेजिंग आपूर्तिकर्ता और प्रयोगशाला हेतु: इस बैच की सामग्री प्रमाणित करें")}</summary>
        <form id="certForm" class="fields" style="margin-top:10px">
          <label class="f">${L("Material id", "सामग्री id")}<input name="material_id" value="${esc(b.solution_id)}"></label>
          <label class="f"><span>${L("Supplier lot number", "आपूर्तिकर्ता लॉट संख्या")} <span class="req">*</span></span><input name="supplier_lot" required></label>
          <label class="f">${L("Measured OTR", "मापा गया OTR")}<input name="measured_otr" type="number" step="any"></label>
          <label class="f">${L("Measured WVTR", "मापा गया WVTR")}<input name="measured_wvtr" type="number" step="any"></label>
          <label class="f">${L("Migration test (IS 9845)", "माइग्रेशन परीक्षण (IS 9845)")}<select name="migration_test_pass"><option value="">${L("not tested", "परीक्षण नहीं")}</option><option value="true">${L("pass", "उत्तीर्ण")}</option><option value="false">${L("fail", "अनुत्तीर्ण")}</option></select></label>
          <label class="f">${L("Certificate number", "प्रमाणपत्र संख्या")}<input name="certificate_ref"></label>
          <div><button class="btn sm">${L("Sign certificate", "प्रमाणपत्र पर हस्ताक्षर करें")}</button></div></form></details>
      <h3 style="margin-top:14px">${L("Movement history", "आवागमन इतिहास")}</h3>${timeline(v.history)}`;
    $("#evForm").addEventListener("submit", async e => {
      e.preventDefault();
      const f = e.target, body = { event: f.event.value };
      for (const k of ["location", "notes"]) if (f[k].value) body[k] = f[k].value;
      for (const k of ["temperature_c", "duration_h", "rh"]) if (f[k].value !== "") body[k] = +f[k].value;
      try { await api.post(`/api/chain/batches/${id}/events`, body, actorStore.headers()); toast(L("Event saved", "घटना सहेजी गई")); loadBatches(id); }
      catch (err) { toast(err.message); }
    });
    $("#certForm").addEventListener("submit", async e => {
      e.preventDefault();
      const f = e.target, body = { material_id: f.material_id.value, supplier_lot: f.supplier_lot.value, batch_id: id, certificate_ref: f.certificate_ref.value || null };
      if (f.measured_otr.value) body.measured_otr = +f.measured_otr.value;
      if (f.measured_wvtr.value) body.measured_wvtr = +f.measured_wvtr.value;
      if (f.migration_test_pass.value) body.migration_test_pass = f.migration_test_pass.value === "true";
      try { await api.post("/api/chain/material-certificates", body, actorStore.headers()); toast(L("Certificate saved", "प्रमाणपत्र सहेजा गया")); }
      catch (err) { toast(err.message); }
    });
  }
  loadBatches(params.get("batch"));
}

function timeline(history) {
  return `<ol class="timeline">${history.map(h => {
    const p = h.payload;
    const title = h.type === "BATCH_CREATED" ? L(`Packed in ${esc(p.solution_name)}`, `${esc(p.solution_name)} में पैक किया`)
      : h.type === "MATERIAL_CERTIFIED" ? L(`Packaging material certified (lot ${esc(p.supplier_lot)})`, `पैकेजिंग सामग्री प्रमाणित (लॉट ${esc(p.supplier_lot)})`)
        : esc(eventLabel(p.event || h.type));
    const hasT = p.temperature_c !== null && p.temperature_c !== undefined;
    return `<li><b>${title}</b> ${h.signature_valid ? statusBadge("good", L("signed", "हस्ताक्षरित")) : statusBadge("crit", L("signature invalid", "हस्ताक्षर अमान्य"))}<br>
      <small class="muted">${when(h.timestamp)} · ${esc(h.actor.name || h.actor.id)} (${esc(roleLabel(h.actor.role || ""))})</small>
      ${p.location || hasT ? `<br><small>${esc(p.location || "")} ${hasT ? `· ${p.temperature_c} °C` : ""} ${p.duration_h ? L(`for ${p.duration_h} h`, `${p.duration_h} घंटे`) : ""} ${p.notes ? "· " + esc(p.notes) : ""}</small>` : ""}</li>`;
  }).join("")}</ol>`;
}

export async function ledgerPage(main) {
  main.innerHTML = pageHead({
    title: L("PackChain ledger", "PackChain लेजर"), crumbs: traceCrumb(),
    desc: L("All traceability records are kept in a chain of blocks. Each block carries a fingerprint (SHA-256) of the previous one and every record is digitally signed, so any later change is detected.",
      "सभी ट्रेसबिलिटी रिकॉर्ड ब्लॉकों की एक शृंखला में रखे जाते हैं। हर ब्लॉक में पिछले ब्लॉक का फ़िंगरप्रिंट (SHA-256) होता है और हर रिकॉर्ड डिजिटल हस्ताक्षरित होता है, इसलिए बाद में कोई भी बदलाव पकड़ा जाता है।"),
    actions: `<button class="btn saffron" id="valBtn">${L("Check the entire ledger", "पूरा लेजर जाँचें")}</button>`,
  }) + `<div class="wrap page-body">
    <div id="val"></div>
    <div class="grid g2" style="margin-top:12px"><div class="card"><h2 class="card-title">${L("Public blockchain", "सार्वजनिक ब्लॉकचेन")}</h2><div id="anch"></div></div>
      <div class="card"><h2 class="card-title">${L("Find a record", "रिकॉर्ड खोजें")}</h2><form id="txForm" class="row"><input name="tx" aria-label="${L("Record id", "रिकॉर्ड id")}" placeholder="${L("record id", "रिकॉर्ड id")}" style="flex:1" value="${esc(new URLSearchParams(location.search).get("tx") || "")}"><button class="btn sm">${L("Search", "खोजें")}</button></form><div id="txOut" style="margin-top:10px"></div></div></div>
    <div class="card" style="margin-top:14px"><h2 class="card-title">${L("Latest blocks", "नवीनतम ब्लॉक")}</h2><div id="blocks"></div></div></div>`;
  const [bl, st] = await Promise.all([api.get("/api/chain/blocks?limit=40"), api.get("/api/chain/anchor/status")]);
  const typeName = t => ({ ACTOR_REGISTERED: L("Registration", "पंजीकरण"), RECOMMENDATION_CERTIFIED: L("Report certified", "रिपोर्ट प्रमाणित"), BATCH_CREATED: L("Batch packed", "बैच पैक"), CUSTODY_EVENT: L("Hand-over", "हस्तांतरण"), MATERIAL_CERTIFIED: L("Material certified", "सामग्री प्रमाणित"), QUALITY_CHECK: L("Quality check", "गुणवत्ता जाँच"), ANCHORED: L("Anchored", "एंकर") }[t] || t);
  $("#blocks").innerHTML = table([
    { label: L("Block", "ब्लॉक"), num: true, key: "index" },
    { label: L("Fingerprint", "फ़िंगरप्रिंट"), render: b => `<span class="mono">${b.hash.slice(0, 20)}…</span>` },
    { label: L("Previous block", "पिछला ब्लॉक"), render: b => `<span class="mono">${b.prev_hash.slice(0, 12)}…</span>` },
    { label: L("Records", "रिकॉर्ड"), render: b => b.transactions.map(t => `<a href="#" data-tx="${t.tx_id}">${esc(typeName(t.body.type))}</a>`).join(", ") },
    { label: L("Date & time", "दिनांक और समय"), render: b => when(b.timestamp) }], bl.blocks, { maxh: 560 });
  $("#anch").innerHTML = st.configured ? `${kv({ "Chain id": st.chain_id, [L("Contract", "कॉन्ट्रैक्ट")]: `<span class="mono">${esc(st.contract)}</span>` })}<button class="btn sm" id="anchorBtn" style="margin-top:10px">${L("Publish latest block", "नवीनतम ब्लॉक प्रकाशित करें")}</button>`
    : `<p class="muted">${L("Block fingerprints can be published to the Polygon public blockchain through the PackChainAnchor smart contract, so that anyone can verify the records independently of this portal.", "PackChainAnchor स्मार्ट कॉन्ट्रैक्ट के माध्यम से ब्लॉक फ़िंगरप्रिंट Polygon सार्वजनिक ब्लॉकचेन पर प्रकाशित किए जा सकते हैं, ताकि कोई भी इस पोर्टल से स्वतंत्र रूप से रिकॉर्ड सत्यापित कर सके।")}</p>`;
  $("#anchorBtn")?.addEventListener("click", async () => { const r = await api.post("/api/chain/anchor"); toast(r.ok ? r.tx_hash : r.reason); });
  $("#valBtn").addEventListener("click", async () => {
    loading($("#val"), L("Checking every block and signature…", "हर ब्लॉक और हस्ताक्षर जाँचे जा रहे हैं…"));
    const v = await api.get("/api/chain/validate");
    $("#val").innerHTML = `<div class="verdict ${v.valid ? "ok" : "bad"}"><span class="big">${v.valid ? "✓" : "✕"}</span><div><b>${v.valid ? L("All records are intact. No tampering found.", "सभी रिकॉर्ड सुरक्षित हैं। कोई छेड़छाड़ नहीं मिली।") : L("Some records have been altered.", "कुछ रिकॉर्ड बदले गए हैं।")}</b><br>
      <small>${v.blocks} ${L("blocks", "ब्लॉक")} · ${v.transactions} ${L("records checked", "रिकॉर्ड जाँचे")}</small>
      ${v.errors.map(er => `<div class="callout crit" style="margin-top:6px">${L("Block", "ब्लॉक")} ${er.block}: ${esc(er.error)}</div>`).join("")}</div></div>`;
  });
  const showTx = async id => {
    try {
      const r = await api.get(`/api/chain/tx/${id}`);
      $("#txOut").innerHTML = `${kv({ [L("Type", "प्रकार")]: esc(typeName(r.tx.body.type)), [L("Signed by", "हस्ताक्षरकर्ता")]: esc(r.tx.body.actor_id), [L("Block", "ब्लॉक")]: `#${r.proof.block_index}`,
        [L("Signature", "हस्ताक्षर")]: r.proof.signature_valid ? statusBadge("good", L("valid", "मान्य")) : statusBadge("crit", L("invalid", "अमान्य")),
        [L("Inclusion proof", "समावेशन प्रमाण")]: r.proof.merkle_valid ? statusBadge("good", L("valid", "मान्य")) : statusBadge("crit", L("invalid", "अमान्य")) })}
        <pre class="formula" style="white-space:pre-wrap;max-height:240px;margin-top:10px">${esc(JSON.stringify(r.tx.body.payload, null, 2))}</pre>`;
    } catch (e) { $("#txOut").innerHTML = `<div class="callout crit">${esc(e.message)}</div>`; }
  };
  $("#txForm").addEventListener("submit", e => { e.preventDefault(); showTx(e.target.tx.value.trim()); });
  $("#blocks").addEventListener("click", e => { const a = e.target.closest("[data-tx]"); if (a) { e.preventDefault(); $("#txForm").tx.value = a.dataset.tx; showTx(a.dataset.tx); } });
  if ($("#txForm").tx.value) showTx($("#txForm").tx.value);
}

export async function verifyPage(main, id) {
  if (!id) {
    main.innerHTML = pageHead({
      title: L("Verify a pack", "पैक सत्यापित करें"), crumbs: traceCrumb(),
      desc: L("Scan the QR code on the pack with your phone camera, or type the batch code printed below the QR (for example PB-1A2B3C4D).", "पैक पर लगे QR कोड को फ़ोन कैमरे से स्कैन करें, या QR के नीचे छपा बैच कोड लिखें (जैसे PB-1A2B3C4D)।"),
    }) + `<div class="wrap page-body"><div class="grid g2">
      <form class="card" id="vf"><h2 class="card-title">${L("Check a packed batch", "पैक बैच जाँचें")}</h2><label class="f">${L("Batch code", "बैच कोड")}<input name="id" placeholder="PB-XXXXXXXX" required></label><div class="row" style="margin-top:10px"><button class="btn saffron">${L("Verify", "सत्यापित करें")}</button></div></form>
      <form class="card" id="vr"><h2 class="card-title">${L("Check a packaging report", "पैकेजिंग रिपोर्ट जाँचें")}</h2><label class="f">${L("Report number", "रिपोर्ट संख्या")}<input name="id" placeholder="R1A2B3C4D5" required></label><div class="row" style="margin-top:10px"><button class="btn">${L("Check report", "रिपोर्ट जाँचें")}</button></div></form>
      </div><div class="callout" style="margin-top:14px">${L("You will see where the food came from, how it was packed, each hand-over with temperature, and how much shelf life is left.", "आप देखेंगे कि खाद्य कहाँ से आया, कैसे पैक हुआ, तापमान सहित हर हस्तांतरण, और कितनी शेल्फ-लाइफ बची है।")}</div></div>`;
    $("#vf").addEventListener("submit", e => { e.preventDefault(); window.packaiNavigate(`/verify/${e.target.id.value.trim()}`); });
    $("#vr").addEventListener("submit", e => { e.preventDefault(); window.packaiNavigate(`/verify-report/${e.target.id.value.trim()}`); });
    return;
  }
  loading(main, L("Checking records…", "रिकॉर्ड जाँचे जा रहे हैं…"));
  let v;
  try { v = await api.get(`/api/chain/verify/${id}`); } catch (e) { return errorBox(main, e); }
  const b = v.batch, rem = v.remaining_shelf_life, ok = v.verdict === "AUTHENTIC";
  const pct = rem.remaining_pct ?? 0;
  const col = pct > 50 ? css("--good") : pct > 20 ? css("--warn") : css("--crit");
  const status = { "OK": L("Fresh", "ताज़ा"), "Consume soon": L("Use soon", "जल्दी उपयोग करें"), "Expired / unsafe": L("Expired — do not use", "समाप्त — उपयोग न करें") }[rem.status] || rem.status;
  main.innerHTML = pageHead({ title: L(`Batch ${b.id}`, `बैच ${b.id}`), crumbs: [...traceCrumb(), [L("Verify a pack", "पैक सत्यापित करें"), "/verify"]] }) + `<div class="wrap page-body">
  <div class="verdict ${ok ? "ok" : "bad"}"><span class="big">${ok ? "✓" : "✕"}</span>
    <div><h2 style="margin:0">${ok ? L("Genuine pack — records verified", "असली पैक — रिकॉर्ड सत्यापित") : L("Records could not be verified", "रिकॉर्ड सत्यापित नहीं हो सके")}</h2>
    <div>${esc(b.commodity)} · ${L("packed on", "पैकिंग तिथि")} ${esc(b.pack_date)} · ${fmt(b.quantity, 0)} ${esc(b.unit)}</div></div></div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h2 class="card-title">${L("Freshness", "ताज़गी")}</h2>
      <div class="row"><b style="font-size:1.6rem">${fmt(pct, 0)} %</b><span class="muted">${L("shelf life left", "शेल्फ-लाइफ बची")} · <b>${esc(status)}</b></span></div>
      <div class="gauge" role="img" aria-label="${fmt(pct, 0)} %"><i style="width:${pct}%;background:${col}"></i></div>
      <div style="margin-top:10px">${kv({ [L("Best before (printed)", "उपयोग की अंतिम तिथि (मुद्रित)")]: `<b>${esc(b.best_before)}</b>`, [L("Days left at storage temperature", "भंडारण तापमान पर बचे दिन")]: `${days(rem.remaining_days_at_storage)} @ ${fmt(rem.storage_temp)} °C`,
        [L("Temperature problems on the way", "रास्ते में तापमान की समस्या")]: v.temperature_excursions ? statusBadge("warn", L(`${v.temperature_excursions} time(s)`, `${v.temperature_excursions} बार`)) : statusBadge("good", L("none", "कोई नहीं")) })}</div>
      <p class="muted" style="font-size:.82rem;margin-top:8px">${L("Worked out from the temperatures recorded on the way, using the same model that designed the pack.", "रास्ते में दर्ज तापमानों से, उसी मॉडल द्वारा गणना जिसने पैक डिज़ाइन किया।")}</p></div>
    <div class="card"><h2 class="card-title">${L("Packing details", "पैकिंग विवरण")}</h2>${kv({ [L("Package", "पैक")]: esc(b.solution_name), [L("Structure", "संरचना")]: esc(b.spec.structure),
        "OTR / WVTR": `${fmt(b.spec.otr_spec, 3)} / ${fmt(b.spec.wvtr_spec, 3)}`, [L("Atmosphere", "वातावरण")]: esc(techLabel(b.spec.map?.technique || "standard")) + (b.spec.map?.gas ? " · " + Object.entries(b.spec.map.gas).map(([k, x]) => `${k} ${x}%`).join(", ") : ""),
        [L("Sealing", "सीलिंग")]: esc(b.spec.seal) })}
      ${v.material_certificates.length ? `<h3 style="margin-top:10px">${L("Material certificates", "सामग्री प्रमाणपत्र")}</h3>${v.material_certificates.map(c => `<div>${c.conforms === false ? statusBadge("crit", L("does not meet spec", "विनिर्देश अनुरूप नहीं")) : statusBadge("good", L("certified", "प्रमाणित"))} ${esc(c.material_name)} · ${L("lot", "लॉट")} ${esc(c.supplier_lot)} · ${esc(c.supplier || "")}</div>`).join("")}` : ""}</div>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h2 class="card-title">${L("Journey of this pack", "इस पैक की यात्रा")}</h2>${timeline(v.history)}</div>
    <div class="card"><h2 class="card-title">${L("Security checks", "सुरक्षा जाँच")}</h2>${kv({
      [L("Batch is on the ledger", "बैच लेजर पर दर्ज है")]: v.checks.genesis_on_chain, [L("Packing details unchanged", "पैकिंग विवरण अपरिवर्तित")]: v.checks.spec_hash_matches_chain,
      [L("All signatures valid", "सभी हस्ताक्षर मान्य")]: v.checks.all_signatures_valid, [L("All records included in blocks", "सभी रिकॉर्ड ब्लॉकों में शामिल")]: v.checks.all_merkle_proofs_valid,
    }).replace(/<dd>(true|false)<\/dd>/g, (_, x) => `<dd>${x === "true" ? statusBadge("good", L("pass", "सही")) : statusBadge("crit", L("fail", "ग़लत"))}</dd>`)}
      <p style="margin-top:10px"><a href="/ledger" data-link>${L("View the ledger »", "लेजर देखें »")}</a></p></div>
  </div></div>`;
}

export async function verifyReportPage(main, id) {
  loading(main, L("Checking report…", "रिपोर्ट जाँची जा रही है…"));
  let v;
  try { v = await api.get(`/api/recommendations/${id}/verify`); } catch (e) { return errorBox(main, e); }
  const ok = v.verdict === "AUTHENTIC", pend = v.verdict === "UNCERTIFIED";
  const verdict = { AUTHENTIC: L("Genuine report — not modified", "असली रिपोर्ट — कोई बदलाव नहीं"), UNCERTIFIED: L("Report exists but is not yet certified", "रिपोर्ट मौजूद है पर अभी प्रमाणित नहीं"), TAMPERED: L("This report has been modified", "इस रिपोर्ट में बदलाव किया गया है") }[v.verdict] || v.verdict;
  main.innerHTML = pageHead({ title: L(`Report ${v.rec_id}`, `रिपोर्ट ${v.rec_id}`), crumbs: [...traceCrumb(), [L("Verify", "सत्यापन"), "/verify"]] }) + `<div class="wrap page-body">
    <div class="verdict ${ok ? "ok" : pend ? "pending" : "bad"}"><span class="big">${ok ? "✓" : pend ? "!" : "✕"}</span>
    <div><h2 style="margin:0">${esc(verdict)}</h2><div>${esc(v.commodity)} · ${esc(v.created_at.slice(0, 10))}</div></div></div>
    <div class="card" style="margin-top:14px"><h2 class="card-title">${L("Details", "विवरण")}</h2>${kv({ [L("Report fingerprint", "रिपोर्ट फ़िंगरप्रिंट")]: `<span class="mono">${esc(v.stored_hash)}</span>`,
      [L("Content unchanged", "सामग्री अपरिवर्तित")]: v.content_intact ? statusBadge("good", L("yes", "हाँ")) : statusBadge("crit", L("no", "नहीं")),
      [L("Fingerprint on ledger", "लेजर पर फ़िंगरप्रिंट")]: v.on_chain_hash ? `<span class="mono">${esc(v.on_chain_hash)}</span>` : L("not certified", "प्रमाणित नहीं"),
      [L("Ledger block", "लेजर ब्लॉक")]: v.block_index !== undefined ? `#${v.block_index}` : "–" })}
      <div class="row" style="margin-top:12px"><a class="btn" href="/result/${esc(v.rec_id)}" data-link>${L("Open report", "रिपोर्ट खोलें")}</a></div></div></div>`;
}
