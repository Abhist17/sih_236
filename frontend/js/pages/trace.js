import { api, actorStore } from "../api.js";
import { $, $$, esc, fmt, days, toast, loading, errorBox, table, kv, statusBadge, css } from "../ui.js";

const ROLE_LABEL = { farmer: "Farmer / FPO", processor: "Food processor", packer: "Packhouse", packaging_supplier: "Packaging supplier",
  transporter: "Transporter", warehouse: "Warehouse / cold store", retailer: "Retailer", lab: "Testing lab", regulator: "Regulator", consumer: "Consumer" };
const EVENTS = ["harvested", "packed", "dispatched", "in_transit", "received", "stored", "retail", "sold", "temperature_log", "quality_check", "recalled"];

function actorBar() {
  const cur = actorStore.current(), list = actorStore.list();
  return `<div class="row">
    <span class="muted">Acting as:</span>
    ${list.length ? `<select id="actSel" style="max-width:320px">${list.map(a => `<option value="${a.actor_id}" ${cur && cur.actor_id === a.actor_id ? "selected" : ""}>${esc(a.name)} — ${esc(ROLE_LABEL[a.role] || a.role)} (${a.actor_id})</option>`).join("")}</select>`
      : `<span class="badge warn">no actor registered on this device</span>`}
  </div>`;
}

