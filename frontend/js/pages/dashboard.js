import { api } from "../api.js";
import { L, cname, catLabel } from "../i18n.js";
import { $, $$, esc, days, table, toast, statusBadge } from "../ui.js";

let timer = null;

export default async function dashboard(main) {
  clearInterval(timer);
  const slides = [
    ["banner-mandi", L("Fresh produce deserves the right pack", "ताज़ी उपज के लिए सही पैकिंग"),
      L("Find out which bag, crate or film keeps your fruits and vegetables fresh until they reach the buyer.", "जानिए कौन-सी थैली, क्रेट या फ़िल्म आपके फल-सब्ज़ियों को खरीदार तक ताज़ा रखेगी।"), "/recommend", L("Get packaging advice", "पैकेजिंग सलाह लें")],
    ["banner-mango", L("Breathable bags for fruits", "फलों के लिए हवादार थैलियाँ"),
      L("Mango, banana and other fruits keep breathing after harvest. Design a bag with the right number of small holes.", "आम, केला और अन्य फल कटाई के बाद भी साँस लेते हैं। सही संख्या में छोटे छेद वाली थैली बनाइए।"), "/tools/map", L("Open MAP designer", "MAP डिज़ाइनर खोलें")],
    ["banner-paddy", L("Store grain for a full year", "अनाज को पूरे साल सुरक्षित रखें"),
      L("Hermetic bags stop insects without fumigation. Check how long your grain will stay safe in each type of bag.", "हर्मेटिक बोरी बिना धुआँ दिए कीड़ों को रोकती है। देखिए किस बोरी में आपका अनाज कितने दिन सुरक्षित रहेगा।"), "/tools/shelf-life", L("Check shelf life", "शेल्फ-लाइफ जाँचें")],
    ["banner-coldstore", L("Track every batch from farm to shop", "खेत से दुकान तक हर बैच पर नज़र"),
      L("Print a QR label for each lot. Buyers can scan it to see origin, packing details and remaining freshness.", "हर लॉट के लिए QR लेबल छापें। खरीदार स्कैन करके मूल स्थान, पैकिंग विवरण और बची ताज़गी देख सकते हैं।"), "/trace", L("Create QR label", "QR लेबल बनाएँ")],
  ];
  const news = [
    ["05-10-2026", L("Portal now available fully in Hindi, with larger text and high-contrast options", "पोर्टल अब पूरी तरह हिन्दी में, बड़े अक्षर और उच्च कंट्रास्ट विकल्प के साथ"), "/help#accessibility", true],
    ["26-09-2026", L("QR traceability: buyers can now see the remaining shelf life of a pack", "QR ट्रेसबिलिटी: खरीदार अब पैक की बची शेल्फ-लाइफ देख सकते हैं"), "/verify", true],
    ["25-09-2026", L("Packaging advice available for 96 commodities", "96 उत्पादों के लिए पैकेजिंग सलाह उपलब्ध"), "/commodities", false],
    ["25-09-2026", L("FSSAI and Plastic Waste Management (EPR) checklist added to every report", "हर रिपोर्ट में FSSAI और प्लास्टिक अपशिष्ट प्रबंधन (EPR) जाँच-सूची"), "/recommend", false],
    ["25-09-2026", L("New tool: MAP pack designer for fruits and vegetables", "नया उपकरण: फल-सब्ज़ियों के लिए MAP पैक डिज़ाइनर"), "/tools/map", false],
  ];
  const cats = [
    ["cat-fruits", "fruit", L("Fruits", "फल"), L("Mango, banana, grapes…", "आम, केला, अंगूर…")],
    ["cat-vegetables", "vegetable", L("Vegetables", "सब्ज़ियाँ"), L("Tomato, okra, broccoli…", "टमाटर, भिंडी, ब्रोकली…")],
    ["cat-onion", "root_bulb", L("Onion, potato & roots", "प्याज़, आलू और कंद"), L("Onion, potato, garlic…", "प्याज़, आलू, लहसुन…")],
    ["cat-dairy", "dairy_liquid", L("Milk & dairy", "दूध और दुग्ध उत्पाद"), L("Milk, paneer, ghee…", "दूध, पनीर, घी…")],
    ["cat-grains", "grain", L("Grains & pulses", "अनाज और दालें"), L("Rice, wheat, dal…", "चावल, गेहूँ, दाल…")],
    ["cat-spices", "spice", L("Spices, tea & coffee", "मसाले, चाय और कॉफ़ी"), L("Turmeric, chilli, tea…", "हल्दी, मिर्च, चाय…")],
    ["cat-snacks", "snack", L("Snacks & namkeen", "स्नैक्स और नमकीन"), L("Chips, bhujia, makhana…", "चिप्स, भुजिया, मखाना…")],
    ["cat-seafood", "seafood", L("Fish & seafood", "मछली और समुद्री भोजन"), L("Fresh fish, shrimp…", "ताज़ी मछली, झींगा…")],
  ];

  main.innerHTML = `
  <section class="slider" aria-roledescription="carousel" aria-label="${L("Highlights", "मुख्य जानकारी")}">
    <div class="slides">${slides.map(([img, h, p, href, cta], i) => `
      <div class="slide${i === 0 ? " on" : ""}" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${slides.length}" ${i ? 'aria-hidden="true"' : ""}>
        <img src="/img/${img}.jpg" alt="" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}>
        <div class="cap"><div class="wrap"><h2>${esc(h)}</h2><p>${esc(p)}</p><a class="btn saffron" href="${href}" data-link ${i ? 'tabindex="-1"' : ""}>${esc(cta)} »</a></div></div>
      </div>`).join("")}</div>
    <div class="slide-ctl">
      <button type="button" id="sPrev" aria-label="${L("Previous slide", "पिछली स्लाइड")}">‹</button>
      ${slides.map((_, i) => `<button type="button" data-s="${i}" aria-label="${L("Slide", "स्लाइड")} ${i + 1}" aria-current="${i === 0}">${i + 1}</button>`).join("")}
      <button type="button" id="sNext" aria-label="${L("Next slide", "अगली स्लाइड")}">›</button>
      <button type="button" id="sPause" aria-label="${L("Pause slideshow", "स्लाइडशो रोकें")}">❚❚</button>
    </div>
  </section>

  <div class="ticker" id="ticker"><div class="wrap">
    <span class="ticker-label">${L("Latest Updates", "नवीनतम सूचनाएँ")}</span>
    <div class="ticker-track"><div>${news.map(([d, t, h]) => `<a href="${h}" data-link>${esc(t)} (${d})</a>`).join("")}</div></div>
    <button class="ticker-btn" id="tickBtn" type="button" aria-pressed="false">${L("Pause", "रोकें")}</button>
  </div></div>

  <div class="wrap">
    <div class="home-cols">
      <aside class="stack">
        <div class="card"><div class="box-head">${L("Our Services", "हमारी सेवाएँ")}</div>
          <ul class="arrows">
            <li><a href="/recommend" data-link>${L("Packaging advice for your product", "अपने उत्पाद के लिए पैकेजिंग सलाह")}</a></li>
            <li><a href="/tools/map" data-link>${L("MAP pack designer (fruits & vegetables)", "MAP पैक डिज़ाइनर (फल और सब्ज़ियाँ)")}</a></li>
            <li><a href="/tools/shelf-life" data-link>${L("Shelf-life calculator", "शेल्फ-लाइफ कैलकुलेटर")}</a></li>
            <li><a href="/materials" data-link>${L("Compare packaging materials", "पैकेजिंग सामग्री की तुलना")}</a></li>
            <li><a href="/trace" data-link>${L("Create batch QR labels", "बैच QR लेबल बनाएँ")}</a></li>
            <li><a href="/verify" data-link>${L("Verify a pack", "पैक सत्यापित करें")}</a></li>
            <li><a href="/history" data-link>${L("Download past reports", "पुरानी रिपोर्ट डाउनलोड करें")}</a></li>
          </ul></div>
        <div class="card"><div class="box-head">${L("Useful Links", "उपयोगी लिंक")}</div>
          <ul class="arrows">
            <li><a href="https://www.fssai.gov.in" target="_blank" rel="noopener">${L("FSSAI — food safety regulator", "FSSAI — खाद्य सुरक्षा नियामक")}</a></li>
            <li><a href="https://eprplastic.cpcb.gov.in" target="_blank" rel="noopener">${L("CPCB plastic EPR portal", "CPCB प्लास्टिक EPR पोर्टल")}</a></li>
            <li><a href="https://www.mofpi.gov.in" target="_blank" rel="noopener">${L("Ministry of Food Processing Industries", "खाद्य प्रसंस्करण उद्योग मंत्रालय")}</a></li>
            <li><a href="https://apeda.gov.in" target="_blank" rel="noopener">${L("APEDA — export guidelines", "APEDA — निर्यात दिशानिर्देश")}</a></li>
            <li><a href="https://www.enam.gov.in" target="_blank" rel="noopener">${L("e-NAM — online mandi", "e-NAM — ऑनलाइन मंडी")}</a></li>
          </ul></div>
      </aside>

      <section class="col-main stack">
        <div class="card welcome">
          <h2>${L("Welcome to the Smart Food Packaging Advisory Portal", "स्मार्ट खाद्य पैकेजिंग सलाहकार पोर्टल में आपका स्वागत है")}</h2>
          <p>${L("Choosing the wrong packaging is one of the main reasons food spoils before it is sold. Chips go stale when the pouch lets in air, spices form lumps in the monsoon, and vegetables rot in a fully sealed bag.",
            "ग़लत पैकेजिंग बिक्री से पहले खाद्य ख़राब होने का एक बड़ा कारण है। पाउच में हवा जाने से चिप्स बासी हो जाते हैं, बरसात में मसालों में गांठें पड़ जाती हैं, और पूरी तरह बंद थैली में सब्ज़ियाँ सड़ जाती हैं।")}</p>
          <p>${L("This portal tells farmers, FPOs, food processors and start-ups which packaging to use for their product, how thick it should be, how long the product will last, what it will cost and whether it can be recycled. The service is free.",
            "यह पोर्टल किसानों, FPO, खाद्य प्रसंस्करणकर्ताओं और स्टार्ट-अप को बताता है कि उनके उत्पाद के लिए कौन-सी पैकेजिंग लें, कितनी मोटी हो, उत्पाद कितने दिन चलेगा, कितना खर्च होगा और क्या उसे दोबारा उपयोग (रीसायकल) किया जा सकता है। यह सेवा निःशुल्क है।")}</p>
        </div>
        <form class="card" id="quickForm">
          <div class="box-head">${L("Quick Packaging Advice", "त्वरित पैकेजिंग सलाह")}</div>
          <p class="muted" style="font-size:.88rem">${L("Select your product and pack size. Typical values are filled in automatically.", "अपना उत्पाद और पैक का वज़न चुनें। बाकी सामान्य मान अपने-आप भर जाते हैं।")}</p>
          <div class="fields" style="grid-template-columns:2fr 1fr 1fr">
            <label class="f"><span>${L("Product", "उत्पाद")} <span class="req">*</span></span><select name="c" id="qc" required><option value="">${L("Loading…", "लोड हो रहा है…")}</option></select></label>
            <label class="f">${L("Pack size (kg)", "पैक वज़न (kg)")}<input name="w" type="number" min="0.01" step="0.01" value="1" required></label>
            <label class="f">${L("Days needed", "आवश्यक दिन")}<input name="d" type="number" min="1" step="1" placeholder="${L("auto", "स्वतः")}"></label>
          </div>
          <div class="row" style="margin-top:12px"><button class="btn saffron" id="qBtn">${L("Get advice", "सलाह पाएँ")} »</button>
            <a href="/recommend" data-link style="font-size:.88rem">${L("Detailed form (storage, transport, budget)", "विस्तृत फ़ॉर्म (भंडारण, परिवहन, बजट)")}</a></div>
        </form>
      </section>

      <aside class="stack">
        <div class="card"><div class="box-head">${L("What's New", "नया क्या है")}</div>
          <ul class="news-list">${news.map(([d, t, h, isNew]) => `<li><time>${d}</time><a href="${h}" data-link>${esc(t)}</a>${isNew ? `<span class="new-tag">${L("NEW", "नया")}</span>` : ""}</li>`).join("")}</ul></div>
        <form class="card" id="verifyQuick"><div class="box-head">${L("Verify Your Pack", "अपना पैक सत्यापित करें")}</div>
          <label class="f">${L("Batch code printed under the QR", "QR के नीचे छपा बैच कोड")}<input name="b" placeholder="PB-XXXXXXXX" required></label>
          <div class="row" style="margin-top:10px"><button class="btn sm">${L("Verify", "सत्यापित करें")}</button></div></form>
      </aside>
    </div>

    <div class="section-title"><h2>${L("Packaging advice by commodity", "उत्पाद अनुसार पैकेजिंग सलाह")}</h2><a href="/commodities" data-link>${L("View all 96 commodities »", "सभी 96 उत्पाद देखें »")}</a></div>
    <div class="cat-grid">${cats.map(([img, id, t, s]) => `<a class="cat" href="/commodities?cat=${id}" data-link><img src="/img/${img}.jpg" alt="" loading="lazy" width="640" height="480"><span>${esc(t)}<small>${esc(s)}</small></span></a>`).join("")}</div>

    <div class="section-title"><h2>${L("How to use the portal", "पोर्टल का उपयोग कैसे करें")}</h2><a href="/help#guide" data-link>${L("Detailed guide »", "विस्तृत मार्गदर्शिका »")}</a></div>
    <div class="howto">
      <div><h3>${L("Select your product", "अपना उत्पाद चुनें")}</h3><p>${L("Choose from the list or type its name in Hindi or English.", "सूची से चुनें या हिन्दी/अंग्रेज़ी में नाम लिखें।")}</p></div>
      <div><h3>${L("Tell us how it will travel", "बताइए यह कैसे भेजा जाएगा")}</h3><p>${L("Storage temperature, transport, pack size and how many days it must last.", "भंडारण तापमान, परिवहन, पैक वज़न और कितने दिन चलना चाहिए।")}</p></div>
      <div><h3>${L("Get the recommendation", "सिफ़ारिश प्राप्त करें")}</h3><p>${L("Best packaging with thickness, cost, shelf life and FSSAI checklist.", "मोटाई, लागत, शेल्फ-लाइफ और FSSAI जाँच-सूची सहित सर्वोत्तम पैकेजिंग।")}</p></div>
      <div><h3>${L("Download and print QR", "डाउनलोड करें और QR छापें")}</h3><p>${L("Save the PDF report and print QR labels for your batches.", "PDF रिपोर्ट सहेजें और अपने बैच के QR लेबल छापें।")}</p></div>
    </div>

    <div class="counters" id="stats">
      <div><div class="v">96</div><div class="l">${L("Commodities covered", "शामिल उत्पाद")}</div></div>
      <div><div class="v">38</div><div class="l">${L("Packaging types assessed", "जाँचे गए पैकेजिंग प्रकार")}</div></div>
      <div><div class="v">–</div><div class="l">${L("Reports generated", "बनी रिपोर्टें")}</div></div>
      <div><div class="v">–</div><div class="l">${L("Batches traced with QR", "QR से ट्रेस किए बैच")}</div></div>
    </div>

    <div class="grid g2" style="margin-top:22px">
      <div class="card"><h2 class="card-title">${L("Recent reports", "हाल की रिपोर्टें")}</h2><div id="recent"><div class="loading"><span class="spinner"></span></div></div></div>
      <div class="card faq"><h2 class="card-title">${L("Frequently asked questions", "अक्सर पूछे जाने वाले प्रश्न")}</h2>
        <details><summary>${L("Is this service free?", "क्या यह सेवा निःशुल्क है?")}</summary><p>${L("Yes. Advice, PDF reports, QR labels and verification are all free.", "हाँ। सलाह, PDF रिपोर्ट, QR लेबल और सत्यापन सब निःशुल्क हैं।")}</p></details>
        <details><summary>${L("I don't know the moisture or pH of my product.", "मुझे अपने उत्पाद की नमी या pH नहीं पता।")}</summary><p>${L("That is fine. Just select the product; typical values are filled in for you.", "कोई बात नहीं। बस उत्पाद चुनें; सामान्य मान अपने-आप भर जाते हैं।")}</p></details>
        <details><summary>${L("Can I use it on my phone?", "क्या मैं इसे फ़ोन पर चला सकता हूँ?")}</summary><p>${L("Yes. Open the site in Chrome and choose 'Add to Home screen' to use it like an app.", "हाँ। Chrome में साइट खोलें और 'होम स्क्रीन पर जोड़ें' चुनें, फिर इसे ऐप की तरह उपयोग करें।")}</p></details>
        <p style="margin-top:10px"><a href="/help" data-link>${L("More questions »", "और प्रश्न »")}</a></p></div>
    </div>
  </div>`;

  // slider
  const sl = $$(".slide", main), dots = $$("[data-s]", main);
  let cur = 0, paused = false;
  const go = n => {
    cur = (n + sl.length) % sl.length;
    sl.forEach((s, i) => { s.classList.toggle("on", i === cur); s.setAttribute("aria-hidden", i !== cur); s.querySelector("a").tabIndex = i === cur ? 0 : -1; });
    dots.forEach((d, i) => d.setAttribute("aria-current", i === cur));
  };
  dots.forEach(d => d.addEventListener("click", () => go(+d.dataset.s)));
  $("#sPrev").addEventListener("click", () => go(cur - 1));
  $("#sNext").addEventListener("click", () => go(cur + 1));
  $("#sPause").addEventListener("click", e => {
    paused = !paused;
    e.currentTarget.textContent = paused ? "▶" : "❚❚";
    e.currentTarget.setAttribute("aria-label", paused ? L("Play slideshow", "स्लाइडशो चलाएँ") : L("Pause slideshow", "स्लाइडशो रोकें"));
  });
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  timer = setInterval(() => { if (!paused && !reduce && document.body.contains(sl[0])) go(cur + 1); else if (!document.body.contains(sl[0])) clearInterval(timer); }, 6000);

  $("#tickBtn").addEventListener("click", e => {
    const p = $("#ticker").classList.toggle("paused");
    e.currentTarget.setAttribute("aria-pressed", p);
    e.currentTarget.textContent = p ? L("Play", "चलाएँ") : L("Pause", "रोकें");
  });
  $("#verifyQuick").addEventListener("submit", e => { e.preventDefault(); window.packaiNavigate(`/verify/${e.target.b.value.trim()}`); });

  const [cs, s] = await Promise.all([api.get("/api/commodities"), api.get("/api/stats")]);
  const groups = {};
  cs.forEach(c => (groups[c.category] ||= []).push(c));
  $("#qc").innerHTML = `<option value="">${L("— Select product —", "— उत्पाद चुनें —")}</option>` +
    Object.entries(groups).map(([cat, list]) => `<optgroup label="${esc(catLabel(cat))}">${list.map(c => `<option value="${c.id}">${esc(cname(c))}</option>`).join("")}</optgroup>`).join("");
  $("#quickForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target;
    if (!f.c.value) { toast(L("Please select a product", "कृपया उत्पाद चुनें")); f.c.focus(); return; }
    const body = { commodity_id: f.c.value, net_weight_kg: +f.w.value || 1 };
    if (f.d.value) body.desired_shelf_life_days = +f.d.value;
    const btn = $("#qBtn"); btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> ${L("Please wait…", "कृपया प्रतीक्षा करें…")}`;
    try { const r = await api.post("/api/recommend", body); window.packaiNavigate(`/result/${r.id}`); }
    catch (err) { toast(err.message); btn.disabled = false; btn.textContent = L("Get advice", "सलाह पाएँ") + " »"; }
  });

  const st = $("#stats").querySelectorAll(".v");
  st[0].textContent = s.knowledge_base.commodities; st[1].textContent = s.knowledge_base.packaging_solutions;
  st[2].textContent = s.recommendations; st[3].textContent = s.batches;
  const byName = Object.fromEntries(cs.map(c => [c.name, c]));
  $("#recent").innerHTML = s.recent.length ? table([
    { label: L("Product", "उत्पाद"), render: r => `<a href="/result/${r.id}" data-link>${esc(cname(byName[r.commodity] || { name: r.commodity }))}</a>` },
    { label: L("Recommended pack", "अनुशंसित पैक"), render: r => esc(r.top_solution || "–") },
    { label: L("Shelf life", "शेल्फ-लाइफ"), num: true, render: r => days(r.predicted_days) },
    { label: "", render: r => r.certified ? statusBadge("good", L("certified", "प्रमाणित")) : "" }], s.recent.slice(0, 6))
    : `<div class="empty">${L("No reports yet.", "अभी कोई रिपोर्ट नहीं।")}</div>`;
}
