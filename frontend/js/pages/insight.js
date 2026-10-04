import { api } from "../api.js";
import { L, famLabel, cname } from "../i18n.js";
import { $, esc, fmt, days, toast, table, kv, chart, series, statusBadge, pageHead } from "../ui.js";

const resCrumb = () => [[L("Resources", "संसाधन"), null]];

export async function aiPage(main) {
  const info = await api.get("/api/ml/info");
  const m = info.meta;
  main.innerHTML = pageHead({
    title: L("AI model", "AI मॉडल"), crumbs: resCrumb(),
    desc: L("The science engine checks that a pack will actually protect the food. The AI model adds what the Indian packaging industry commonly uses for products with similar properties, so the advice stays practical. It keeps learning from feedback submitted by users.",
      "विज्ञान इंजन जाँचता है कि पैक वास्तव में खाद्य की रक्षा करेगा। AI मॉडल यह जोड़ता है कि समान गुणों वाले उत्पादों के लिए भारतीय पैकेजिंग उद्योग आमतौर पर क्या उपयोग करता है, ताकि सलाह व्यावहारिक रहे। यह उपयोगकर्ताओं की प्रतिक्रिया से लगातार सीखता है।"),
    actions: `<button class="btn" id="rt">${info.training.running ? L("Training…", "प्रशिक्षण जारी…") : L("Retrain model", "मॉडल दोबारा प्रशिक्षित करें")}</button><a class="btn secondary" href="/api/ml/template.csv" download>${L("Download CSV template", "CSV टेम्पलेट डाउनलोड करें")}</a>`,
  }) + `<div class="wrap page-body">
  ${!m ? `<div class="callout warn">${L("The model is being trained. Please check again in a few minutes.", "मॉडल प्रशिक्षित हो रहा है। कृपया कुछ मिनट बाद देखें।")}</div>` : `
  <div class="counters" style="margin-top:0">
    <div><div class="v">${fmt(m.holdout.accuracy * 100, 1)} %</div><div class="l">${L("Accuracy on test data", "परीक्षण डेटा पर सटीकता")}</div></div>
    <div><div class="v">${fmt(m.leave_commodity_out.top3_accuracy * 100, 1)} %</div><div class="l">${L("Correct in top 3 for new products", "नए उत्पादों के लिए शीर्ष 3 में सही")}</div></div>
    <div><div class="v">${fmt(m.regressors.y_otr?.r2, 2)}</div><div class="l">${L("OTR estimate (R²)", "OTR अनुमान (R²)")}</div></div>
    <div><div class="v">${fmt(m.n_samples, 0)}</div><div class="l">${L("Training examples", "प्रशिक्षण उदाहरण")}</div></div>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h2 class="card-title">${L("Which inputs matter most", "कौन-से इनपुट सबसे महत्वपूर्ण")}</h2><div class="chart-box tall"><canvas id="fi"></canvas></div></div>
    <div class="card"><h2 class="card-title">${L("Packaging types in training data", "प्रशिक्षण डेटा में पैकेजिंग प्रकार")}</h2><div class="chart-box tall"><canvas id="cd"></canvas></div></div>
  </div>
  <div class="card" style="margin-top:14px"><h2 class="card-title">${L("Model details", "मॉडल विवरण")}</h2>${kv({
    [L("Method", "विधि")]: `Random Forest (${m.classifier.n_estimators} ${L("trees", "ट्री")})`,
    [L("Version / trained on", "संस्करण / प्रशिक्षण तिथि")]: `${esc(m.version)} · ${esc(m.trained_at)}`,
    [L("What it learns from", "यह किससे सीखता है")]: L("Packaging commonly used in India for each commodity (IIP, APEDA, FSSAI guidance and market surveys), checked for technical suitability, plus user feedback.", "हर उत्पाद के लिए भारत में प्रचलित पैकेजिंग (IIP, APEDA, FSSAI मार्गदर्शन और बाज़ार सर्वेक्षण), तकनीकी उपयुक्तता की जाँच सहित, और उपयोगकर्ता प्रतिक्रिया।"),
    [L("How it was tested", "कैसे परखा गया")]: L("80/20 split of the data, and a separate test on commodities the model never saw during training.", "डेटा का 80/20 विभाजन, और उन उत्पादों पर अलग परीक्षण जो प्रशिक्षण में शामिल नहीं थे।"),
    [L("Limitation", "सीमा")]: L("Training labels come from expert knowledge, not lab measurements. Feedback from real use gradually replaces them.", "प्रशिक्षण लेबल विशेषज्ञ ज्ञान से हैं, प्रयोगशाला माप से नहीं। वास्तविक उपयोग की प्रतिक्रिया धीरे-धीरे इन्हें बदलती है।"),
  })}</div>`}
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h2 class="card-title">${L("Upload lab or company data", "प्रयोगशाला या कंपनी डेटा अपलोड करें")}</h2>
      <p class="muted">${L("Use the CSV template. The 'label' column must contain a packaging type id from the list below.", "CSV टेम्पलेट का उपयोग करें। 'label' कॉलम में नीचे दी गई सूची से पैकेजिंग प्रकार id हो।")}</p>
      <form id="up" class="row"><input type="file" name="file" accept=".csv" required style="flex:1"><button class="btn sm">${L("Upload", "अपलोड")}</button></form>
      <p class="muted" style="margin-top:8px">${L("Rows uploaded", "अपलोड की गई पंक्तियाँ")}: ${info.user_training_rows} · ${L("feedback received", "प्राप्त प्रतिक्रियाएँ")}: ${info.feedback_count}</p>
      <details><summary>${L("Packaging type ids", "पैकेजिंग प्रकार id")}</summary><ul class="clean">${Object.keys(info.families).map(k => `<li><span class="mono">${k}</span> — ${esc(famLabel(k, info.families[k]))}</li>`).join("")}</ul></details></div>
    <div class="card"><h2 class="card-title">${L("Recent feedback from users", "उपयोगकर्ताओं की हाल की प्रतिक्रिया")}</h2><div id="fb"></div></div>
  </div></div>`;
  if (m) {
    const S = series();
    const fi = m.feature_importance.slice(0, 12);
    chart($("#fi"), { type: "bar", data: { labels: fi.map(f => f.feature), datasets: [{ data: fi.map(f => f.importance), backgroundColor: S[0], maxBarThickness: 16 }] },
      options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { title: { text: L("Importance", "महत्व") } }, y: { grid: { display: false }, ticks: { autoSkip: false } } } } });
    const cd = Object.entries(m.class_distribution).sort((a, b) => b[1] - a[1]);
    chart($("#cd"), { type: "bar", data: { labels: cd.map(c => famLabel(c[0], info.families[c[0]])), datasets: [{ data: cd.map(c => c[1]), backgroundColor: S[0], maxBarThickness: 16 }] },
      options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { title: { text: L("Examples", "उदाहरण") } }, y: { grid: { display: false }, ticks: { autoSkip: false } } } } });
  }
  const fb = await api.get("/api/ml/feedback");
  $("#fb").innerHTML = table([{ label: L("Report", "रिपोर्ट"), render: f => `<a href="/result/${f.rec_id}" data-link>${f.rec_id}</a>` }, { label: L("Pack used", "उपयोग किया पैक"), key: "solution_id" },
    { label: L("Rating", "रेटिंग"), num: true, render: f => "★".repeat(f.rating) }, { label: L("Actual life", "वास्तविक अवधि"), num: true, render: f => days(f.observed_days) }], fb, { maxh: 300 });
  $("#rt").addEventListener("click", async () => {
    const r = await api.post("/api/ml/retrain"); toast(r.started ? L("Retraining started. This takes about 10 seconds.", "प्रशिक्षण शुरू हुआ। लगभग 10 सेकंड लगेंगे।") : r.message);
    if (r.started) setTimeout(() => aiPage(main), 12000);
  });
  $("#up").addEventListener("submit", async e => {
    e.preventDefault();
    try { const r = await api.post("/api/ml/upload", new FormData(e.target)); toast(L(`${r.rows_added} rows added. Retrain to use them.`, `${r.rows_added} पंक्तियाँ जोड़ी गईं। उपयोग हेतु दोबारा प्रशिक्षित करें।`)); } catch (err) { toast(err.message); }
  });
}

