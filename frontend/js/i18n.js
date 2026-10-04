// Bilingual (English / हिन्दी) support.
//  • In page code, every user-visible string is written as L("English", "हिन्दी") so nothing can be
//    left untranslated by a missing key.
//  • Static markup in index.html carries data-hi="…" (and data-hi-placeholder / data-hi-aria).
//  • Data coming from the engine (categories, families, mechanisms, statuses…) is translated
//    through the lookup tables below.

let lang = (() => { try { return localStorage.getItem("packai-lang") || "en"; } catch { return "en"; } })();

export const getLang = () => lang;
export const isHi = () => lang === "hi";
export const L = (en, hi) => (lang === "hi" && hi ? hi : en);
export function setLang(l) {
  lang = l === "hi" ? "hi" : "en";
  try { localStorage.setItem("packai-lang", lang); } catch { /* private mode */ }
  document.documentElement.lang = lang;
}

export function applyI18n(root = document) {
  root.querySelectorAll("[data-hi]").forEach(el => {
    if (el.dataset.en === undefined) el.dataset.en = el.textContent;
    el.textContent = lang === "hi" ? el.dataset.hi : el.dataset.en;
  });
  root.querySelectorAll("[data-hi-placeholder]").forEach(el => {
    if (el.dataset.enPlaceholder === undefined) el.dataset.enPlaceholder = el.placeholder;
    el.placeholder = lang === "hi" ? el.dataset.hiPlaceholder : el.dataset.enPlaceholder;
  });
  root.querySelectorAll("[data-hi-aria]").forEach(el => {
    if (el.dataset.enAria === undefined) el.dataset.enAria = el.getAttribute("aria-label") || "";
    el.setAttribute("aria-label", lang === "hi" ? el.dataset.hiAria : el.dataset.enAria);
  });
  document.documentElement.lang = lang;
}

const pick = (map, key, fallback) => {
  const v = map[key];
  if (!v) return fallback ?? key ?? "";
  return lang === "hi" ? v[1] : v[0];
};

export const CATEGORIES = {
  fruit: ["Fresh fruit", "ताज़े फल"], vegetable: ["Fresh vegetable", "ताज़ी सब्ज़ी"], leafy: ["Leafy greens & herbs", "पत्तेदार सब्ज़ियाँ और जड़ी-बूटियाँ"],
  fresh_cut: ["Fresh-cut / minimally processed", "कटे हुए / न्यूनतम प्रसंस्कृत"], root_bulb: ["Roots, tubers & bulbs", "जड़, कंद और गांठ"],
  dairy_liquid: ["Liquid dairy", "तरल दुग्ध उत्पाद"], dairy_fresh: ["Fresh dairy (paneer, curd, cheese)", "ताज़े दुग्ध उत्पाद (पनीर, दही, चीज़)"],
  dairy_fat: ["Ghee & butter", "घी और मक्खन"], dairy_powder: ["Dairy & infant powders", "दूध व शिशु पाउडर"], meat: ["Meat & poultry", "मांस और मुर्गी"],
  seafood: ["Fish & seafood", "मछली और समुद्री भोजन"], bakery: ["Bread & bakery", "ब्रेड और बेकरी"], snack: ["Fried & extruded snacks", "तले व एक्सट्रूडेड स्नैक्स"],
  biscuit: ["Biscuits, cereals & confectionery", "बिस्कुट, अनाज और मिठाइयाँ"], grain: ["Cereal grains & pulses", "अनाज और दालें"],
  flour: ["Flours & milled products", "आटा और पिसे उत्पाद"], sugar_salt: ["Sugar, salt & jaggery", "चीनी, नमक और गुड़"],
  spice: ["Spices, tea & coffee", "मसाले, चाय और कॉफ़ी"], dry_fruit: ["Dry fruits & nuts", "सूखे मेवे"], dehydrated: ["Dehydrated foods & powders", "निर्जलित खाद्य और पाउडर"],
  oil: ["Edible oils", "खाद्य तेल"], sauce: ["Pickles, sauces & preserves", "अचार, सॉस और जैम"], beverage: ["Juices & beverages", "जूस और पेय"],
  rte: ["Ready-to-eat / retort meals", "रेडी-टू-ईट भोजन"], frozen: ["Frozen foods", "जमे हुए खाद्य"], egg: ["Eggs", "अंडे"], batter: ["Fermented batters", "किण्वित घोल"],
};
export const catLabel = id => pick(CATEGORIES, id);

