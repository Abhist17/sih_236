# 7-minute demo walkthrough

Start with `./run.sh --seed` and open http://localhost:8000.

1. **Dashboard (30 s).** Knowledge base size, model accuracy, recent reports.
2. **New recommendation — broccoli (2 min).**
   - Quick-pick *Broccoli*: properties auto-fill (respiration 25 mg CO₂/kg·h, MAP window 1–2 % O₂ / 5–10 % CO₂).
   - Result: *Micro-perforated LLDPE* with the exact number of laser holes, equilibrium O₂/CO₂ and the in-pack atmosphere chart. Point out the shaded target band.
   - Open the *Shelf life* tab: senescence limits life. Walk through the rejected options: foil and retort were excluded because produce would go anaerobic.
3. **Contrast — potato chips (1 min).**
   - Same engine, opposite physics: oxidation + moisture gain drive the choice, so we get BOPP/MET-BOPP + N₂ flush, a light barrier ≥ 90 %, and the OTR/WVTR specs versus requirements.
   - Switch priority to *Eco* to show the trade-off alternatives.
4. **Custom product (30 s).** Enter "Ragi cookies" by composition only: the AI shows similar commodities and a practice-family prediction.
5. **PDF + certification (30 s).** Download the report, click *Certify on PackChain*, open *Verify report* → AUTHENTIC.
6. **Traceability (1.5 min).**
   - *Batches & QR* → open the seeded broccoli batch: a transporter logged a 2 h reefer failure at 15 °C.
   - Scan the QR (or open */verify/…*): the consumer sees **remaining shelf life** reduced by the excursion, the signed journey and the cryptographic checks.
   - *Ledger* → *Validate entire chain*.
7. **AI model page (30 s).** Honest metrics (80 % hold-out, 87 % top-3 on unseen commodities), feature importance, the feedback → retrain loop and CSV upload.
8. **Close.**
   - Mobile PWA with a Hindi toggle serves farmers.
   - EPR/FSSAI compliance checklist in every report.
   - Solidity anchor ready for Polygon.
