# PackAI — Research Dossier

Research and design background for the SIH problem statement *"AI-based intelligent food packaging material recommendation system for food commodities."*

---

## 1. Problem analysis

### 1.1 Why packaging selection fails today

Indian food chains lose a large share of perishable produce after harvest; NABCONS (2022, for MoFPI) puts losses at **roughly 5–15 % for fruits and vegetables**. Packaging and handling are major, controllable causes. Four failure modes dominate:

| Failure | Mechanism | Typical victims |
|---|---|---|
| Wrong gas barrier | O₂ ingress → lipid oxidation / rancidity, vitamin and colour loss | Chips, namkeen, nuts, ghee, oils, milk powder, coffee |
| Wrong moisture barrier | Water-vapour ingress → loss of crispness, caking, mould; or moisture loss → wilting, drying, freezer burn | Biscuits, spices, sugar, flour; leafy greens; frozen foods |
| Wrong atmosphere for living produce | Too tight → anaerobic fermentation and off-odours; too open → no MAP benefit, fast senescence | All fresh fruits and vegetables |
| Wrong mechanics or thermal rating | Punctures, seal failures, brittleness in freezers, deformation in retort or hot-fill | Meat and fish with bones, frozen foods, retort meals, heavy bulk packs |

Large FMCG firms employ packaging technologists. MSMEs, FPOs, start-ups and farmers usually copy a competitor's pouch or ask a converter. That leads either to **under-packaging** (spoilage, recalls) or **over-packaging** (multi-layer foil where mono-PE would do), which costs money and creates non-recyclable waste under EPR obligations.

### 1.2 What a correct decision requires

Choosing a package is a coupled engineering problem:

1. **Food properties:** moisture, a_w, sorption isotherm, fat and O₂ sensitivity, pH, light sensitivity, respiration rate and its temperature dependence, ethylene behaviour, chilling sensitivity, microbial ecology.
2. **Conditions:** storage temperature and RH, transport duration and abuse, cold-chain availability, retail light.
3. **Material properties:** OTR, WVTR and CO₂TR and how they vary with thickness, temperature and humidity; seal window; mechanical and thermal limits; cost; carbon; end of life.
4. **Package geometry:** surface area to mass, headspace.
5. **Regulation:** FSSAI food-contact and migration rules, BIS standards, PWM Rules/EPR, labelling.

PackAI encodes all five layers.

---

## 2. Domain science implemented

### 2.1 Permeation

- Steady-state Fickian permeation: transmission rate ∝ 1/thickness for homogeneous films.
- Multilayer laminates: resistances in series, 1/OTR = Σ 1/OTRᵢ (same for WVTR and CO₂TR).
- Temperature: Arrhenius, OTR(T) = OTR(23 °C)·exp[−Ea/R(1/T − 1/296)], with Ea of about 25–50 kJ/mol by polymer.
- Humidity: EVOH, PA and regenerated cellulose are plasticised by water. Modelled as a multiplier (1 + k·x²) above 50 % RH, reduced for buried layers.
- Standard test conditions: OTR per ASTM D3985 (23 °C, 0 % RH); WVTR per ASTM F1249 (38 °C, 90 % RH).

Representative values at reference thickness (Robertson 2013; Siracusa 2012; supplier datasheets):

| Polymer | OTR cc/m²·d·atm | WVTR g/m²·d | Note |
|---|---|---|---|
| LDPE 25 µm | ~7,800 | ~18 | breathable, excellent sealant |
| HDPE 25 µm | ~2,300 | ~6 | good moisture barrier |
| BOPP 20 µm | ~1,800 | ~5.5 | stiff, printable |
| BOPET 12 µm | ~110 | ~45 | O₂ barrier, poor moisture barrier |
| BOPA 15 µm | ~30 (dry) | ~260 | puncture-resistant, humidity-sensitive |
| EVOH 32 % 25 µm | ~0.3 (dry) | ~50 | ultra O₂ barrier, humidity-sensitive |
| Met-PET 12 µm | ~1 | ~1 | light barrier |
| Met-BOPP 20 µm | ~25 | ~0.3 | best moisture barrier per ₹ |
| Al foil ≥ 9 µm | ≈0 (pinholes) | ≈0 | absolute barrier, not recyclable in laminates |
| PLA 25 µm | ~550 | ~250 | compostable, poor moisture barrier |

