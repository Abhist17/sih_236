// Minimal English / Hindi localisation for navigation and the main form (farmer-friendly)
const HI = {
  "tagline": "स्मार्ट खाद्य पैकेजिंग",
  "nav.home": "डैशबोर्ड", "nav.recommend": "नई सिफ़ारिश", "nav.tools": "उपकरण", "nav.map": "MAP डिज़ाइनर",
  "nav.shelf": "शेल्फ-लाइफ सिम्युलेटर", "nav.materials": "सामग्री एक्सप्लोरर", "nav.commodities": "उत्पाद सूची",
  "nav.trace": "ट्रेसबिलिटी", "nav.batches": "बैच और QR", "nav.ledger": "PackChain लेजर", "nav.verify": "पैक सत्यापित करें",
  "nav.insight": "जानकारी", "nav.history": "इतिहास", "nav.ai": "AI मॉडल", "nav.about": "कार्यप्रणाली",
  "f.commodity": "उत्पाद (कमोडिटी)", "f.product": "उत्पाद के गुण", "f.moisture": "नमी (%)", "f.fat": "वसा (%)",
  "f.protein": "प्रोटीन (%)", "f.ph": "pH", "f.aw": "जल सक्रियता (aw)", "f.respiration_rate": "श्वसन दर (mg CO₂/kg·h)",
  "f.state": "भौतिक अवस्था", "f.storage": "भंडारण और परिवहन", "f.stype": "भंडारण प्रकार", "f.storage_temp": "भंडारण तापमान (°C)",
  "f.rh": "सापेक्ष आर्द्रता (%)", "f.desired_shelf_life_days": "वांछित शेल्फ-लाइफ (दिन)", "f.transport": "परिवहन", "f.cold": "कोल्ड चेन उपलब्ध",
  "f.pack": "पैक विवरण", "f.net_weight_kg": "प्रति पैक वज़न (kg)", "f.process": "प्रसंस्करण", "f.prefs": "प्राथमिकताएँ",
  "f.priority": "प्राथमिकता", "f.submit": "सिफ़ारिश प्राप्त करें", "f.name": "उत्पाद का नाम", "f.category": "श्रेणी", "f.respiration_temp": "…मापन तापमान (°C)", "f.package_area_m2": "पैकेज क्षेत्रफल (m²)", "f.headspace_ml": "हेडस्पेस (mL)", "f.max_cost_per_pack": "प्रति पैक बजट (₹)",
  "p.balanced": "संतुलित", "p.performance": "प्रदर्शन", "p.cost": "कम लागत", "p.eco": "पर्यावरण",
};
let lang = (() => { try { return localStorage.getItem("packai-lang") || "en"; } catch { return "en"; } })();
const EN = {};
export function t(key, fallback) { return lang === "hi" ? (HI[key] || fallback || EN[key] || key) : (fallback || EN[key] || key); }
export function getLang() { return lang; }
export function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach(el => {
    const k = el.dataset.i18n;
    if (!(k in EN)) EN[k] = el.textContent;
    el.textContent = lang === "hi" ? (HI[k] || EN[k]) : EN[k];
  });
  document.documentElement.lang = lang === "hi" ? "hi" : "en";
}
export function toggleLang() { lang = lang === "hi" ? "en" : "hi"; try { localStorage.setItem("packai-lang", lang); } catch {} return lang; }