export const FAMILIES = {
  polyolefin_mono: ["Mono-material polyolefin film (PE/PP)", "एकल-सामग्री पॉलीओलेफ़िन फ़िल्म (PE/PP)"],
  compostable: ["Bio-based / compostable film", "जैव-आधारित / कम्पोस्टेबल फ़िल्म"], paper_based: ["Paper-based", "कागज़-आधारित"],
  metallized_laminate: ["Metallised laminate", "मेटलाइज़्ड लेमिनेट"], pet_pe_laminate: ["PET/PE-type laminate", "PET/PE लेमिनेट"],
  foil_laminate: ["Aluminium-foil laminate", "एल्यूमिनियम फ़ॉइल लेमिनेट"], retort_pouch: ["Retort pouch", "रिटॉर्ट पाउच"],
  vacuum_barrier: ["Vacuum barrier pouch", "वैक्यूम बैरियर पाउच"], evoh_high_barrier: ["EVOH / oxide high-barrier", "EVOH / ऑक्साइड उच्च-बैरियर"],
  aseptic_carton: ["Aseptic carton", "एसेप्टिक कार्टन"], hermetic_grain: ["Hermetic grain storage", "हर्मेटिक अनाज भंडारण"],
  bulk_sack: ["Bulk woven sack", "बड़ा बुना बोरा"], rigid_glass_metal: ["Glass / metal container", "कांच / धातु पात्र"],
  rigid_plastic: ["Rigid plastic container", "कठोर प्लास्टिक पात्र"], map_tray: ["Barrier tray for MAP", "MAP हेतु बैरियर ट्रे"],
  ventilated_rigid: ["Ventilated tray / clamshell", "हवादार ट्रे / क्लैमशेल"], ventilated_mesh: ["Mesh / jute (ventilated)", "जालीदार / जूट (हवादार)"],
  breathable_perforated: ["Breathable micro-perforated film", "सूक्ष्म-छिद्रित श्वसनशील फ़िल्म"],
};
export const famLabel = (id, fallback) => pick(FAMILIES, id, fallback);

const MECH = {
  "Respiration & senescence": "श्वसन और जीर्णता", "Moisture / weight loss": "नमी / वज़न में कमी",
  "Moisture gain (loss of crispness / caking)": "नमी बढ़ना (कुरकुरापन खोना / गांठ बनना)", "Drying / freezer burn": "सूखना / फ़्रीज़र बर्न",
  "Oxidative rancidity / flavour loss": "ऑक्सीकरण से बासीपन / स्वाद हानि", "Light-induced deterioration": "प्रकाश से ख़राबी",
  "Microbial spoilage": "सूक्ष्मजीवी ख़राबी", "Insect infestation": "कीट प्रकोप", "Intrinsic quality decline": "प्राकृतिक गुणवत्ता ह्रास",
  "Frozen-storage quality (HQL)": "जमे भंडारण की गुणवत्ता",
};
export const mechLabel = en => (lang === "hi" && MECH[en]) ? MECH[en] : en;

export const TECHNIQUES = {
  passive_map: ["Passive MAP (breathable)", "पैसिव MAP (श्वसनशील)"], active_map: ["Gas-flushed MAP", "गैस-फ्लश MAP"],
  vacuum: ["Vacuum packing", "वैक्यूम पैकिंग"], n2_flush: ["Nitrogen flushing", "नाइट्रोजन फ्लशिंग"],
  ventilated: ["Ventilated", "हवादार"], breathable: ["Breathable", "श्वसनशील"], standard: ["Standard sealed pack", "सामान्य सील पैक"],
};
export const techLabel = id => pick(TECHNIQUES, id, id);

export const RECYCLE = {
  widely: ["Widely recyclable", "व्यापक रूप से पुनर्चक्रण योग्य"], limited: ["Limited recyclability", "सीमित पुनर्चक्रण"],
  "not recyclable": ["Not recyclable", "पुनर्चक्रण योग्य नहीं"], "industrial compostable": ["Industrial compostable", "औद्योगिक कम्पोस्टेबल"],
  "home compostable": ["Home compostable", "घरेलू कम्पोस्टेबल"],
};
export const recycleLabel = id => pick(RECYCLE, id, id);

export const STORAGE = { ambient: ["Ambient", "सामान्य तापमान"], chilled: ["Chilled", "ठंडा (रेफ़्रिजरेटेड)"], frozen: ["Frozen", "जमा हुआ (फ़्रोज़न)"] };
export const storageLabel = id => pick(STORAGE, id);