export async function historyPage(main) {
  const [list, cs] = await Promise.all([api.get("/api/recommendations?limit=200"), api.get("/api/commodities")]);
  const byName = Object.fromEntries(cs.map(c => [c.name, c]));
  main.innerHTML = pageHead({ title: L("Report history", "रिपोर्ट इतिहास"), crumbs: resCrumb(),
    desc: L("All packaging reports created on this portal. Click a report number to open it, or download the PDF.", "इस पोर्टल पर बनी सभी पैकेजिंग रिपोर्टें। खोलने के लिए रिपोर्ट संख्या पर क्लिक करें या PDF डाउनलोड करें।") }) + `<div class="wrap page-body">
    ${table([
      { label: L("Report no.", "रिपोर्ट सं."), render: r => `<a class="mono" href="/result/${r.id}" data-link>${r.id}</a>` },
      { label: L("Date", "दिनांक"), render: r => new Date(r.created_at + "Z").toLocaleDateString(L("en-IN", "hi-IN")) },
      { label: L("Product", "उत्पाद"), render: r => esc(cname(byName[r.commodity] || { name: r.commodity })) },
      { label: L("Recommended pack", "अनुशंसित पैक"), render: r => esc(r.top_solution_name || r.top_solution || "–") },
      { label: L("Shelf life", "शेल्फ-लाइफ"), num: true, render: r => days(r.predicted_days) },
      { label: L("Certified", "प्रमाणित"), render: r => r.certified ? statusBadge("good", L("yes", "हाँ")) : "" },
      { label: "PDF", render: r => `<a href="/api/recommendations/${r.id}/report.pdf" target="_blank" rel="noopener">${L("Download", "डाउनलोड")}</a>` }], list)}</div>`;
}