export async function tracePage(main) {
  const params = new URLSearchParams(location.search);
  main.innerHTML = `<div class="page-head"><div><h1>Batches &amp; QR traceability</h1>
    <p>Every stakeholder signs their records with an Ed25519 key on <b>PackChain</b>. A packed batch carries the SHA-256 hash of its packaging specification; the QR label lets anyone verify origin, packaging and cold-chain history and see the remaining shelf life computed from logged temperatures.</p></div></div>
  <div class="grid g2">
    <div class="card"><h3>1 · Stakeholder identity</h3>${actorBar()}
      <details style="margin-top:12px" ${actorStore.list().length ? "" : "open"}><summary>Register a new stakeholder</summary>
      <form id="actForm" class="fields" style="margin-top:10px">
        <label class="f">Name<input name="name" required minlength="2" placeholder="e.g. Sahyadri FPO"></label>
        <label class="f">Role<select name="role">${Object.entries(ROLE_LABEL).filter(([k]) => k !== "consumer").map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
        <label class="f">Organisation<input name="org"></label>
        <label class="f">Location<input name="location" placeholder="District, State"></label>
        <div><button class="btn sm">Register &amp; generate keys</button></div></form></details>
      <p class="muted" style="margin-top:10px;font-size:.8rem">Keys are custodial (encrypted server-side) so farmers need no crypto wallet; the API key stays on this device.</p>
    </div>
    <div class="card"><h3>2 · Create a packed batch</h3>
      <form id="batchForm" class="fields">
        <label class="f">Recommendation ID<input name="rec_id" value="${esc(params.get("rec") || "")}" placeholder="e.g. R1A2B3C4D5" required></label>
        <label class="f">Packaging solution<select name="solution_id"><option value="">Top recommendation</option></select></label>
        <label class="f">Quantity<input name="quantity" type="number" min="1" value="100" required></label>
        <label class="f">Unit<select name="unit"><option>packs</option><option>kg</option><option>crates</option><option>cartons</option></select></label>
        <label class="f">Pack date<input name="pack_date" type="date" value="${new Date().toISOString().slice(0, 10)}"></label>
        <label class="f">Origin<input name="origin" placeholder="Farm / plant location"></label>
        <div><button class="btn sm">Create batch on PackChain</button></div></form>
      <p class="muted" style="font-size:.8rem;margin-top:8px">Requires a farmer / processor / packhouse identity.</p></div>
  </div>
  <div class="card" style="margin-top:16px"><h3>Batches</h3><div id="batches"></div></div>
  <div class="card" id="batchDetail" hidden></div>`;

  const refreshAct = () => { const s = $("#actSel"); if (s) s.addEventListener("change", () => actorStore.use(s.value)); };
  refreshAct();
  $("#actForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target;
    try {
      const r = await api.post("/api/chain/actors", { name: f.name.value, role: f.role.value, org: f.org.value || null, location: f.location.value || null });
      actorStore.save({ ...r, name: f.name.value, role: f.role.value }); actorStore.use(r.actor_id);
      toast(`Registered ${r.actor_id} (block #${r.block_index})`); tracePage(main);
    } catch (err) { toast(err.message); }
  });
  const recInput = $("#batchForm").rec_id;
  const loadSolutions = async () => {
    const sel = $("#batchForm").solution_id;
    sel.innerHTML = `<option value="">Top recommendation</option>`;
    if (!recInput.value) return;
    try { const r = await api.get(`/api/recommendations/${recInput.value.trim()}`); sel.innerHTML += r.recommendations.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join(""); } catch { /* ignore */ }
  };
  recInput.addEventListener("change", loadSolutions); loadSolutions();
  $("#batchForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target;
    const body = { rec_id: f.rec_id.value.trim(), quantity: +f.quantity.value, unit: f.unit.value, pack_date: f.pack_date.value, origin: f.origin.value || null };
    if (f.solution_id.value) body.solution_id = f.solution_id.value;
    try { const b = await api.post("/api/chain/batches", body, actorStore.headers()); toast(`Batch ${b.id} recorded in block #${b.block_index}`); loadBatches(b.id); }
    catch (err) { toast(err.message); }
  });

  async function loadBatches(openId) {
    const list = await api.get("/api/chain/batches");
    $("#batches").innerHTML = table([
      { label: "Batch", render: b => `<a href="#" data-bid="${b.id}" class="mono">${b.id}</a>` },
      { label: "Commodity", render: b => esc(b.commodity) },
      { label: "Packaging", render: b => esc(b.solution_name) },
      { label: "Qty", num: true, render: b => `${fmt(b.quantity, 0)} ${esc(b.unit)}` },
      { label: "Packed / best before", render: b => `${esc(b.pack_date)} → <b>${esc(b.best_before)}</b>` },
      { label: "Status", render: b => `<span class="badge">${esc(b.status)}</span>` },
      { label: "", render: b => `<a href="/verify/${b.id}" data-link>verify</a>` }], list, { maxh: 420 });
    if (openId) openBatch(openId);
  }
  $("#batches").addEventListener("click", e => { const a = e.target.closest("[data-bid]"); if (a) { e.preventDefault(); openBatch(a.dataset.bid); } });

  async function openBatch(id) {
    const box = $("#batchDetail"); box.hidden = false; loading(box);
    const v = await api.get(`/api/chain/verify/${id}`);
    const b = v.batch;
    box.innerHTML = `<div class="row"><h3 style="margin:0">Batch <span class="mono">${b.id}</span> · ${esc(b.commodity)}</h3><span class="spacer"></span>
      <a class="btn sm secondary" href="/api/chain/batches/${b.id}/label.pdf" target="_blank" rel="noopener">🖨 Print QR label</a>
      <a class="btn sm" href="/verify/${b.id}" data-link>Public verification</a></div>
      <div class="grid g3" style="margin-top:12px;grid-template-columns:auto 1fr 1fr">
        <img class="qr" src="/api/chain/batches/${b.id}/qr.png" width="150" height="150" alt="QR code for batch ${b.id}">
        <div>${kv({ "Packaging": esc(b.solution_name), "Structure": esc(b.structure), "Spec hash": `<span class="mono">${b.spec_hash.slice(0, 20)}…</span>`, "Remaining life": `${fmt(v.remaining_shelf_life.remaining_pct, 0)} % · ${days(v.remaining_shelf_life.remaining_days_at_storage)} at storage` })}</div>
        <form id="evForm" class="fields" style="grid-template-columns:1fr 1fr">
          <label class="f">Event<select name="event">${EVENTS.map(x => `<option>${x}</option>`).join("")}</select></label>
          <label class="f">Location<input name="location"></label>
          <label class="f">Temperature (°C)<input name="temperature_c" type="number" step="0.5"></label>
          <label class="f">Duration (h)<input name="duration_h" type="number" step="0.5" min="0"></label>
          <label class="f">RH (%)<input name="rh" type="number" min="0" max="100"></label>
          <label class="f">Notes<input name="notes"></label>
          <div><button class="btn sm">Sign &amp; record event</button></div></form>
      </div>
      <details style="margin-top:12px"><summary>Packaging supplier / lab: certify material for this batch</summary>
        <form id="certForm" class="fields" style="margin-top:10px">
          <label class="f">Material id<input name="material_id" value="${esc(b.solution_id)}"></label>
          <label class="f">Supplier lot<input name="supplier_lot" required></label>
          <label class="f">Measured OTR<input name="measured_otr" type="number" step="any"></label>
          <label class="f">Measured WVTR<input name="measured_wvtr" type="number" step="any"></label>
          <label class="f">Migration test (IS 9845)<select name="migration_test_pass"><option value="">n/a</option><option value="true">pass</option><option value="false">fail</option></select></label>
          <label class="f">Certificate ref<input name="certificate_ref"></label>
          <div><button class="btn sm">Sign certificate</button></div></form></details>
      <h4 style="margin-top:14px">Custody timeline</h4>${timeline(v.history)}`;
    $("#evForm").addEventListener("submit", async e => {
      e.preventDefault();
      const f = e.target, body = { event: f.event.value };
      for (const k of ["location", "notes"]) if (f[k].value) body[k] = f[k].value;
      for (const k of ["temperature_c", "duration_h", "rh"]) if (f[k].value !== "") body[k] = +f[k].value;
      try { const r = await api.post(`/api/chain/batches/${id}/events`, body, actorStore.headers()); toast(`Recorded in block #${r.block_index}`); loadBatches(id); }
      catch (err) { toast(err.message); }
    });
    $("#certForm").addEventListener("submit", async e => {
      e.preventDefault();
      const f = e.target, body = { material_id: f.material_id.value, supplier_lot: f.supplier_lot.value, batch_id: id, certificate_ref: f.certificate_ref.value || null };
      if (f.measured_otr.value) body.measured_otr = +f.measured_otr.value;
      if (f.measured_wvtr.value) body.measured_wvtr = +f.measured_wvtr.value;
      if (f.migration_test_pass.value) body.migration_test_pass = f.migration_test_pass.value === "true";
      try { const r = await api.post("/api/chain/material-certificates", body, actorStore.headers()); toast(`Certificate recorded · conformity ${JSON.stringify(r.conformity)}`); }
      catch (err) { toast(err.message); }
    });
  }
  loadBatches(params.get("batch"));
}