export const TRANSPORT = {
  local: ["Local (<100 km)", "स्थानीय (<100 किमी)"], regional: ["Regional road (100-500 km)", "क्षेत्रीय सड़क (100-500 किमी)"],
  long_road: ["Long-distance road (>500 km)", "लंबी दूरी सड़क (>500 किमी)"], rail: ["Rail / Kisan Rail", "रेल / किसान रेल"],
  sea_export: ["Sea export", "समुद्री निर्यात"], air_export: ["Air export", "हवाई निर्यात"],
};
export const transportLabel = id => pick(TRANSPORT, id);

export const PROCESS = {
  none: ["None / fresh", "कोई नहीं / ताज़ा"], pasteurised: ["Pasteurised", "पाश्चुरीकृत"], hot_fill: ["Hot-fill (85-92 °C)", "गरम भराई (85-92 °C)"],
  retort: ["Retort sterilised (121 °C)", "रिटॉर्ट स्टरलाइज़्ड (121 °C)"], aseptic: ["Aseptic (UHT)", "एसेप्टिक (UHT)"],
};
export const PRIORITY = { balanced: ["Balanced", "संतुलित"], performance: ["Best protection", "सर्वोत्तम सुरक्षा"], cost: ["Lowest cost", "न्यूनतम लागत"], eco: ["Eco-friendly", "पर्यावरण-अनुकूल"] };
export const STATES = { solid: ["Solid", "ठोस"], liquid: ["Liquid", "तरल"], paste: ["Paste / semi-solid", "पेस्ट / अर्ध-ठोस"], powder: ["Powder", "पाउडर"], granular: ["Granular", "दानेदार"] };

export const DRIVERS = {
  oxidation: ["oxidation", "ऑक्सीकरण"], "moisture gain": ["moisture gain", "नमी बढ़ना"], "respiration (MAP)": ["respiration (MAP)", "श्वसन (MAP)"],
  "MAP gas retention": ["MAP gas retention", "MAP गैस धारण"], "moisture loss": ["moisture loss", "नमी की कमी"],
  "sublimation (freezer burn)": ["sublimation (freezer burn)", "ऊर्ध्वपातन (फ़्रीज़र बर्न)"],
};
export const driverLabel = id => pick(DRIVERS, id, id);

export const EVENTS = {
  harvested: ["Harvested", "कटाई"], packed: ["Packed", "पैक किया"], dispatched: ["Dispatched", "रवाना"], in_transit: ["In transit", "रास्ते में"],
  received: ["Received", "प्राप्त"], stored: ["Stored", "भंडारित"], retail: ["At retail", "दुकान पर"], sold: ["Sold", "बिक गया"],
  temperature_log: ["Temperature log", "तापमान रिकॉर्ड"], quality_check: ["Quality check", "गुणवत्ता जाँच"], recalled: ["Recalled", "वापस मंगाया"],
};
export const eventLabel = id => pick(EVENTS, id, id);

export const ROLES = {
  farmer: ["Farmer / FPO", "किसान / FPO"], processor: ["Food processor", "खाद्य प्रसंस्करणकर्ता"], packer: ["Packhouse", "पैकहाउस"],
  packaging_supplier: ["Packaging supplier", "पैकेजिंग आपूर्तिकर्ता"], transporter: ["Transporter", "परिवहनकर्ता"],
  warehouse: ["Warehouse / cold store", "गोदाम / शीत भंडार"], retailer: ["Retailer", "खुदरा विक्रेता"], lab: ["Testing lab", "परीक्षण प्रयोगशाला"],
  regulator: ["Regulator", "नियामक"], consumer: ["Consumer", "उपभोक्ता"], authority: ["Authority", "प्राधिकरण"],
};
export const roleLabel = id => pick(ROLES, id, id);

export const KIND = { mono: ["Mono-layer film", "एकल-परत फ़िल्म"], laminate: ["Multilayer laminate", "बहु-परत लेमिनेट"], rigid: ["Rigid container", "कठोर पात्र"], open: ["Ventilated format", "हवादार प्रारूप"] };
export const kindLabel = id => pick(KIND, id);

// Commodity display name: Hindi name first when Hindi is active.
export function cname(c) {
  if (!c) return "";
  const hi = c.hi || c.name_hi;
  return lang === "hi" && hi ? `${hi} (${c.name})` : c.name;
}

// Reverse lookup: English family label (as sent by the API) -> current language
export function famFromLabel(label) {
  const e = Object.entries(FAMILIES).find(([, v]) => v[0] === label);
  return e ? pick(FAMILIES, e[0]) : label;
}
// Pack-size sentence from the engine
export function packDims(t) {
  if (lang !== "hi" || !t) return t;
  return t.replace("flat pouch (each side)", "समतल पाउच (प्रत्येक ओर)").replace("container surface", "पात्र सतह");
}
