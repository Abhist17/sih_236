"""Sustainability scoring and end-of-life guidance (India context)."""
from __future__ import annotations

import math

RECYCLE_POINTS = {
    "widely": 40, "home compostable": 38, "limited": 24, "industrial compostable": 24, "not recyclable": 5,
}

END_OF_LIFE = {
    "widely": "Mechanically recyclable in existing Indian collection streams (kabadiwala / MRF).",
    "limited": "Technically recyclable (mono-polymer) but low collection value for flexibles; "
               "channel through EPR take-back / co-processing.",
    "not recyclable": "Multi-material — not mechanically recyclable; goes to cement-kiln co-processing, "
                      "waste-to-energy or road-laying under EPR.",
    "industrial compostable": "Compostable only in industrial composting (58 °C); must be CPCB-certified "
                              "and segregated as wet waste where facilities exist.",
    "home compostable": "Biodegrades in home/municipal compost; no plastic residue.",
}


def eco_score(sol: dict, cc: dict, weight_kg: float) -> dict:
    rec = sol.get("recycle", "not recyclable")
    pts_rec = RECYCLE_POINTS.get(rec, 5) + (5 if sol.get("reusable") else 0)
    x = max(cc["co2e_g_per_kg_food"], 1.0)
    pts_co2 = 35 * min(1.0, max(0.0, 1 - (math.log10(x) - 1) / 2.3))
    m = max(cc["pack_mass_g"] / weight_kg, 0.5)
    pts_mass = 15 * min(1.0, max(0.0, 1 - (math.log10(m) - 0.7) / 2))
    pts_bio = 10 if sol.get("bio_based") else 0
    score = min(100.0, pts_rec + pts_co2 + pts_mass + pts_bio)
    return dict(
        score=round(score, 1),
        breakdown=dict(recyclability=round(pts_rec, 1), carbon=round(pts_co2, 1), material_efficiency=round(pts_mass, 1),
                       bio_based=pts_bio),
        recyclability=rec, end_of_life=END_OF_LIFE.get(rec, ""), pwm_category=sol.get("pwm_cat"),
        resin_code=sol.get("resin_code"), bio_based=bool(sol.get("bio_based")), compostable=sol.get("compostable"),
        reusable=bool(sol.get("reusable")),
    )


def food_waste_note(food_co2e: float, weight_kg: float, pack_co2e_g: float) -> dict:
    food_g = food_co2e * weight_kg * 1000
    share = pack_co2e_g / (pack_co2e_g + food_g) * 100 if food_g else 0
    return dict(
        food_co2e_g=round(food_g, 0),
        packaging_share_pct=round(share, 1),
        message=(f"Packaging is ≈{share:.1f} % of the packed product's footprint; losing the food to spoilage "
                 f"wastes ≈{food_g/1000:.2f} kg CO2e per pack — adequate protection usually outweighs "
                 "packaging impact."),
    )