### 2.2 Oxygen-limited shelf life

The allowable O₂ uptake tol (mg O₂/kg food) is the oxygen a product can absorb before sensory failure; ppm tables follow Robertson / Salame. Shelf life is:

```
t_ox = (tol·W − headspace O₂) / (OTR_T · A · 0.209 · 1.429)
```

- Headspace O₂ is controlled by N₂ flushing (≤ 2 % residual) or O₂ scavengers.
- A reaction-limited floor applies: a product can't deteriorate faster than it would fully exposed to air.
- Light-sensitive foods in transparent packs are penalised (photo-oxidation, riboflavin loss in milk).
- Tolerances were **calibrated** so reference packages reproduce known commercial shelf lives, e.g. chips in BOPP/MET-BOPP with N₂ reach about 3 months at 30 °C.

### 2.3 Moisture — Labuza linear-isotherm model

For dry foods between the initial and critical moisture:

```
t = (W_dry · b)/(K · A · p₀) · ln[(m_e − m_i)/(m_e − m_c)],   m = b·a_w + c
```

- K is the film's water-vapour permeance, derived from WVTR.
- p₀ is the saturation vapour pressure at storage temperature.
- m_c comes from the critical a_w for crispness loss or caking.

For moist and frozen foods the drying analogue applies, with an acceptable maximum weight loss. Freezer burn adds a sublimation term driven by temperature cycling.

### 2.4 Fresh produce — respiration and passive MAP

- **Respiration classes** (Kader 2002, mg CO₂/kg·h at 5 °C): very low < 5, low 5–10, moderate 10–20, high 20–40, very high 40–60, extreme > 60. Temperature dependence uses Q₁₀ (2–3).
- **Kinetics:** Michaelis-Menten with uncompetitive CO₂ inhibition (Lee et al. 1991; Fonseca et al. 2002):
  RR = Vm·O₂ / (Km + O₂(1 + CO₂/Ki)), with Km ≈ 2 % and Ki ≈ 15 %.
- **Package mass balance at steady state:**
  (P_O₂A/L + n·F_h)(0.209 − y_O₂) = RR·W, and (P_CO₂A/L + n·F_h,CO₂)·y_CO₂ = RQ·RR·W.
- **Micro-perforations** (Fishman et al. 1996): F_h = D·πr²/(L + r), i.e. diffusion through a cylinder with an end correction.
  - PackAI searches hole diameter (40–500 µm) × integer hole count for the equilibrium closest to Kader's recommended window.
  - It prefers fewer holes and penalises CO₂ above tolerance.
- **Ideal selectivity** β = (0.209 − O₂)/CO₂ is reported. Most polyolefins have β ≈ 3–5, perforations ≈ 0.8.
- **Senescence life** scales with the MAP-reduced respiration rate (capped at 3×), with penalties for:
  - anaerobiosis (O₂ < 0.7 × minimum)
  - CO₂ injury
  - chilling injury below the threshold
  - condensation and rot in sealed packs for low-RH commodities (onion, garlic, ginger).
- **Weight loss:** for open packs, transpiration coefficients (Sastry & Buffington; Kader) × VPD, with a bulk-shielding factor. For sealed packs, film permeance plus diffusion through the holes.
- **Transient headspace simulation** (explicit Euler) shows how fast the equilibrium is reached.

Recommended windows used (Kader 2002; Saltveit 2003), for example:

| Commodity | O₂ % | CO₂ % |
|---|---|---|
| broccoli | 1–2 | 5–10 |
| strawberry | 5–10 | 15–20 |
| mango | 3–7 | 5–8 |
| tomato | 3–5 | 2–3 |
| lettuce | 1–5 | 0–2 (CO₂-sensitive) |

### 2.5 Microbial, insect and quality kinetics

- **Ratkowsky square-root model** for spoilage flora: L(T) = L_ref·[(T_ref − T_min)/(T − T_min)]², with T_min ≈ −7 to −10 °C for psychrotrophs.
- **MAP / vacuum benefit factors** (Sivertsvik 2002; Robertson): fish ~1.7–1.8×, poultry ~2.2×, paneer/cheese ~3×, bread ~2.5×. They apply only when the package can hold the gas for the whole shelf life (CO₂-retention check).
- **Gas mixes:**
  - red meat: 70 % O₂ / 30 % CO₂ (bloom)
  - poultry: 30 % CO₂ / 70 % N₂
  - lean fish: 40/30/30
  - fatty fish: 60 % CO₂ / 40 % N₂
  - bakery: 50–60 % CO₂
