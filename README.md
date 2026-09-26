# PackAI — AI-Based Intelligent Food Packaging Recommendation System

> Smart India Hackathon problem statement: *AI-based intelligent food packaging material recommendation system for food commodities.*

PackAI is a decision-support platform. It recommends the **packaging material, structure and full specification** for any food commodity: OTR, WVTR, thickness, sealing, mechanical strength, MAP gas mix and micro-perforations. It also predicts the **shelf life** the package will deliver and scores each option on **cost and sustainability**, and it tracks every packed batch from farm to shelf on a **blockchain** with QR codes.

It is built for small food businesses, FPOs and farmers, start-ups and researchers who don't have in-house packaging experts.

---

## What it does (mapped to the problem statement)

| PS requirement | How PackAI delivers it |
|---|---|
| Inputs: commodity, moisture, fat, pH, respiration rate, shelf life, temperature, RH, transport, storage type | Full input form + REST API. 96 commodities auto-fill from the knowledge base. Any custom product can be entered by composition, and missing physiology is estimated. |
| AI-based recommendation engine + material database | Hybrid engine: a physics/food-science model ranks 38 packaging structures built from 20 base polymers. A **Random-Forest** model supplies an industry-practice prior. **TOPSIS** does the multi-criteria ranking. |
| Recommend LDPE, HDPE, PET, metallised, foil laminates, biodegradable, breathable films | All included, plus EVOH/AlOx high-barrier, retort, vacuum, aseptic, MAP trays, hermetic grain bags, jute and leno mesh, glass and tin. |
| OTR, WVTR, thickness, sealability, gas permeability, mechanical strength, MAP suitability | Every recommendation has a spec sheet: OTR and WVTR at standard and storage conditions, CO₂TR and β, gauge optimised per product, seal method/temperature/strength, tensile, elongation and puncture, light barrier, service temperature. |
| Fresh produce: respiration → breathable / micro-perforated film + MAP gas composition | Michaelis-Menten respiration + steady-state mass balance + **Fishman micro-perforation model**. It solves the hole count and diameter that land in Kader's O₂/CO₂ window, and simulates the in-pack atmosphere over time. |
| Barrier & permeability requirements | Derived from O₂ tolerance, the Labuza moisture model, MAP gas retention and drying/freezer-burn limits (see *Methodology*). |
| Packaging structures & thickness | Mono-film gauge chosen as the maximum of the mechanical, O₂-barrier and moisture-barrier needs. Laminate sealant layers are scaled to pack weight and transport abuse. |
| Shelf-life prediction | 10 mechanisms: senescence, weight loss, moisture gain, drying/freezer burn, oxidation, light, microbial (Ratkowsky), insects, intrinsic, frozen quality. Includes transit + storage time-temperature integration and a shelf-life-vs-temperature curve. |
| Sustainability analysis & eco alternatives | Eco score (recyclability, carbon per kg of food, material efficiency, bio-based), end-of-life guidance, EPR category (PWM Rules 2022), and "most sustainable / lowest cost / longest life" alternatives. |
| Cost optimisation | ₹ per pack, per 1000 and per kg of product (material + conversion + add-ons), down-gauging, and a budget constraint. |
| QR-based traceability | **PackChain**: Ed25519-signed, Merkle-tree, proof-of-work ledger. Batch QR labels, custody and temperature events, material certificates, public verification, **dynamic remaining shelf life** from logged temperatures, and an optional Solidity anchor on Polygon. |
| Web / mobile app | Responsive web app, installable as a **PWA** on Android/iOS, with English and Hindi UI, dark mode and printable PDF reports and labels. |

---

## Quick start

```bash
./run.sh --seed        # creates .venv, installs, trains the ML model if missing, seeds demo data, serves on :8000
```

Open <http://localhost:8000>. Interactive API docs are at <http://localhost:8000/docs>.

Manual setup:

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cd backend
../.venv/bin/python -m app.ml.train          # ~2 min: generates the corpus and trains the models (already shipped in data/models)
../.venv/bin/python -m scripts.seed_demo     # optional demo data
../.venv/bin/uvicorn app.main:app --reload
```

Docker:

```bash
docker compose up --build
```

Tests (115: physics, every commodity end to end, blockchain tamper detection, full API flow):

```bash
cd backend && ../.venv/bin/python -m pytest -q
```

> **Scanning QR codes from a phone:** set `PACKAI_PUBLIC_URL=http://<your-LAN-IP>:8000` in `.env` so the QR codes point at a reachable address.

---

## Architecture

```
┌──────────────────────────── Frontend (PWA, vanilla ES modules + Chart.js) ────────────────────────────┐
│ Dashboard · Recommend → Result · MAP designer · Shelf-life simulator · Materials · Commodities        │
│ Batches & QR · Ledger explorer · Public verify · AI model · History · Methodology   (EN / हिन्दी)      │
└───────────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                                │ REST/JSON (FastAPI, OpenAPI docs)
┌───────────────────────────────────────────────┴────────────────────────────────────────────────────────┐
│ Recommendation engine (backend/app/engine)                                                               │
│  profile.py      commodity + conditions → normalised profile (custom-commodity inference)               │
│  evaluate.py     requirements · compatibility rules · gauge optimisation · passive-MAP & perforation    │
│                  design · 10 shelf-life mechanisms · cost & carbon                                       │
│  recommender.py  ML prior + TOPSIS ranking · explanations · alternatives · secondary pack · guidance     │
│  sustainability.py / compliance.py (FSSAI, BIS, PWM-EPR, Legal Metrology, JPM Act)                      │
│ Knowledge base (backend/app/data)   96 commodities · 20 base polymers · 38 packaging structures          │
│ ML (backend/app/ml)   RandomForest classifier + 3 surrogate regressors + kNN similarity; feedback loop    │
│ PackChain (backend/app/blockchain)  Ed25519 · SHA-256 Merkle · PoW blocks · proofs · EVM anchor client   │
│ Reports (backend/app/reports)       PDF report with verification QR · 100×150 mm batch label            │
│ SQLite (SQLAlchemy) — recommendations, feedback, actors, blocks, tx index, batches                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
            optional ──► blockchain/contracts/PackChainAnchor.sol on Polygon Amoy (web3)
```