function timeline(history) {
  return `<ol class="timeline">${history.map(h => {
    const p = h.payload;
    const title = h.type === "BATCH_CREATED" ? `Packed in ${esc(p.solution_name)}` : h.type === "MATERIAL_CERTIFIED" ? `Material certified (${esc(p.supplier_lot)})` : esc((p.event || h.type).replace("_", " "));
    return `<li><b>${title}</b> ${h.signature_valid ? statusBadge("good", "signed") : statusBadge("crit", "bad signature")}<br>
      <small class="muted">${new Date(h.timestamp * 1000).toLocaleString()} · ${esc(h.actor.name || h.actor.id)} (${esc(ROLE_LABEL[h.actor.role] || h.actor.role || "")}) · block #${h.block_index}</small>
      ${p.location || p.temperature_c !== undefined && p.temperature_c !== null ? `<br><small>${esc(p.location || "")} ${p.temperature_c !== null && p.temperature_c !== undefined ? `· ${p.temperature_c} °C` : ""} ${p.duration_h ? `for ${p.duration_h} h` : ""} ${p.notes ? "· " + esc(p.notes) : ""}</small>` : ""}</li>`;
  }).join("")}</ol>`;
}

export async function ledgerPage(main) {
  main.innerHTML = `<div class="page-head"><div><h1>PackChain ledger</h1>
    <p>Permissioned blockchain: SHA-256 block hashes with proof-of-work, Merkle roots of Ed25519-signed transactions. Validation re-checks every hash, link, proof-of-work and signature.</p></div>
    <div class="row"><button class="btn" id="valBtn">Validate entire chain</button></div></div>
    <div id="val"></div>
    <div class="grid g2" style="margin-top:12px"><div class="card"><h3>Public anchoring</h3><div id="anch"></div></div>
      <div class="card"><h3>Look up a transaction</h3><form id="txForm" class="row"><input name="tx" placeholder="transaction id" value="${esc(new URLSearchParams(location.search).get("tx") || "")}"><button class="btn sm">Show</button></form><div id="txOut" style="margin-top:10px"></div></div></div>
    <div class="card" style="margin-top:16px"><h3>Latest blocks</h3><div id="blocks"></div></div>`;
  const [bl, st] = await Promise.all([api.get("/api/chain/blocks?limit=40"), api.get("/api/chain/anchor/status")]);
  $("#blocks").innerHTML = table([
    { label: "#", num: true, key: "index" },
    { label: "Hash", render: b => `<span class="mono">${b.hash.slice(0, 22)}…</span>` },
    { label: "Prev", render: b => `<span class="mono">${b.prev_hash.slice(0, 12)}…</span>` },
    { label: "Merkle root", render: b => `<span class="mono">${b.merkle_root.slice(0, 12)}…</span>` },
    { label: "Nonce", num: true, key: "nonce" },
    { label: "Tx", render: b => b.transactions.map(t => `<a href="#" data-tx="${t.tx_id}" class="badge">${esc(t.body.type)}</a>`).join(" ") },
    { label: "Time", render: b => new Date(b.timestamp * 1000).toLocaleString() }], bl.blocks, { maxh: 560 });
  $("#anch").innerHTML = st.configured ? `${kv({ "Network chain id": st.chain_id, "Contract": `<span class="mono">${esc(st.contract)}</span>` })}<button class="btn sm" id="anchorBtn" style="margin-top:10px">Anchor chain head</button>`
    : `<p class="muted">Offline mode. Set <span class="mono">PACKAI_EVM_RPC_URL / PRIVATE_KEY / CONTRACT</span> and install <span class="mono">web3</span> to anchor block hashes to Polygon via the <b>PackChainAnchor</b> Solidity contract (see <span class="mono">blockchain/</span>).</p>`;
  $("#anchorBtn")?.addEventListener("click", async () => { const r = await api.post("/api/chain/anchor"); toast(r.ok ? `Anchored: ${r.tx_hash}` : r.reason); });
  $("#valBtn").addEventListener("click", async () => {
    loading($("#val"), "Re-verifying hashes, PoW and signatures…");
    const v = await api.get("/api/chain/validate");
    $("#val").innerHTML = `<div class="verdict ${v.valid ? "ok" : "bad"}"><span class="big">${v.valid ? "✓" : "✕"}</span><div><b>${v.valid ? "Chain is valid" : "Chain integrity violated"}</b><br>
      <small>${v.blocks} blocks · ${v.transactions} transactions · head <span class="mono">${esc((v.head || "").slice(0, 24))}…</span></small>
      ${v.errors.map(er => `<div class="callout crit" style="margin-top:6px">Block ${er.block}: ${esc(er.error)}</div>`).join("")}</div></div>`;
  });
  const showTx = async id => {
    try {
      const r = await api.get(`/api/chain/tx/${id}`);
      $("#txOut").innerHTML = `${kv({ "Type": esc(r.tx.body.type), "Actor": esc(r.tx.body.actor_id), "Block": `#${r.proof.block_index}`,
        "Signature": r.proof.signature_valid ? statusBadge("good", "valid Ed25519") : statusBadge("crit", "invalid"),
        "Merkle proof": r.proof.merkle_valid ? statusBadge("good", `valid (${r.proof.proof.length} steps)`) : statusBadge("crit", "invalid") })}
        <pre class="formula" style="white-space:pre-wrap;max-height:240px">${esc(JSON.stringify(r.tx.body.payload, null, 2))}</pre>`;
    } catch (e) { errorBox($("#txOut"), e); }
  };
  $("#txForm").addEventListener("submit", e => { e.preventDefault(); showTx(e.target.tx.value.trim()); });
  $("#blocks").addEventListener("click", e => { const a = e.target.closest("[data-tx]"); if (a) { e.preventDefault(); $("#txForm").tx.value = a.dataset.tx; showTx(a.dataset.tx); } });
  if ($("#txForm").tx.value) showTx($("#txForm").tx.value);
}

export async function verifyPage(main, id) {
  if (!id) {
    main.innerHTML = `<div class="page-head"><div><h1>Verify a pack</h1><p>Enter the batch code printed under the QR (e.g. PB-1A2B3C4D). Scanning the QR opens this page directly.</p></div></div>
      <form class="card row" id="vf"><input name="id" placeholder="PB-XXXXXXXX" required style="max-width:280px"><button class="btn">Verify</button></form>
      <div class="card" style="margin-top:16px"><h3>Verify a recommendation report</h3><form class="row" id="vr"><input name="id" placeholder="Report ID e.g. R1A2B3C4D5" style="max-width:280px"><button class="btn secondary">Check report</button></form></div>`;
    $("#vf").addEventListener("submit", e => { e.preventDefault(); window.packaiNavigate(`/verify/${e.target.id.value.trim()}`); });
    $("#vr").addEventListener("submit", e => { e.preventDefault(); window.packaiNavigate(`/verify-report/${e.target.id.value.trim()}`); });
    return;
  }
  loading(main, "Verifying on PackChain…");
  let v;
  try { v = await api.get(`/api/chain/verify/${id}`); } catch (e) { return errorBox(main, e); }
  const b = v.batch, rem = v.remaining_shelf_life, ok = v.verdict === "AUTHENTIC";
  const pct = rem.remaining_pct ?? 0;
  const col = pct > 50 ? css("--good") : pct > 20 ? css("--warn") : css("--crit");
  main.innerHTML = `
  <div class="verdict ${ok ? "ok" : "bad"}"><span class="big">${ok ? "✓" : "✕"}</span>
    <div><h1 style="margin:0">${ok ? "Authentic pack" : "Verification failed"}</h1>
    <div>${esc(b.commodity)} · batch <span class="mono">${b.id}</span> · packed ${esc(b.pack_date)}</div></div></div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Freshness</h3>
      <div class="row"><b style="font-size:1.6rem">${fmt(pct, 0)} %</b><span class="muted">shelf life remaining · ${esc(rem.status || "")}</span></div>
      <div class="gauge" role="img" aria-label="${fmt(pct, 0)} percent remaining"><i style="width:${pct}%;background:${col}"></i></div>
      ${kv({ "Best before (printed)": `<b>${esc(b.best_before)}</b>`, "Remaining at storage temp": `${days(rem.remaining_days_at_storage)} at ${fmt(rem.storage_temp)} °C`,
        "Temperature excursions logged": v.temperature_excursions ? statusBadge("warn", `${v.temperature_excursions} excursion(s)`) : statusBadge("good", "none"),
        "Life consumed by logged segments": (rem.segments || []).map(s => `${fmt(s.days, 2)} d @ ${fmt(s.temp)} °C → ${fmt(s.consumed_pct)} %`).join("<br>") || "–" })}
      <p class="muted" style="font-size:.8rem;margin-top:8px">Dynamic shelf life: Σ Δt / L(T) using the same mechanistic model that designed the pack.</p></div>
    <div class="card"><h3>Packaging specification</h3>${kv({ "Package": esc(b.solution_name), "Structure": esc(b.spec.structure),
        "OTR / WVTR spec": `${fmt(b.spec.otr_spec, 3)} / ${fmt(b.spec.wvtr_spec, 3)}`, "MAP": esc((b.spec.map?.technique || "–").replace("_", " ")) + (b.spec.map?.gas ? " · " + Object.entries(b.spec.map.gas).map(([k, x]) => `${k} ${x}%`).join(", ") : ""),
        "Sealing": esc(b.spec.seal), "Quantity": `${fmt(b.quantity, 0)} ${esc(b.unit)}`, "Spec hash": `<span class="mono">${esc(b.spec_hash)}</span>` })}
      ${v.material_certificates.length ? `<h4 style="margin-top:10px">Material certificates</h4>${v.material_certificates.map(c => `<div>${c.conforms === false ? statusBadge("crit", "non-conforming") : statusBadge("good", "certified")} ${esc(c.material_name)} · lot ${esc(c.supplier_lot)} · by ${esc(c.supplier || "")}</div>`).join("")}` : ""}</div>
  </div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h3>Journey</h3>${timeline(v.history)}</div>
    <div class="card"><h3>Cryptographic checks</h3>${kv(Object.fromEntries(Object.entries(v.checks).map(([k, x]) => [k.replace(/_/g, " "), x ? statusBadge("good", "pass") : statusBadge("crit", "fail")])))}
      <p class="muted" style="margin-top:10px">Chain height ${v.chain_height}. Each record's Merkle inclusion proof and Ed25519 signature were verified against the block headers.</p>
      <a class="btn sm secondary" href="/ledger" data-link>Open ledger</a></div>
  </div>`;
}

export async function verifyReportPage(main, id) {
  loading(main, "Checking report integrity…");
  let v;
  try { v = await api.get(`/api/recommendations/${id}/verify`); } catch (e) { return errorBox(main, e); }
  const ok = v.verdict === "AUTHENTIC";
  main.innerHTML = `<div class="verdict ${ok ? "ok" : v.verdict === "UNCERTIFIED" ? "" : "bad"}" style="${v.verdict === "UNCERTIFIED" ? "border-color:var(--warn)" : ""}">
    <span class="big">${ok ? "✓" : v.verdict === "UNCERTIFIED" ? "!" : "✕"}</span>
    <div><h1 style="margin:0">Report ${esc(v.rec_id)}: ${esc(v.verdict)}</h1><div>${esc(v.commodity)} · generated ${esc(v.created_at)}</div></div></div>
    <div class="card" style="margin-top:16px">${kv({ "Stored hash": `<span class="mono">${esc(v.stored_hash)}</span>`, "Recomputed hash": `<span class="mono">${esc(v.recomputed_hash)}</span>`,
      "Content intact": v.content_intact ? statusBadge("good", "yes") : statusBadge("crit", "no"),
      "On-chain hash": v.on_chain_hash ? `<span class="mono">${esc(v.on_chain_hash)}</span>` : "not certified",
      "Block": v.block_index !== undefined ? `#${v.block_index} <span class="mono">${esc(v.block_hash.slice(0, 20))}…</span>` : "–",
      "Signature / Merkle": v.certified ? `${v.signature_valid ? "✓" : "✕"} / ${v.merkle_valid ? "✓" : "✕"}` : "–" })}
      <div class="row" style="margin-top:12px"><a class="btn" href="/result/${esc(v.rec_id)}" data-link>Open report</a></div></div>`;
}
