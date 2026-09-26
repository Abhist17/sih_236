import math

import pytest

from app.data.commodities import COMMODITIES
from app.engine import physics as ph
from app.engine.recommender import analyse_solution, recommend, shelf_life_at


def top(inp):
    r = recommend(inp)
    assert r["recommendations"], r["rejected"]
    return r, r["recommendations"][0]


def test_psat_known_values():
    assert ph.p_sat(20) == pytest.approx(2339, rel=0.01)
    assert ph.p_sat(38) == pytest.approx(6630, rel=0.01)


def test_arrhenius_increases_with_temperature():
    assert ph.arrhenius(40, 23, 30) > 1 > ph.arrhenius(40, 23, 5)


def test_perforation_conductance_scales_with_area():
    small = ph.perforation_conductance("O2", 50, 30, 20)
    big = ph.perforation_conductance("O2", 200, 30, 20)
    assert big > 5 * small  # area ×16, effective path (L + r) longer


def test_map_equilibrium_mass_balance():
    rra, W, g_o2, g_co2 = 10.0, 1.0, 2000.0, 8000.0
    y_o2, y_co2, rr = ph.map_equilibrium(rra, W, g_o2, g_co2)
    assert g_o2 * (ph.O2_AIR - y_o2) == pytest.approx(rr * W * 24, rel=1e-3)
    assert 0 < y_o2 < ph.O2_AIR and y_co2 > 0


@pytest.mark.parametrize("c", COMMODITIES, ids=lambda c: c["id"])
def test_every_commodity_gets_a_recommendation(c):
    r = recommend({"commodity_id": c["id"]}, detail=False)
    assert r["recommendations"], f"no feasible package for {c['id']}"
    for x in r["recommendations"]:
        assert x["shelf_life"]["predicted_days"] > 0
        assert 0 <= x["scores"]["overall"] <= 100


def test_respiring_produce_gets_breathable_pack():
    r, t = top({"commodity_id": "broccoli", "net_weight_kg": 0.5})
    assert t["specs"]["map"]["technique"] in ("passive_map", "ventilated", "breathable")
    assert all(x["family"] not in ("foil_laminate", "retort_pouch", "rigid_glass_metal") for x in r["recommendations"])


def test_passive_map_lands_in_window():
    r, t = top({"commodity_id": "broccoli", "net_weight_kg": 0.5, "priority": "performance"})
    m = t["specs"]["map"]
    assert m.get("perforations", 0) >= 1
    assert 0.8 <= m["eq_o2"] <= 3.0


def test_oxygen_sensitive_snack_needs_barrier():
    r, t = top({"commodity_id": "potato_chips", "net_weight_kg": 0.05})
    assert r["requirements"]["otr_max_spec"] < 100
    assert t["specs"]["otr_spec"] <= r["requirements"]["otr_max_spec"] * 1.5
    assert t["specs"]["light_barrier_pct"] >= 90


def test_retort_requires_retortable():
    r, _ = top({"commodity_id": "rte_curry", "net_weight_kg": 0.3})
    assert all(x["specs"]["retortable"] for x in r["recommendations"])


def test_frozen_excludes_brittle_materials():
    r, _ = top({"commodity_id": "frozen_peas", "net_weight_kg": 1})
    assert all(x["specs"]["service_temp_c"][0] <= -18 for x in r["recommendations"])


def test_grain_long_storage_prefers_hermetic():
    r, t = top({"commodity_id": "rice", "net_weight_kg": 25, "desired_shelf_life_days": 365})
    assert t["id"] == "hermetic_grain"


def test_shelf_life_decreases_with_temperature():
    a = analyse_solution({"commodity_id": "paneer", "net_weight_kg": 0.2}, "pa_pe_vacuum", [2, 6, 10])
    d = [c["days"] for c in a["curve"]]
    assert d[0] > d[1] > d[2]


def test_thicker_film_for_heavier_pack():
    thin = analyse_solution({"commodity_id": "sugar", "net_weight_kg": 0.5}, "ldpe")["specs"]["total_thickness_um"]
    thick = analyse_solution({"commodity_id": "sugar", "net_weight_kg": 20}, "ldpe")["specs"]["total_thickness_um"]
    assert thick > thin


def test_custom_commodity_inference():
    r, t = top({"name": "Millet cookies", "moisture": 3, "fat": 22, "ph": 6.5, "aw": 0.25,
                "desired_shelf_life_days": 120, "net_weight_kg": 0.2})
    assert "moisture gain" in r["requirements"]["drivers"]


def test_constraints_respected():
    r = recommend({"commodity_id": "biscuit", "recyclable_only": True})
    assert all(x["sustainability"]["recyclability"] == "widely" for x in r["recommendations"])
    r = recommend({"commodity_id": "biscuit", "require_transparency": True})
    assert all(x["specs"]["transparency"] != "opaque" for x in r["recommendations"])


def test_temperature_abuse_consumes_life():
    inp = {"commodity_id": "chicken", "net_weight_kg": 0.5}
    cold = shelf_life_at(inp, "pa_pe_vacuum", [(2, 2)])
    warm = shelf_life_at(inp, "pa_pe_vacuum", [(25, 2)])
    assert warm["consumed_pct"] > 3 * cold["consumed_pct"]
