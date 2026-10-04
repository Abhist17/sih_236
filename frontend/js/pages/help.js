import { L } from "../i18n.js";
import { esc, pageHead } from "../ui.js";

export default async function helpPage(main) {
  const faqs = [
    [L("Who can use this portal?", "इस पोर्टल का उपयोग कौन कर सकता है?"), L("Anyone. It is meant mainly for farmers, FPOs, food processing units, start-ups, packaging suppliers and students of food technology.", "कोई भी। यह मुख्य रूप से किसानों, FPO, खाद्य प्रसंस्करण इकाइयों, स्टार्ट-अप, पैकेजिंग आपूर्तिकर्ताओं और खाद्य प्रौद्योगिकी के विद्यार्थियों के लिए है।")],
    [L("Do I need to register?", "क्या पंजीकरण आवश्यक है?"), L("No registration is needed for packaging advice, reports or verification. Registration is needed only if you want to create QR batches and record hand-overs.", "पैकेजिंग सलाह, रिपोर्ट या सत्यापन के लिए पंजीकरण नहीं चाहिए। केवल QR बैच बनाने और हस्तांतरण दर्ज करने के लिए पंजीकरण आवश्यक है।")],
    [L("I don't know the moisture, fat or pH of my product.", "मुझे अपने उत्पाद की नमी, वसा या pH नहीं पता।"), L("Select your product from the list and typical values are filled in. If your product is not in the list, choose 'New product' and enter whatever you know; the rest is estimated.", "सूची से अपना उत्पाद चुनें, सामान्य मान भर जाएँगे। यदि उत्पाद सूची में नहीं है, तो 'नया उत्पाद' चुनें और जो जानते हैं वह भरें; बाकी अनुमानित होगा।")],
    [L("What do OTR and WVTR mean?", "OTR और WVTR का क्या अर्थ है?"), L("OTR (oxygen transmission rate) is how much oxygen passes through one square metre of film in a day. WVTR is the same for water vapour. A lower number means the film protects better.", "OTR (ऑक्सीजन ट्रांसमिशन रेट) बताता है कि एक वर्ग मीटर फ़िल्म से एक दिन में कितनी ऑक्सीजन गुज़रती है। WVTR यही जल-वाष्प के लिए है। कम संख्या = बेहतर सुरक्षा।")],
    [L("What is MAP?", "MAP क्या है?"), L("Modified Atmosphere Packaging means changing the air inside the pack. For fruits and vegetables it is done with tiny holes in the bag; for meat, paneer or snacks, by filling the pack with a gas such as nitrogen or carbon dioxide before sealing.", "मॉडिफ़ाइड एटमॉस्फ़ियर पैकेजिंग का अर्थ है पैक के अंदर की हवा बदलना। फल-सब्ज़ियों में यह थैली में छोटे छेदों से होता है; मांस, पनीर या स्नैक्स में सील करने से पहले नाइट्रोजन या कार्बन डाइऑक्साइड जैसी गैस भरकर।")],
    [L("How accurate is the shelf-life figure?", "शेल्फ-लाइफ का आँकड़ा कितना सही है?"), L("It is calculated with published food-science methods and is a reliable starting point. Before a commercial launch, confirm it with a storage trial of your own product.", "यह प्रकाशित खाद्य-विज्ञान विधियों से निकाला जाता है और एक भरोसेमंद शुरुआत है। व्यावसायिक बिक्री से पहले अपने उत्पाद के भंडारण परीक्षण से इसकी पुष्टि करें।")],
    [L("Where can I buy the recommended packaging?", "अनुशंसित पैकेजिंग कहाँ से ख़रीदें?"), L("Show the PDF report to any flexible packaging converter or supplier. It lists the structure, thickness, OTR, WVTR and sealing details they need to quote.", "PDF रिपोर्ट किसी भी फ़्लेक्सिबल पैकेजिंग निर्माता या आपूर्तिकर्ता को दिखाएँ। इसमें संरचना, मोटाई, OTR, WVTR और सीलिंग का विवरण है जो उन्हें भाव देने के लिए चाहिए।")],
    [L("What happens when someone scans my QR label?", "मेरा QR लेबल स्कैन करने पर क्या होता है?"), L("They see the product, packing date, packaging used, each hand-over with temperature, and the shelf life left. They cannot change anything.", "उन्हें उत्पाद, पैकिंग तिथि, उपयोग की गई पैकेजिंग, तापमान सहित हर हस्तांतरण और बची शेल्फ-लाइफ दिखती है। वे कुछ भी बदल नहीं सकते।")],
    [L("Is the portal available in my language?", "क्या पोर्टल मेरी भाषा में उपलब्ध है?"), L("Hindi and English are available now. Use the हिन्दी / English buttons at the top of every page.", "अभी हिन्दी और अंग्रेज़ी उपलब्ध हैं। हर पृष्ठ के ऊपर हिन्दी / English बटन का उपयोग करें।")],
  ];
  let credits = {};
  try { credits = await (await fetch("/img/credits.json")).json(); } catch { /* offline */ }
  const sitemap = [
    [L("Home", "मुखपृष्ठ"), "/"], [L("Get packaging advice", "पैकेजिंग सलाह लें"), "/recommend"], [L("MAP pack designer", "MAP पैक डिज़ाइनर"), "/tools/map"],
    [L("Shelf-life calculator", "शेल्फ-लाइफ कैलकुलेटर"), "/tools/shelf-life"], [L("Packaging materials", "पैकेजिंग सामग्री"), "/materials"], [L("Commodity library", "उत्पाद सूची"), "/commodities"],
    [L("Batches & QR labels", "बैच और QR लेबल"), "/trace"], [L("Verify a pack", "पैक सत्यापित करें"), "/verify"], [L("PackChain ledger", "PackChain लेजर"), "/ledger"],
    [L("Report history", "रिपोर्ट इतिहास"), "/history"], [L("AI model", "AI मॉडल"), "/ai"], [L("Methodology", "कार्यप्रणाली"), "/about"], [L("Help & FAQs", "सहायता और प्रश्नोत्तर"), "/help"],
  ];
  main.innerHTML = pageHead({ title: L("Help & FAQs", "सहायता और प्रश्नोत्तर"),
    desc: L("Guide to using the portal, answers to common questions, and the portal's policies.", "पोर्टल उपयोग की मार्गदर्शिका, सामान्य प्रश्नों के उत्तर और पोर्टल की नीतियाँ।") }) + `<div class="wrap page-body">
  <div class="grid help-grid">
    <nav class="card" aria-label="${L("On this page", "इस पृष्ठ पर")}"><div class="box-head">${L("On this page", "इस पृष्ठ पर")}</div>
      <ul class="arrows">
        <li><a href="#guide">${L("How to use", "उपयोग कैसे करें")}</a></li><li><a href="#faq">${L("FAQs", "प्रश्नोत्तर")}</a></li>
        <li><a href="#accessibility">${L("Accessibility", "सुगम्यता")}</a></li><li><a href="#terms">${L("Terms of use", "उपयोग की शर्तें")}</a></li>
        <li><a href="#privacy">${L("Privacy policy", "गोपनीयता नीति")}</a></li><li><a href="#disclaimer">${L("Disclaimer", "अस्वीकरण")}</a></li>
        <li><a href="#credits">${L("Photo credits", "फ़ोटो साभार")}</a></li><li><a href="#sitemap">${L("Sitemap", "साइटमैप")}</a></li>
        <li><a href="#contact">${L("Contact", "संपर्क")}</a></li>
      </ul></nav>
    <div class="stack">
      <section class="card" id="guide"><h2 class="card-title">${L("How to use the portal", "पोर्टल का उपयोग कैसे करें")}</h2>
        <ol>
          <li>${L("Click <b>Get Packaging Advice</b> in the menu.", "मेनू में <b>पैकेजिंग सलाह लें</b> पर क्लिक करें।")}</li>
          <li>${L("Type or select your product. Typical properties are filled in automatically.", "अपना उत्पाद लिखें या चुनें। सामान्य गुण अपने-आप भर जाते हैं।")}</li>
          <li>${L("Enter storage temperature, transport and how many days the product must last.", "भंडारण तापमान, परिवहन और उत्पाद कितने दिन चलना चाहिए, यह भरें।")}</li>
          <li>${L("Enter the weight per pack and choose what matters most to you (protection, cost or environment).", "प्रति पैक वज़न भरें और चुनें कि आपके लिए सबसे ज़रूरी क्या है (सुरक्षा, लागत या पर्यावरण)।")}</li>
          <li>${L("Read the summary at the top of the result. Open any option to see full details.", "परिणाम के ऊपर दिया सारांश पढ़ें। पूरा विवरण देखने के लिए कोई भी विकल्प खोलें।")}</li>
          <li>${L("Download the PDF and share it with your packaging supplier.", "PDF डाउनलोड करें और अपने पैकेजिंग आपूर्तिकर्ता को दें।")}</li>
          <li>${L("Optional: create a batch and print the QR label for your packs.", "वैकल्पिक: बैच बनाएँ और अपने पैकों के लिए QR लेबल छापें।")}</li>
        </ol></section>
      <section class="card faq" id="faq"><h2 class="card-title">${L("Frequently asked questions", "अक्सर पूछे जाने वाले प्रश्न")}</h2>
        ${faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</section>
      <section class="card" id="accessibility"><h2 class="card-title">${L("Accessibility statement", "सुगम्यता विवरण")}</h2>
        <p>${L("We want everyone to be able to use this portal, including people with low vision and users of screen readers. The portal follows the Guidelines for Indian Government Websites (GIGW) and WCAG 2.1 where possible.", "हम चाहते हैं कि कम दृष्टि वाले और स्क्रीन रीडर उपयोगकर्ताओं सहित सभी इस पोर्टल का उपयोग कर सकें। पोर्टल जहाँ तक संभव हो भारतीय सरकारी वेबसाइट दिशानिर्देश (GIGW) और WCAG 2.1 का पालन करता है।")}</p>
        <ul>
          <li>${L("Text size can be changed with the A- / A / A+ buttons at the top.", "ऊपर A- / A / A+ बटन से अक्षर का आकार बदला जा सकता है।")}</li>
          <li>${L("The ◐ button switches to a high-contrast (black and yellow) view.", "◐ बटन उच्च कंट्रास्ट (काला और पीला) दृश्य चालू करता है।")}</li>
          <li>${L("All pages work with the keyboard; 'Skip to main content' is available at the top.", "सभी पृष्ठ कीबोर्ड से चलते हैं; ऊपर 'मुख्य सामग्री पर जाएँ' उपलब्ध है।")}</li>
          <li>${L("Moving content (banner, news ticker) can be paused.", "चलती सामग्री (बैनर, समाचार पट्टी) रोकी जा सकती है।")}</li>
          <li>${L("The complete portal is available in Hindi and English.", "पूरा पोर्टल हिन्दी और अंग्रेज़ी में उपलब्ध है।")}</li>
        </ul></section>
      <section class="card" id="terms"><h2 class="card-title">${L("Terms of use", "उपयोग की शर्तें")}</h2>
        <p>${L("The portal is provided free of charge for information and decision support. You may use, print and share the reports. Do not misuse the traceability records or enter false information about batches.", "यह पोर्टल जानकारी और निर्णय-सहायता के लिए निःशुल्क है। आप रिपोर्ट का उपयोग, प्रिंट और साझा कर सकते हैं। ट्रेसबिलिटी रिकॉर्ड का दुरुपयोग न करें और बैच के बारे में ग़लत जानकारी न भरें।")}</p></section>
      <section class="card" id="privacy"><h2 class="card-title">${L("Privacy policy", "गोपनीयता नीति")}</h2>
        <p>${L("We do not ask for your phone number, Aadhaar or any personal document. Packaging inputs and reports are stored to generate and verify reports. Names and locations you enter during batch registration become part of the public traceability record, so enter only what you are comfortable sharing. Language and text-size settings are stored only in your browser.", "हम आपका फ़ोन नंबर, आधार या कोई व्यक्तिगत दस्तावेज़ नहीं माँगते। रिपोर्ट बनाने और सत्यापित करने के लिए पैकेजिंग इनपुट और रिपोर्ट सहेजी जाती हैं। बैच पंजीकरण में भरे गए नाम और स्थान सार्वजनिक ट्रेसबिलिटी रिकॉर्ड का हिस्सा बनते हैं, इसलिए केवल वही भरें जो साझा करने में आपको आपत्ति न हो। भाषा और अक्षर-आकार की सेटिंग केवल आपके ब्राउज़र में रहती है।")}</p></section>
      <section class="card" id="disclaimer"><h2 class="card-title">${L("Disclaimer", "अस्वीकरण")}</h2>
        <p>${L("This portal is a prototype developed by Team PackAI for Smart India Hackathon 2026. It is not an official website of the Government of India or any ministry. Material and product data are typical values from published literature; recommendations should be confirmed with the packaging supplier's test certificate and a storage trial before commercial use. Links to other websites are given for convenience; we are not responsible for their content.", "यह पोर्टल स्मार्ट इंडिया हैकाथॉन 2026 के लिए टीम PackAI द्वारा विकसित प्रोटोटाइप है। यह भारत सरकार या किसी मंत्रालय की आधिकारिक वेबसाइट नहीं है। सामग्री और उत्पाद डेटा प्रकाशित साहित्य के सामान्य मान हैं; व्यावसायिक उपयोग से पहले सिफ़ारिशों की पुष्टि पैकेजिंग आपूर्तिकर्ता के परीक्षण प्रमाणपत्र और भंडारण परीक्षण से करें। अन्य वेबसाइटों के लिंक सुविधा हेतु दिए गए हैं; उनकी सामग्री के लिए हम ज़िम्मेदार नहीं हैं।")}</p></section>
      <section class="card credits" id="credits"><h2 class="card-title">${L("Photo credits", "फ़ोटो साभार")}</h2>
        <p class="muted">${L("Photographs are from Wikimedia Commons and are used under the licences shown.", "फ़ोटो विकिमीडिया कॉमन्स से हैं और दर्शाए गए लाइसेंस के अंतर्गत उपयोग किए गए हैं।")}</p>
        <div class="table-wrap"><table><thead><tr><th>${L("Photo", "फ़ोटो")}</th><th>${L("Author", "लेखक")}</th><th>${L("Licence", "लाइसेंस")}</th></tr></thead><tbody>
        ${Object.values(credits).map(c => `<tr><td><a href="${esc(c.source)}" target="_blank" rel="noopener">${esc(c.title)}</a></td><td>${esc(c.author)}</td><td>${c.license_url ? `<a href="${esc(c.license_url)}" target="_blank" rel="noopener">${esc(c.license)}</a>` : esc(c.license)}</td></tr>`).join("")}
        </tbody></table></div></section>
      <section class="card" id="sitemap"><h2 class="card-title">${L("Sitemap", "साइटमैप")}</h2>
        <ul class="arrows" style="columns:2">${sitemap.map(([t, h]) => `<li><a href="${h}" data-link>${esc(t)}</a></li>`).join("")}</ul></section>
      <section class="card" id="contact"><h2 class="card-title">${L("Contact", "संपर्क")}</h2>
        <p>${L("To report a problem or suggest an improvement, open an issue on the project's GitHub page:", "कोई समस्या बताने या सुझाव देने के लिए प्रोजेक्ट के GitHub पृष्ठ पर issue खोलें:")} <a href="https://github.com/Abhist17/sih_236/issues" target="_blank" rel="noopener">github.com/Abhist17/sih_236/issues</a></p>
        <p>${L("You can also send feedback on any report from the 'Tell us how it worked' form at the bottom of the result page.", "आप परिणाम पृष्ठ के नीचे 'बताइए यह कैसा रहा' फ़ॉर्म से किसी भी रिपोर्ट पर प्रतिक्रिया भेज सकते हैं।")}</p></section>
    </div>
  </div></div>`;
}