- **Stored grain insects:** hermetic storage (OTR ≤ 10) lets insect respiration deplete O₂ below about 5 %, which stops infestation without fumigants (Navarro 2012; PICS/GrainPro). Non-hermetic packs have an infestation-limited life.
- **Intrinsic quality** (atta lipolysis, UHT age-gelation, retort-meal quality) uses Q₁₀ = 2. Frozen high-quality life uses Q₁₀ ≈ 3 in the frozen range.
- **Transport:** L_total = t_transit + (1 − t_transit/L(T_transit))·L(T_storage). A missing cold chain is modelled as ≈ 32 °C exposure.

### 2.6 Mechanics

- Minimum LDPE-equivalent gauge = (20 + 30·√W)·severity × 1.4 (sharp products) × 1.15 (frozen) × 1.15 (liquids).
- Other polymers are converted by √(tensile / tensile_LDPE).
- Laminate strength is the sum of layer contributions. The sealant is thickened when needed, up to 150 µm.
- Seal strength targets (ASTM F88): ≥ 10 N/15 mm light dry, ≥ 25 liquids/heavy, ≥ 35 retort.

---

## 3. Sustainability and regulation (India)

- **FSSAI Packaging Regulations 2018:**
  - food-grade materials conforming to IS 10146 (PE), IS 10910 (PP), IS 12252 (PET) and others
  - overall migration ≤ 60 mg/kg (10 mg/dm²) per IS 9845
  - pigments per IS 9833
  - recycled plastic not permitted for direct food contact unless specifically authorised
- **PWM (Amendment) Rules 2022 – EPR categories:**
  - I: rigid plastic
  - II: flexible plastic (single or multilayer)
  - III: multilayered plastic with at least one non-plastic layer
  - IV: compostable plastic, which must be certified to IS/ISO 17088
  - brand owners register as PIBOs on the CPCB portal
- **Jute Packaging Materials Act 1987:** reserves food-grain packing for jute. Food-grade jute bags follow IS 16186 (JBO-free).
- **FSS (Labelling & Display) Regulations 2020** and **Legal Metrology (Packaged Commodities) Rules 2011:** label content.
- **Eco score (0–100):**
  - recyclability: 40
  - carbon per kg of food: 35, log scale, cradle-to-gate factors from PlasticsEurope, European Aluminium, FEVE and ecoinvent
  - material efficiency: 15
  - bio-based content: 10
- The report shows packaging's share of the packed product's footprint (food footprints from Poore & Nemecek 2018). It's usually a few percent, which makes the case that *adequate protection beats minimal packaging*.

---

## 4. AI / ML design

| Component | Algorithm | Purpose |
|---|---|---|
| Industry-practice classifier | Random Forest (150 trees, balanced class weights) on 61 features | Probability that each of 18 packaging families is used in practice for these properties and conditions |
| Surrogate regressors | Random Forest | Instant estimate of the required OTR, required WVTR and achievable shelf life (R² 0.98 / 0.98 / 0.93) |
| Similarity | k-NN on standardised physico-chemical features | "Similar commodities and what they're packed in" (explainability) |
| Ranking | TOPSIS blended with a weighted sum | Technical score, ML probability, eco score, ₹/kg under user priorities |

**Training corpus.** For each of the 96 commodities, 50 Monte-Carlo scenarios perturb composition (±10–15 %), temperature, RH, target life, pack size and transport. The label is the first family in the commodity's curated industry-practice list that the physics engine finds feasible for that scenario. In 25 % of cases the secondary practice is used instead, to model market diversity.

**Validation:**
- Stratified 80/20 hold-out: about 80 % accuracy, top-3 about 100 %.
- Leave-commodity-out (GroupShuffleSplit), which is honest generalisation to unseen foods: about 51 % top-1 and **87 % top-3**.

**Continuous learning.** Positive field feedback (rating ≥ 4 and shelf life ≥ 80 % of target) and uploaded lab CSVs are added at 3× weight on retraining.

---

## 5. Blockchain design rationale

The goal is traceability without a trusted intermediary, but also without gas fees or crypto wallets for farmers.