### Why a *hybrid* AI?

Pure ML would need thousands of measured packaging–shelf-life outcomes, and no such public dataset exists. Pure rules can't generalise to what the market actually does. So PackAI:

1. **Guarantees physics**: every recommendation satisfies barrier, mechanical, thermal and regulatory constraints, and comes with a mechanistic shelf-life prediction you can trace back to formulas.
2. **Learns practice**: a Random Forest trained on a knowledge-distilled corpus of about 4,800 Monte-Carlo scenarios predicts which packaging family the industry would use. Labels come from curated Indian industry practice, filtered by physics feasibility.
   - Hold-out accuracy is about 80% (top-3: 100%).
   - On **unseen commodities**, top-3 accuracy is 87%.
   - Field feedback and uploaded lab CSVs are added at 3× weight on retraining.
3. **Balances objectives** with TOPSIS, using user-selected weights: balanced, performance, cost or eco.

### Blockchain — where it's actually needed

Blockchain is used only where trust between parties matters:

- **Batch provenance.** Each packed batch's specification hash is bound on-chain to its recommendation, so a buyer can prove the pack matches the approved design.
- **Multi-party custody log.** Farmer, packer, transporter, cold store, retailer, lab and regulator each sign their own events with an Ed25519 key. No single party can rewrite history.
- **Cold-chain accountability.** Logged temperature excursions recompute the remaining shelf life (Σ Δt / L(T)), which the consumer sees on scanning the QR.
- **Packaging-supplier certificates.** Measured OTR/WVTR and migration test results are checked automatically against the batch spec (conformity flag).
- **Report integrity.** Recommendation reports are hashed and certified, so anyone can verify a PDF wasn't altered.
- **Public anchoring (optional).** `PackChainAnchor.sol`, compiled with solc 0.8.24, commits block hashes to Polygon for trust beyond the platform operator. Deploy it with `blockchain/deploy.py`.

Keys are custodial (encrypted with Fernet on the server), so farmers need no wallet.

---

## Key API endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/recommend` | Full recommendation (all PS inputs; see `RecommendInput` in `/docs`) |
| GET | `/api/recommendations/{id}` · `/report.pdf` · `/verify` | Stored result, PDF report, integrity check |
| POST | `/api/recommendations/{id}/certify` · `/feedback` | Certify on PackChain; field feedback → ML |
| POST | `/api/tools/map-design` | Stand-alone passive-MAP / micro-perforation designer |
| POST | `/api/tools/shelf-life` · `/api/tools/compare` | Shelf-life simulator across temperatures |
| GET | `/api/commodities`, `/api/materials`, `/api/base-polymers` | Knowledge base |
| POST | `/api/chain/actors` · `/batches` · `/batches/{id}/events` · `/material-certificates` | Traceability (headers `X-Actor-Id`, `X-Api-Key`) |
| GET | `/api/chain/verify/{batch}` · `/batches/{id}/qr.png` · `/label.pdf` | Public verification, QR, label |
| GET | `/api/chain/blocks` · `/validate` · `/tx/{id}` | Ledger explorer, full validation, Merkle proof |
| GET/POST | `/api/ml/info` · `/retrain` · `/upload` · `/template.csv` | Model card, retraining, dataset upload |

Example:

```bash
curl -X POST localhost:8000/api/recommend -H 'content-type: application/json' -d '{
  "commodity_id": "mango", "net_weight_kg": 2, "storage_temp": 12, "rh": 90,
  "desired_shelf_life_days": 21, "transport": "sea_export", "priority": "balanced"}'
```

---

## Project structure

```
backend/app/
  data/          commodities.py (96 commodities + industry practice) · materials.py (polymers, laminates, rigid)
  engine/        physics.py · profile.py · evaluate.py · recommender.py · sustainability.py · compliance.py
  ml/            model.py (dataset generation, training, validation, inference) · service.py · train.py
  blockchain/    ledger.py (PackChain) · anchor.py (EVM)
  routers/       catalog · recommend · tools · ml · chain · stats
  reports/       pdf.py (report + QR label)
backend/tests/   test_engine.py · test_blockchain.py · test_api.py
backend/scripts/ seed_demo.py
frontend/        index.html · css/ · js/ (app, api, ui, i18n, pages/*) · sw.js · manifest · vendor/chart.js
blockchain/      contracts/PackChainAnchor.sol · build/ (ABI + bytecode) · deploy.py
data/models/     trained model + training corpus
docs/            RESEARCH.md (domain research, models, validation, roadmap) · DEMO.md (pitch walkthrough)
```

## Limitations (stated honestly)

- Material and commodity parameters are indicative literature values. Validate them with converter certificates and accelerated/real-time shelf-life studies before launch.
- The ML labels are expert-distilled rather than measured outcomes. The feedback and upload loop exists so real data can progressively replace them.
- The shelf-life model is mechanistic and calibrated to commercial references. It is decision support, not a substitute for challenge testing.

See **docs/RESEARCH.md** for the full scientific background and references.
