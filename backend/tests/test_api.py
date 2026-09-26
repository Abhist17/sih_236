from fastapi.testclient import TestClient

from app.main import app


def test_full_flow():
    with TestClient(app) as c:
        assert c.get("/api/health").json()["status"] == "ok"
        assert len(c.get("/api/commodities").json()) > 90
        assert len(c.get("/api/materials").json()) > 30
        r = c.post("/api/recommend", json={"commodity_id": "mango", "net_weight_kg": 2, "transport": "sea_export"})
        assert r.status_code == 200
        rec = r.json()
        rid = rec["id"]
        assert rec["recommendations"] and rec["temperature_curve"]["series"]
        assert c.get(f"/api/recommendations/{rid}/report.pdf").content[:4] == b"%PDF"
        assert c.get(f"/api/recommendations/{rid}/verify").json()["verdict"] == "UNCERTIFIED"
        c.post(f"/api/recommendations/{rid}/certify")
        assert c.get(f"/api/recommendations/{rid}/verify").json()["verdict"] == "AUTHENTIC"
        fb = c.post(f"/api/recommendations/{rid}/feedback", json={"solution_id": rec["recommendations"][0]["id"], "rating": 5})
        assert fb.status_code == 200

        # traceability
        a = c.post("/api/chain/actors", json={"name": "FPO", "role": "farmer"}).json()
        h = {"X-Actor-Id": a["actor_id"], "X-Api-Key": a["api_key"]}
        assert c.post("/api/chain/batches", json={"rec_id": rid, "quantity": 10}, headers={**h, "X-Api-Key": "bad"}).status_code == 401
        b = c.post("/api/chain/batches", json={"rec_id": rid, "quantity": 10}, headers=h).json()
        e = c.post(f"/api/chain/batches/{b['id']}/events", json={"event": "in_transit", "temperature_c": 30, "duration_h": 12}, headers=h)
        assert e.status_code == 200
        v = c.get(f"/api/chain/verify/{b['id']}").json()
        assert v["verdict"] == "AUTHENTIC" and v["remaining_shelf_life"]["consumed_pct"] > 0
        assert c.get(f"/api/chain/batches/{b['id']}/qr.png").headers["content-type"] == "image/png"
        assert c.get(f"/api/chain/batches/{b['id']}/label.pdf").content[:4] == b"%PDF"
        assert c.get("/api/chain/validate").json()["valid"]

        # tools
        m = c.post("/api/tools/map-design", json={"respiration_rate": 15, "rr_temp": 1, "storage_temp": 1, "weight_kg": 0.25,
                                                   "o2_min": 5, "o2_max": 10, "co2_min": 15, "co2_max": 20}).json()
        assert m["options"] and m["transient"]
        s = c.post("/api/tools/compare", json={"scenario": {"commodity_id": "biscuit"}, "solution_ids": ["bopp", "bopp_metbopp"]}).json()
        assert len(s["items"]) == 2
        assert c.post("/api/recommend", json={}).status_code == 422
        assert c.get("/api/stats").status_code == 200
        assert c.get("/verify/anything").status_code == 200