- **Permissioned ledger (PackChain):**
  - actors hold Ed25519 keys, which are custodial and encrypted with a server secret
  - each transaction is canonical JSON + signature; tx_id = SHA-256
  - blocks carry a Merkle root, the previous hash and a light proof-of-work
  - full validation re-checks every hash, link, PoW and signature
  - consumers get Merkle inclusion proofs per record
- **Spec binding:** each batch commits the SHA-256 of its packaging specification. Verification recomputes it from the database and compares it with the on-chain value, which detects tampering in either place.
- **Dynamic shelf life:** logged temperature and duration segments are integrated with the same kinetic model, so a reefer failure visibly consumes shelf life.
- **Public anchoring:** `PackChainAnchor.sol` (write-once anchors, operator roles, batch-spec registry) runs on Polygon Amoy via web3.py. It is optional and disabled offline.

---

## 6. Calibration spot-checks (engine vs. known practice)

| Scenario | PackAI top pick | Industry reality |
|---|---|---|
| Potato chips, 50 g, 30 °C, 90 d | BOPP / MET-BOPP + N₂ flush | ✔ standard chips laminate |
| Biscuits, 180 d | BOPP / MET-BOPP | ✔ |
| Paneer, chilled | PA/LDPE vacuum pouch | ✔ |
| Fresh chicken | PP/EVOH tray + MAP 30 % CO₂ | ✔ modern retail |
| RTE curry | PET/Al/CPP retort pouch | ✔ (DFRL/MTR practice) |
| Rice 25 kg, 1 year | Hermetic multilayer bag | ✔ post-harvest best practice |
| Broccoli 500 g, 1 °C | Micro-perforated LLDPE → 2 % O₂ / 9 % CO₂ | ✔ matches the Kader window |
| Coffee | PET/MET-PET/PE + N₂ + degassing valve | ✔ |

---

## 7. Roadmap

- IoT data loggers (BLE/LoRa) posting temperature events straight to PackChain.
- Computer-vision spoilage detection from retail photos, as a feedback signal.
- Supplier marketplace: match recommended specifications to converters' certified stock.
- Flutter mobile shell around the PWA, with offline recommendations using on-device surrogate models.
- Regional-language expansion (Marathi, Tamil, Telugu, Bengali).
- Lab-validated datasets from partner institutes (IIP, CFTRI, NIFTEM) to replace expert-distilled labels.

## 8. References

1. Robertson G.L. (2013) *Food Packaging: Principles and Practice*, 3rd ed. CRC Press.
2. Kader A.A. (ed.) (2002) *Postharvest Technology of Horticultural Crops*, UC ANR Pub. 3311.
3. Saltveit M.E. (2003) Is it possible to find an optimal controlled atmosphere? *Postharvest Biol. Technol.* 27:3.
4. Fishman S., Rodov V., Ben-Yehoshua S. (1996) *J. Food Sci.* 61:956 — perforation-mediated MAP model.
5. Fonseca S.C., Oliveira F.A.R., Brecht J.K. (2002) *J. Food Eng.* 52:99 — respiration modelling review.
6. Mangaraj S., Goswami T.K., Mahajan P.V. (2009) *Food Eng. Rev.* 1:133 — plastic films for MAP.
7. Labuza T.P., Mizrahi S., Karel M. (1972) *Trans. ASAE* 15:150 — moisture-gain shelf-life model.
8. Ratkowsky D.A. et al. (1982) *J. Bacteriol.* 149:1 — square-root growth model.
9. Sivertsvik M., Jeksrud W.K., Rosnes J.T. (2002) *Int. J. Food Sci. Technol.* 37:107 — MAP of fish.
10. Navarro S. (2012) *J. Pest Sci.* 85:301 — hermetic storage of grain.
11. Siracusa V. (2012) *Int. J. Polym. Sci.* — food packaging permeability behaviour.
12. Hwang C.L., Yoon K. (1981) *Multiple Attribute Decision Making* — TOPSIS.
13. Poore J., Nemecek T. (2018) *Science* 360:987 — food environmental footprints.
14. FSSAI (2018) Food Safety and Standards (Packaging) Regulations; FSSAI (2020) Labelling & Display Regulations.
15. MoEFCC (2022) Plastic Waste Management (Amendment) Rules and EPR Guidelines for Plastic Packaging.
16. NABCONS (2022) Study to determine post-harvest losses of agri produce in India (MoFPI).
