"""
Populate a demo database: recommendations for representative commodities, PackChain actors,
certified reports, packed batches with realistic custody/temperature events and a material certificate.

    cd backend && python -m scripts.seed_demo
"""
from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.main import app

SCENARIOS = [
    dict(commodity_id="broccoli", net_weight_kg=0.5, desired_shelf_life_days=14),
    dict(commodity_id="mango", net_weight_kg=2, transport="sea_export", desired_shelf_life_days=21),
    dict(commodity_id="tomato", net_weight_kg=1),
    dict(commodity_id="potato_chips", net_weight_kg=0.05),
    dict(commodity_id="paneer", net_weight_kg=0.2),
    dict(commodity_id="rice", net_weight_kg=25, desired_shelf_life_days=365),
    dict(commodity_id="milk", net_weight_kg=0.5),
    dict(commodity_id="coffee", net_weight_kg=0.25),
    dict(commodity_id="chicken", net_weight_kg=0.5),
    dict(commodity_id="rte_curry", net_weight_kg=0.3),
    dict(commodity_id="biscuit", net_weight_kg=0.1, priority="eco"),
    dict(name="Ragi millet cookies", category="biscuit", moisture=3.5, fat=18, protein=8, ph=6.6, aw=0.3,
         desired_shelf_life_days=150, net_weight_kg=0.2),
]


def main():
    with TestClient(app) as c:
        if c.get("/api/recommendations?limit=1").json():
            print("database already has data — skipping demo seed")
            return
        recs = {}
        for s in SCENARIOS:
            r = c.post("/api/recommend", json=s).json()
            recs[s.get("commodity_id") or s["name"]] = r["id"]
            print(f"recommendation {r['id']}: {r['profile']['name']:<32} → {r['recommendations'][0]['name']}")
        for k in ("broccoli", "mango", "paneer", "rice"):
            c.post(f"/api/recommendations/{recs[k]}/certify")

        def actor(name, role, org, loc):
            a = c.post("/api/chain/actors", json=dict(name=name, role=role, org=org, location=loc)).json()
            return {"X-Actor-Id": a["actor_id"], "X-Api-Key": a["api_key"]}

        packer = actor("Sahyadri Farms Packhouse", "packer", "Sahyadri Farmers Producer Co.", "Nashik, Maharashtra")
        farmer = actor("Ramesh Patil", "farmer", "Dindori FPO", "Dindori, Nashik")
        dairy = actor("Warana Dairy", "processor", "Warana Co-op", "Kolhapur, Maharashtra")
        trans = actor("ColdLink Logistics", "transporter", "ColdLink Pvt Ltd", "Pune")
        store = actor("FreshMart Andheri", "retailer", "FreshMart", "Mumbai")
        supplier = actor("Uflex Films", "packaging_supplier", "Uflex Ltd", "Noida, UP")
        lab = actor("NABL Food Lab", "lab", "IIP Mumbai test lab", "Mumbai")

        d0 = (date.today() - timedelta(days=2)).isoformat()
        b1 = c.post("/api/chain/batches", json=dict(rec_id=recs["broccoli"], quantity=600, unit="packs", origin="Dindori, Nashik",
                                                      pack_date=d0), headers=packer).json()
        for ev in [dict(event="dispatched", location="Nashik packhouse", temperature_c=2, duration_h=1),
                   dict(event="in_transit", location="Nashik → Mumbai (reefer)", temperature_c=3, duration_h=5),
                   dict(event="temperature_log", location="Thane toll plaza", temperature_c=15, duration_h=2,
                        notes="reefer unit restart"),
                   dict(event="received", location="FreshMart DC, Bhiwandi", temperature_c=2, duration_h=12)]:
            c.post(f"/api/chain/batches/{b1['id']}/events", json=ev, headers=trans if ev["event"] != "received" else store)
        c.post("/api/chain/material-certificates", json=dict(material_id=b1["solution_id"], supplier_lot="UF-LL30-2609",
               measured_otr=5600, thickness_um=30, migration_test_pass=True, certificate_ref="IS9845/2026/118",
               batch_id=b1["id"]), headers=supplier)
        c.post(f"/api/chain/batches/{b1['id']}/events", json=dict(event="quality_check", location="FreshMart DC",
               notes="colour & firmness OK", quality={"yellowing": "none", "O2_%": 2.4, "CO2_%": 8.1}), headers=lab)

        b2 = c.post("/api/chain/batches", json=dict(rec_id=recs["paneer"], quantity=2000, unit="packs",
                                                      origin="Warana, Kolhapur"), headers=dairy).json()
        c.post(f"/api/chain/batches/{b2['id']}/events", json=dict(event="dispatched", location="Warana plant",
               temperature_c=4, duration_h=10), headers=trans)

        b3 = c.post("/api/chain/batches", json=dict(rec_id=recs["mango"], quantity=300, unit="cartons",
                                                      origin="Ratnagiri, Maharashtra"), headers=farmer).json()
        c.post(f"/api/chain/batches/{b3['id']}/events", json=dict(event="dispatched", location="JNPT port",
               temperature_c=12, duration_h=24), headers=trans)
        print("batches:", b1["id"], b2["id"], b3["id"])
        print("chain valid:", c.get("/api/chain/validate").json()["valid"])


if __name__ == "__main__":
    main()