export async function aboutPage(main) {
  main.innerHTML = pageHead({ title: L("Methodology", "कार्यप्रणाली"), crumbs: resCrumb(),
    desc: L("How the portal turns information about a food product into a packaging specification. Every number in a report comes from one of the methods below.", "पोर्टल किसी खाद्य उत्पाद की जानकारी को पैकेजिंग विनिर्देश में कैसे बदलता है। रिपोर्ट की हर संख्या नीचे दी गई किसी विधि से आती है।") }) + `<div class="wrap page-body stack">
  <div class="card"><h2 class="card-title">${L("1. Overall approach", "1. समग्र दृष्टिकोण")}</h2><p>${L("Knowledge base of 96 commodities and 38 packaging structures → packaging requirements of the food → removal of unsuitable options → thickness, holes and gas selection for each option → shelf-life calculation → AI check against industry practice → ranking on protection, cost and environment → report and blockchain record.",
    "96 उत्पादों और 38 पैकेजिंग संरचनाओं का ज्ञान-आधार → खाद्य की पैकेजिंग आवश्यकताएँ → अनुपयुक्त विकल्प हटाना → हर विकल्प के लिए मोटाई, छिद्र और गैस का चयन → शेल्फ-लाइफ गणना → उद्योग प्रचलन से AI जाँच → सुरक्षा, लागत और पर्यावरण पर क्रम → रिपोर्ट और ब्लॉकचेन रिकॉर्ड।")}</p></div>
  <div class="card"><h2 class="card-title">${L("2. How films let in oxygen and moisture", "2. फ़िल्म से ऑक्सीजन और नमी कैसे जाती है")}</h2>
    <p>${L("A thicker film lets in less gas. Multilayer films add up the resistance of each layer. Warmer temperature increases transmission, and some barrier layers (EVOH, nylon) weaken in humid conditions.", "मोटी फ़िल्म कम गैस अंदर जाने देती है। बहु-परत फ़िल्म में हर परत का अवरोध जुड़ता है। गर्मी में पारगम्यता बढ़ती है, और कुछ बैरियर परतें (EVOH, नायलॉन) नमी में कमज़ोर हो जाती हैं।")}</p>
    <div class="formula">OTR(L,T) = OTR_ref × (L_ref / L) × exp[−Ea/R × (1/T − 1/296 K)]
1/OTR_laminate = Σ 1/OTR_i</div></div>
  <div class="card"><h2 class="card-title">${L("3. Rancidity and oxygen", "3. बासीपन और ऑक्सीजन")}</h2>
    <p>${L("Each oil-rich food can absorb only a limited amount of oxygen before it tastes stale. The portal subtracts the oxygen already in the pack (reduced by nitrogen flushing) and works out how long the film takes to let in the rest.", "हर तेलयुक्त खाद्य बासी स्वाद आने से पहले सीमित मात्रा में ही ऑक्सीजन सोख सकता है। पोर्टल पैक में पहले से मौजूद ऑक्सीजन (नाइट्रोजन फ्लशिंग से कम की गई) घटाकर गणना करता है कि फ़िल्म को बाकी ऑक्सीजन अंदर आने देने में कितना समय लगेगा।")}</p>
    <div class="formula">t = (tolerance × W − headspace O₂) / (OTR × A × 0.209 × 1.429)</div></div>
  <div class="card"><h2 class="card-title">${L("4. Moisture: crispness and caking", "4. नमी: कुरकुरापन और गांठें")}</h2>
    <p>${L("Dry foods such as biscuits, chips and spices fail when they absorb enough moisture to reach a critical water activity. The Labuza model gives the number of days this takes in a given film.", "बिस्कुट, चिप्स और मसाले जैसे सूखे खाद्य तब ख़राब होते हैं जब वे इतनी नमी सोख लेते हैं कि क्रांतिक जल सक्रियता तक पहुँच जाएँ। लबूज़ा मॉडल बताता है कि किसी फ़िल्म में इसमें कितने दिन लगेंगे।")}</p>
    <div class="formula">t = (W_dry × b) / (K × A × p₀) × ln[(m_e − m_i) / (m_e − m_c)]</div></div>
  <div class="card"><h2 class="card-title">${L("5. Fruits and vegetables: breathing and MAP", "5. फल और सब्ज़ियाँ: श्वसन और MAP")}</h2>
    <p>${L("Fresh produce takes in oxygen and gives out carbon dioxide. The portal balances the oxygen entering through the film and the laser holes against what the produce consumes, and chooses the number and size of holes that keep the gas inside within the recommended range for that crop.", "ताज़ी उपज ऑक्सीजन लेती है और कार्बन डाइऑक्साइड छोड़ती है। पोर्टल फ़िल्म और लेज़र छिद्रों से आने वाली ऑक्सीजन को उपज की खपत से संतुलित करता है, और छिद्रों की संख्या व आकार ऐसे चुनता है कि अंदर की गैस उस फ़सल की अनुशंसित सीमा में रहे।")}</p>
    <div class="formula">RR = Vm × O₂ / (Km + O₂ × (1 + CO₂/Ki))
(P_O₂ × A / L + n × F_h) × (0.209 − y_O₂) = RR × W
F_h = D × π r² / (L + r)        (Fishman, 1996)</div></div>
  <div class="card"><h2 class="card-title">${L("6. Microbes, insects and temperature", "6. सूक्ष्मजीव, कीट और तापमान")}</h2>
    <p>${L("Spoilage bacteria grow faster when it is warmer (Ratkowsky model). Grain in hermetic bags is protected because insects use up the oxygen. Time spent in transport at a different temperature is counted separately.", "गर्मी में ख़राब करने वाले जीवाणु तेज़ी से बढ़ते हैं (रैटकोव्स्की मॉडल)। हर्मेटिक बोरी में अनाज सुरक्षित रहता है क्योंकि कीट ऑक्सीजन ख़त्म कर देते हैं। अलग तापमान पर परिवहन में बिताया समय अलग से गिना जाता है।")}</p>
    <div class="formula">L(T) = L_ref × [(T_ref − T_min) / (T − T_min)]²
L_total = t_transit + (1 − t_transit / L(T_transit)) × L(T_storage)</div></div>
  <div class="card"><h2 class="card-title">${L("7. Ranking the options", "7. विकल्पों का क्रम")}</h2><p>${L("Each option is scored on technical fit, industry practice (AI), environment and cost per kg of product. The TOPSIS method combines these scores, with weights set by the user's priority: balanced, best protection, lowest cost or eco-friendly.", "हर विकल्प को तकनीकी उपयुक्तता, उद्योग प्रचलन (AI), पर्यावरण और प्रति किलो उत्पाद लागत पर अंक मिलते हैं। TOPSIS विधि इन्हें उपयोगकर्ता की प्राथमिकता के अनुसार जोड़ती है: संतुलित, सर्वोत्तम सुरक्षा, न्यूनतम लागत या पर्यावरण-अनुकूल।")}</p></div>
  <div class="card"><h2 class="card-title">${L("8. Traceability (PackChain)", "8. ट्रेसबिलिटी (PackChain)")}</h2><p>${L("Records are signed with Ed25519 keys and grouped into blocks linked by SHA-256 fingerprints. Each batch stores the fingerprint of its packing specification, so a changed record is detected. Block fingerprints can be published on the Polygon blockchain.", "रिकॉर्ड Ed25519 कुंजियों से हस्ताक्षरित होते हैं और SHA-256 फ़िंगरप्रिंट से जुड़े ब्लॉकों में रखे जाते हैं। हर बैच में उसके पैकिंग विनिर्देश का फ़िंगरप्रिंट होता है, इसलिए बदला गया रिकॉर्ड पकड़ में आ जाता है। ब्लॉक फ़िंगरप्रिंट Polygon ब्लॉकचेन पर प्रकाशित किए जा सकते हैं।")}</p></div>
  <div class="card"><h2 class="card-title">${L("References", "संदर्भ")}</h2><ul class="clean">
    <li>Robertson G.L. (2013) <i>Food Packaging: Principles and Practice</i>, 3rd ed., CRC Press.</li>
    <li>Kader A.A. (2002) <i>Postharvest Technology of Horticultural Crops</i>, University of California.</li>
    <li>Fishman S., Rodov V., Ben-Yehoshua S. (1996) <i>Journal of Food Science</i> 61:956.</li>
    <li>Fonseca S.C., Oliveira F.A.R., Brecht J.K. (2002) <i>Journal of Food Engineering</i> 52:99.</li>
    <li>Mangaraj S., Goswami T.K., Mahajan P.V. (2009) <i>Food Engineering Reviews</i> 1:133.</li>
    <li>Labuza T.P., Mizrahi S., Karel M. (1972) <i>Transactions of the ASAE</i> 15:150.</li>
    <li>Ratkowsky D.A. et al. (1982) <i>Journal of Bacteriology</i> 149:1.</li>
    <li>FSSAI (Packaging) Regulations 2018; Plastic Waste Management (Amendment) Rules 2022; Legal Metrology (Packaged Commodities) Rules 2011.</li>
  </ul></div></div>`;
}
