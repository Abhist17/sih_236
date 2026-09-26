"""
Hybrid recommendation engine
  1. Knowledge-based requirement derivation (physics + food science)       -> requirements()
  2. Candidate generation & hard-constraint filtering                        -> compatibility()
  3. Per-candidate optimisation (thickness, perforations, MAP technique)    -> choose_structure()/design_map()
  4. Mechanistic shelf-life prediction & scoring                             -> total_shelf_life()
  5. ML prior (Random-Forest trained on expert-generated + field data)        -> ml_scorer
  6. Multi-criteria ranking with TOPSIS (technical, ML, sustainability, cost)
"""
from __future__ import annotations

import math
import time
from typing import Callable

import numpy as np

from ..data.materials import BASE, MATERIAL_FAMILIES
from . import physics as ph
from .compliance import checklist
from .evaluate import (MECH_LABELS, SOLUTIONS, Candidate, addons, barrier, choose_structure, choose_technique,
                       compatibility, cost_carbon, design_map, mechanisms, requirements, total_shelf_life,
                       _conductances)
from .profile import Profile, build_profile, mech_thickness_ldpe_eq, rr_air_at
from .sustainability import eco_score, food_waste_note

ENGINE_VERSION = "1.0.0"

PRIORITY_WEIGHTS = {
    "balanced": dict(tech=0.40, ml=0.15, eco=0.20, cost=0.25),
    "performance": dict(tech=0.60, ml=0.15, eco=0.10, cost=0.15),
    "cost": dict(tech=0.30, ml=0.10, eco=0.10, cost=0.50),
    "eco": dict(tech=0.30, ml=0.10, eco=0.45, cost=0.15),
}


# --------------------------------------------------------------------------- helpers
def _barrier_class_otr(v):
    if v is None:
        return "not critical"
    return ("ultra-high barrier" if v <= 1 else "high barrier" if v <= 10 else "medium barrier" if v <= 100
            else "low barrier" if v <= 1000 else "non-barrier / breathable")


def _barrier_class_wvtr(v):
    if v is None:
        return "not critical"
    return ("high barrier" if v <= 0.5 else "medium barrier" if v <= 5 else "low barrier" if v <= 20
            else "breathable")


def technical_score(ratio: float, warnings: list) -> float:
    if ratio >= 1:
        s = 100.0
        if ratio > 2.5:   # over-packaging: extra barrier/material the product does not need
            s -= min(35.0, 20 * math.log2(ratio / 2.5))
    else:
        s = 100 * ratio ** 1.3 * 0.85
    for level, _ in warnings:
        s -= 8 if level == "major" else 3
    return max(0.0, min(100.0, s))


def topsis(matrix: np.ndarray, weights: np.ndarray, benefit: np.ndarray) -> np.ndarray:
    norm = np.sqrt((matrix ** 2).sum(axis=0))
    norm[norm == 0] = 1
    v = matrix / norm * weights
    ideal = np.where(benefit, v.max(axis=0), v.min(axis=0))
    anti = np.where(benefit, v.min(axis=0), v.max(axis=0))
    d_pos = np.sqrt(((v - ideal) ** 2).sum(axis=1))
    d_neg = np.sqrt(((v - anti) ** 2).sum(axis=1))
    return d_neg / np.maximum(d_pos + d_neg, 1e-12)


def _seal_spec(p: Profile, c: Candidate) -> dict:
    sol = c.sol
    sid = sol["id"]
    fixed = {
        "glass_jar": "Lug / CT cap with food-grade liner; vacuum-capped for hot-fill",
        "tin_can": "Double seam (verify seam overlap ≥ 45 %)",
        "pet_bottle": "Induction-sealed Al liner under screw cap",
        "hdpe_bottle": "Induction-sealed Al liner under screw cap",
        "pp_tub": "Heat-sealed peelable Al/PET lid (180-200 °C) + snap-on over-cap",
        "pp_evoh_tray": "Top-seal barrier lidding film, 160-190 °C, with MAP gas flush",
        "aseptic_carton": "Induction / ultrasonic transverse seal (aseptic filler)",
        "rpet_clamshell": "Snap-lock hinge; tamper-evident label",
        "molded_pulp_tray": "Stretch/cling overwrap or sleeve",
        "pp_leno": "Drawstring / clip closure",
        "jute_bag": "Machine stitched (bag closer)",
        "pp_woven_liner": "Liner heat-sealed, sack machine stitched",
    }
    if sid in fixed:
        return dict(method=fixed[sid], temp_range=None, min_strength_n_15mm=None, heat_sealable=False)
    seal = sol.get("seal")
    strength = 35 if p.process == "retort" else 25 if p.is_liquid or p.weight_kg > 5 else 15 if p.weight_kg > 1 else 10
    method = "Heat seal (jaw/band)" if seal else "Adhesive / cold seal"
    if p.state == "powder":
        method += "; ultrasonic sealing recommended to seal through powder contamination"
    if c.technique in ("vacuum", "active_map", "n2_flush"):
        method += "; chamber / flow-wrap with gas flush"
    return dict(method=method, temp_range=list(seal) if seal else None, min_strength_n_15mm=strength,
                heat_sealable=bool(seal), dwell_s="0.3-1.0", test="ASTM F88 (seal strength), ASTM F2096 (leak)")


def _pack_dims(area_m2: float, kind: str) -> str:
    if kind in ("mono", "laminate"):
        side = area_m2 / 2
        w = math.sqrt(side / 1.4)
        return f"≈ {w*100:.0f} × {w*140:.0f} cm flat pouch (each side)"
    return f"≈ {area_m2*1e4:.0f} cm² container surface"


# --------------------------------------------------------------------------- evaluation
def evaluate_all(p: Profile, req: dict) -> tuple[list[dict], list[dict]]:
    ok, rejected = [], []
    for sol in SOLUTIONS:
        if not sol.get("standalone", True) and sol["kind"] == "mono":
            continue
        hard = compatibility(p, sol)
        if hard:
            rejected.append(dict(id=sol["id"], name=sol.get("name"), reasons=hard))
            continue
        c, h2 = choose_structure(p, sol, req)
        if p.is_produce:
            h2 += design_map(p, c)
        if h2:
            rejected.append(dict(id=sol["id"], name=sol.get("name"), reasons=h2))
            continue
        bar_T = barrier(c, p.temp, p.rh, p.aw)
        choose_technique(p, c, bar_T)
        sl = total_shelf_life(p, c)
        ads = addons(p, c)
        cc = cost_carbon(p, c, ads)
        if p.max_cost and cc["per_pack_inr"] > p.max_cost:
            rejected.append(dict(id=sol["id"], name=sol.get("name"),
                                 reasons=[f"Cost ₹{cc['per_pack_inr']:.2f}/pack exceeds budget ₹{p.max_cost:g}"]))
            continue
        ok.append(dict(c=c, bar_T=bar_T, sl=sl, addons=ads, cost=cc))
    return ok, rejected


def _warnings(p: Profile, c: Candidate, sl: dict, bar_T: dict) -> list[tuple]:
    w = []
    sol = c.sol
    ratio = sl["total"] / p.desired_days
    if sl["spoiled_in_transit"]:
        w.append(("major", "Product is expected to spoil during transport at the given conditions."))
    elif sl["transit_consumed"] > 0.4:
        w.append(("minor", f"Transport consumes {sl['transit_consumed']*100:.0f} % of shelf life — improve cold chain."))
    if p.light >= 0.5 and sol.get("light_block", 0) < 0.5 and p.retail_light:
        w.append(("major", "Light-sensitive product in a transparent pack — use opaque/metallised film or UV-blocking print."))
    if p.sharp and sol["kind"] in ("mono", "laminate") and sol.get("puncture", 5) < 4:
        w.append(("major", "Bones/edges may puncture this film — use PA-based structure or bone guard."))
    if p.fragile and c.technique == "vacuum":
        w.append(("major", "Vacuum will crush this fragile product — use gas flush instead."))
    if sol["kind"] == "laminate":
        exposed = [b for b, _ in c.layers if BASE[b]["humid_k"] and b not in sol.get("buried", [])]
        if exposed and max(p.rh, p.aw) > 0.75:
            w.append(("minor", f"{', '.join(BASE[b]['short'] for b in exposed)} barrier loses performance at high humidity."))
    if p.is_produce and c.map_info:
        mi = c.map_info
        if p.o2_win and not mi.get("in_window", True):
            w.append(("minor", mi.get("note") or "Equilibrium atmosphere is outside the recommended MAP window."))
        if p.rh_opt < 0.8 and not c.is_open and not c.n_perf:
            w.append(("major", "Sealed film traps humidity — risk of sprouting/rot for this commodity; use ventilated packaging."))
        if not c.is_open:
            w.append(("minor", "Keep cold chain: warm exposure raises respiration and may create anaerobic conditions."))
    if p.chill is not None and p.temp < p.chill:
        w.append(("major", f"Storage below chilling threshold ({p.chill} °C) causes chilling injury."))
    if p.transport == "air_export" and sol["kind"] in ("mono", "laminate") and p.headspace_ml > 200:
        w.append(("minor", "Air freight pressure drop can balloon/burst pouches — reduce headspace or use vented design."))
    if p.transport == "sea_export" and sol["family"] == "paper_based":
        w.append(("major", "Paper loses strength in humid sea containers."))
    if sol["family"] == "paper_based" and max(p.rh, p.transit_rh) > 0.85:
        w.append(("major", "Paper loses wet strength at high humidity."))
    if ratio > 4 and sol["kind"] != "rigid":
        w.append(("minor", "Over-engineered for the target shelf life — consider down-gauging or a simpler structure."))
    if sol.get("recycle") == "not recyclable":
        w.append(("minor", "Multi-material structure is not mechanically recyclable (EPR Category III/II)."))
    if sol.get("compostable") == "industrial":
        w.append(("minor", "Needs industrial composting — limited facilities in many Indian cities."))
    if sol["id"] == "tin_can" and p.ph < 4.6:
        w.append(("minor", "Acidic product: specify acid-resistant internal lacquer."))
    if p.storage == "frozen" and not p.cold_chain:
        w.append(("major", "Frozen product without cold chain will thaw in transit."))
    return w


def _reasons(p: Profile, c: Candidate, sl: dict, bar_T: dict, req: dict, eco: dict) -> list[str]:
    r = []
    ratio = sl["total"] / p.desired_days
    lim = MECH_LABELS.get(sl["limiting"], sl["limiting"])
    if ratio >= 1:
        r.append(f"Predicted shelf life {sl['total']:.0f} days meets the {p.desired_days:.0f}-day target "
                 f"(limiting factor: {lim.lower()}).")
    else:
        r.append(f"Predicted shelf life {sl['total']:.0f} days is {ratio*100:.0f} % of the target "
                 f"(limited by {lim.lower()}).")
    if req.get("otr_max_T") and bar_T.get("otr") is not None:
        r.append(f"OTR at {p.temp:g} °C = {bar_T['otr']:.2f} vs required ≤ {req['otr_max_T']:.2f} cc/m²·day·atm.")
    if req.get("wvtr_K_max_T") and bar_T.get("K") is not None:
        wv = bar_T["K"] * ph.p_sat(p.temp) * 0.9
        rq = req["wvtr_K_max_T"] * ph.p_sat(p.temp) * 0.9
        r.append(f"WVTR at {p.temp:g} °C/90 % RH ≈ {wv:.2f} vs required ≤ {rq:.2f} g/m²·day.")
    if c.map_info.get("mode") == "passive_map":
        mi = c.map_info
        extra = f" using {mi['perforations']} micro-perforations of {mi['perf_diameter_um']:.0f} µm" if mi.get("perforations") else ""
        r.append(f"Passive MAP equilibrium ≈ {mi['eq_o2']:.1f} % O2 / {mi['eq_co2']:.1f} % CO2{extra} "
                 f"(target {p.o2_win[0]}-{p.o2_win[1]} % O2, {p.co2_win[0]}-{p.co2_win[1]} % CO2).")
    if c.technique == "active_map":
        r.append("Barrier retains the flushed MAP gas for the full shelf life "
                 f"({', '.join(f'{k} {v}%' for k, v in c.gas.items())}).")
    if c.technique == "vacuum":
        r.append("Vacuum packing removes headspace O2 and suppresses aerobic spoilage.")
    if c.technique == "n2_flush":
        r.append("Nitrogen flushing lowers headspace O2 so the film only needs to limit O2 ingress.")
    if c.map_info.get("thickness_driver"):
        r.append(f"Film gauge {c.thickness:g} µm set by the {c.map_info['thickness_driver']} requirement.")
    if p.light >= 0.5 and c.sol.get("light_block", 0) >= 0.9:
        r.append(f"Blocks ≈{c.sol['light_block']*100:.0f} % of light — protects the light-sensitive product.")
    if eco["recyclability"] == "widely":
        r.append("Mono-material, widely recyclable.")
    elif eco["compostable"]:
        r.append(f"{eco['compostable'].title()}-compostable, bio-based material.")
    return r


def _specs(p: Profile, c: Candidate, bar_T: dict, cc: dict) -> dict:
    sol = c.sol
    wv_T = bar_T["K"] * ph.p_sat(p.temp) * 0.9 if bar_T.get("K") is not None else None
    tensile = BASE[sol["base"]]["tensile"] if sol["kind"] == "mono" else sol.get("tensile")
    elong = BASE[sol["base"]]["elongation"] if sol["kind"] == "mono" else sol.get("elongation")
    punct = {1: "poor", 2: "fair", 3: "good", 4: "very good", 5: "excellent"}.get(int(min(5, sol.get("puncture", 3))))
    if sol["kind"] == "mono":
        structure = f"{BASE[sol['base']]['short']} {c.thickness:g} µm mono-layer"
    elif sol["kind"] == "laminate":
        structure = " / ".join(f"{BASE[b]['short']} {um:g} µm" for b, um in c.layers)
    else:
        structure = sol["structure"]
    if c.n_perf:
        structure += f" + {c.n_perf} × {c.perf_d:g} µm laser micro-perforations" if c.perf_d < 1000 else \
            f" + {c.n_perf} × {c.perf_d/1000:g} mm vent holes"
    map_suit = c.technique in ("passive_map", "active_map") or bool(sol.get("map_ok"))
    return dict(
        structure=structure,
        total_thickness_um=c.total_um,
        grammage_gsm=cc["grammage_gsm"],
        otr_spec=None if bar_T.get("otr") is None else round(bar_T["otr_std"], 3),
        otr_at_storage=None if bar_T.get("otr") is None else round(bar_T["otr"], 3),
        otr_class=_barrier_class_otr(bar_T.get("otr_std")),
        wvtr_spec=None if bar_T.get("wvtr_std") is None else round(bar_T["wvtr_std"], 3),
        wvtr_at_storage=None if wv_T is None else round(wv_T, 3),
        wvtr_class=_barrier_class_wvtr(bar_T.get("wvtr_std")),
        co2tr_spec=None if bar_T.get("co2tr_std") is None else round(bar_T["co2tr_std"], 2),
        beta_co2_o2=None if bar_T.get("beta") is None else round(bar_T["beta"], 2),
        gas_permeability_note="Open/ventilated — free gas exchange" if c.is_open else None,
        tensile_mpa=None if tensile is None else round(tensile, 0),
        elongation_pct=elong,
        puncture_resistance=punct,
        seal=_seal_spec(p, c),
        map=dict(suitable=map_suit, technique=c.technique, gas=c.gas, **{k: v for k, v in c.map_info.items()
                                                                         if k != "thickness_driver"}),
        light_barrier_pct=round(sol.get("light_block", 0) * 100),
        transparency=sol.get("transparency"),
        grease_resistance=int(sol.get("grease", 3)),
        service_temp_c=[sol.get("tmin"), sol.get("tmax")],
        microwavable=bool(sol.get("microwave")),
        retortable=bool(sol.get("retort")),
        formats=sol.get("formats", []),
        pack_dimensions=_pack_dims(p.area_m2, sol["kind"]),
        area_m2=round(p.area_m2, 4),
        headspace_ml=round(c.headspace_ml, 0),
    )


# --------------------------------------------------------------------------- guidance
def secondary_packaging(p: Profile) -> list[dict]:
    ply = "3-ply" if p.severity < 1 else "5-ply" if p.severity < 1.2 else "7-ply"
    out = []
    if p.is_produce:
        out.append(dict(item="Ventilated corrugated fibreboard (CFB) box", detail=f"{ply}, 3-5 % vent area aligned for "
                         "forced-air pre-cooling; wax/PE-coated liner for high-RH cold rooms (IS 2771)."))
        out.append(dict(item="Returnable HDPE/PP crates", detail="For farm-to-mandi handling; reduces bruising losses "
                         "vs gunny bags; line with cushioning for soft fruit."))
        out.append(dict(item="Pre-cooling", detail="Forced-air or hydro-cooling to storage temperature within 4-6 h of harvest."))
        if p.fragile:
            out.append(dict(item="Single-layer trays / cell pads", detail="Avoid compression of soft fruit."))
    elif p.storage in ("chilled", "frozen"):
        out.append(dict(item="Insulated shipper (EPS/PUF box) + gel/eutectic packs",
                         detail=f"Maintain ≤ {p.temp + 2:g} °C during last-mile; data logger per shipment."))
        out.append(dict(item=f"{ply} moisture-resistant CFB master carton", detail="Wet-strength board for cold rooms."))
    elif p.weight_kg >= 10:
        out.append(dict(item="Palletised stacking + stretch wrap", detail="Max 8-10 bags high; use pallets/dunnage off floor."))
    else:
        out.append(dict(item=f"{ply} CFB shipper", detail="Size for 6-24 retail units; compression strength per stacking height."))
    if p.is_liquid:
        out.append(dict(item="Partitions / shrink trays", detail="Prevent bottle/pouch contact damage and leakage spread."))
    if p.transport == "sea_export":
        out.append(dict(item="Container desiccant strips + reefer/ventilation", detail="Prevents 'container rain' condensation."))
    if p.transport in ("long_road", "rail", "sea_export"):
        out.append(dict(item="Temperature & humidity data logger / IoT tag", detail="Feeds the blockchain trace record."))
    return out


def storage_guidance(p: Profile) -> list[str]:
    g = [f"Store at {p.t_opt:g} °C and {p.rh_opt*100:.0f} % RH (optimum for {p.name})." if p.is_produce
         else f"Store at {p.temp:g} °C, {p.rh*100:.0f} % RH as planned; follow FEFO (first-expired, first-out)."]
    if p.chill is not None:
        g.append(f"Do not store below {p.chill:g} °C — chilling injury.")
    if p.is_produce and p.eth in ("high", "very high"):
        g.append("High ethylene producer: keep away from ethylene-sensitive produce (leafy greens, cucumbers, carrots).")
    if p.is_produce and p.eth_sens:
        g.append("Ethylene-sensitive: do not co-store with ripening bananas, mangoes, apples or tomatoes.")
    if p.insect:
        g.append("Fumigant-free insect control: hermetic storage or clean, dry, fumigated godowns; inspect monthly.")
    if p.light >= 0.5:
        g.append("Avoid direct sunlight / high-intensity retail lighting.")
    if p.is_dry:
        g.append("Keep off the floor on pallets; avoid humid areas — moisture ingress is the main failure mode.")
    if p.storage == "frozen":
        g.append("Hold at ≤ −18 °C with minimal temperature fluctuation to prevent ice recrystallisation and freezer burn.")
    if p.degassing:
        g.append("Allow degassing (valve) — product releases CO2 after packing.")
    return g


def temperature_curve(p: Profile, cands: list[dict]) -> dict:
    if p.is_frozen:
        temps = [-30, -25, -20, -18, -15, -12, -10, -7]
    elif p.is_produce:
        temps = [0, 2, 5, 8, 10, 12, 15, 20, 25, 30]
    elif p.storage == "chilled":
        temps = [0, 2, 4, 6, 8, 10, 12, 15, 20, 25]
    else:
        temps = [10, 15, 20, 25, 30, 35, 40, 45]
    series = []
    for e in cands:
        c = e["c"]
        pts = [round(min(mechanisms(p, c, t, p.rh, light_exposed=p.retail_light).values()), 1) for t in temps]
        series.append(dict(id=c.sol["id"], name=e["name"], days=pts))
    return dict(temps=temps, series=series)


def map_simulation(p: Profile, e: dict) -> dict | None:
    c = e["c"]
    if not p.is_produce or c.is_open:
        return None
    bar = barrier(c, p.temp, 0.97, 0.98)
    g_o2, g_co2 = _conductances(p, c, bar, p.temp)
    free = p.headspace_ml + p.weight_kg * 1000 / p.density * 0.3
    days = min(10.0, max(3.0, p.desired_days))
    curve = ph.map_transient(rr_air_at(p, p.temp), p.weight_kg, g_o2, g_co2, free, days=days)
    return dict(candidate=c.sol["id"], name=e["name"], curve=curve, target_o2=p.o2_win, target_co2=p.co2_win)


def display_name(c: Candidate) -> str:
    sol = c.sol
    mono_names = {"kraft": "Kraft paper bag", "pla": "PLA film (compostable)", "pbat_pla": "Compostable PBAT/PLA film",
                  "cellulose": "Cellulose film (compostable)"}
    base = sol.get("name") if sol["kind"] != "mono" else mono_names.get(sol["id"], f"{BASE[sol['base']]['short']} film")
    if c.n_perf:
        base = ("Micro-perforated " if c.perf_d < 1000 else "Vented ") + base
    return base


# --------------------------------------------------------------------------- main API
def recommend(inp: dict, ml_scorer: Callable | None = None, top_n: int = 5, detail: bool = True) -> dict:
    t0 = time.time()
    p = build_profile(inp)
    req = requirements(p)
    ok, rejected = evaluate_all(p, req)

    for e in ok:
        c = e["c"]
        e["family"] = "breathable_perforated" if (c.n_perf and p.o2_win) else c.sol["family"]
        e["name"] = display_name(c)
        e["eco"] = eco_score(c.sol, e["cost"], p.weight_kg)
        e["warnings"] = _warnings(p, c, e["sl"], e["bar_T"])
        e["ratio"] = e["sl"]["total"] / p.desired_days
        e["tech"] = technical_score(e["ratio"], e["warnings"])

    ml_out = None
    if ml_scorer is not None and ok:
        try:
            ml_out = ml_scorer(p)
        except Exception as ex:  # ML must never break the core recommendation
            ml_out = {"error": str(ex)}
    if ml_out and not ml_out.get("error"):
        # surrogate regressors are only meaningful where the physics defines that requirement
        if req.get("otr_max_T") is None:
            ml_out.pop("predicted_otr_max_spec", None)
        if req.get("wvtr_K_max_T") is None:
            ml_out.pop("predicted_wvtr_max_spec", None)
    probs = (ml_out or {}).get("family_proba") or {}
    pmax = max(probs.values()) if probs else 0
    for e in ok:
        e["ml"] = (probs.get(e["family"], 0) / pmax * 100) if pmax else 50.0

    weights = PRIORITY_WEIGHTS.get(inp.get("priority") or "balanced", PRIORITY_WEIGHTS["balanced"])
    if ok:
        mat = np.array([[e["tech"], e["ml"], e["eco"]["score"], e["cost"]["per_kg_product_inr"]] for e in ok], float)
        mat[:, 1] = np.maximum(mat[:, 1], 1.0)
        w = np.array([weights["tech"], weights["ml"], weights["eco"], weights["cost"]])
        cl = topsis(mat, w, np.array([True, True, True, False]))
        cmin = max(mat[:, 3].min(), 1e-6)
        for e, s in zip(ok, cl):
            cost_score = 100 * (cmin / max(e["cost"]["per_kg_product_inr"], 1e-6)) ** 0.5
            e["cost_score"] = cost_score
            wsum = (w[0] * e["tech"] + w[1] * e["ml"] + w[2] * e["eco"]["score"] + w[3] * cost_score) / w.sum()
            # blend of TOPSIS closeness (relative) and weighted sum (absolute) keeps scores stable for small sets
            e["overall"] = (0.5 * float(s) * 100 + 0.5 * wsum) * (1.0 if e["ratio"] >= 0.9 else 0.75)
        ok.sort(key=lambda e: e["overall"], reverse=True)

    # de-duplicate near-identical structures (keep best of each family+technique pair for top list)
    top, seen = [], set()
    for e in ok:
        key = (e["family"], e["c"].technique, e["c"].sol["kind"])
        if key in seen and len(ok) > top_n * 2:
            continue
        seen.add(key)
        top.append(e)
        if len(top) >= top_n:
            break

    def pack(e, rank):
        c = e["c"]
        return dict(
            rank=rank, id=c.sol["id"], name=e["name"], family=e["family"],
            family_label=MATERIAL_FAMILIES.get(e["family"], e["family"]), kind=c.sol["kind"],
            uses=c.sol.get("uses"),
            scores=dict(overall=round(e["overall"], 1), technical=round(e["tech"], 1), ml=round(e["ml"], 1),
                        sustainability=e["eco"]["score"], cost_per_kg=e["cost"]["per_kg_product_inr"]),
            meets_target=e["ratio"] >= 1,
            shelf_life=dict(predicted_days=round(e["sl"]["total"], 1), target_days=p.desired_days,
                            ratio=round(e["ratio"], 2), limiting=e["sl"]["limiting"],
                            limiting_label=MECH_LABELS.get(e["sl"]["limiting"]),
                            storage_only_days=round(e["sl"]["storage_only"], 1),
                            transit_consumed_pct=round(e["sl"]["transit_consumed"] * 100, 1),
                            mechanisms={MECH_LABELS.get(k, k): v for k, v in e["sl"]["mechanisms"].items()}),
            specs=_specs(p, c, e["bar_T"], e["cost"]),
            addons=e["addons"], cost=e["cost"], sustainability=e["eco"],
            footprint=food_waste_note(p.food_co2e, p.weight_kg, e["cost"]["co2e_g"]),
            warnings=[dict(level=l, text=t) for l, t in e["warnings"]],
            reasons=_reasons(p, c, e["sl"], e["bar_T"], req, e["eco"]),
            compliance=checklist(p, c.sol, c.total_um) if detail else [],
        )

    recs = [pack(e, i + 1) for i, e in enumerate(top)]

    alternatives = {}
    if ok:
        meeting = [e for e in ok if e["ratio"] >= 1] or ok
        eco_best = max(meeting, key=lambda e: e["eco"]["score"])
        cheapest = min(meeting, key=lambda e: e["cost"]["per_kg_product_inr"])
        longest = max(ok, key=lambda e: e["sl"]["total"])
        for key, e in (("most_sustainable", eco_best), ("lowest_cost", cheapest), ("longest_shelf_life", longest)):
            alternatives[key] = dict(id=e["c"].sol["id"], name=e["name"], shelf_life_days=round(e["sl"]["total"], 1),
                                     cost_per_pack=e["cost"]["per_pack_inr"], eco_score=e["eco"]["score"],
                                     recyclability=e["eco"]["recyclability"], meets_target=e["ratio"] >= 1)

    # requirements in specification units
    T = p.temp
    otr_spec = None if req.get("otr_max_T") is None else req["otr_max_T"] / ph.arrhenius(35, 23, T)
    wvtr_spec = None if req.get("wvtr_K_max_T") is None else \
        req["wvtr_K_max_T"] * 0.9 * ph.p_sat(38) / ph.arrhenius(33, 38, T)
    rng = req.get("otr_range_T")
    requirements_out = dict(
        drivers=req["drivers"],
        otr_max_spec=None if otr_spec is None else round(otr_spec, 3),
        otr_max_at_storage=None if req.get("otr_max_T") is None else round(req["otr_max_T"], 3),
        otr_class=_barrier_class_otr(otr_spec) if otr_spec is not None else (
            "breathable (MAP window)" if rng else "not critical"),
        otr_range_for_map_spec=None if not rng else [round(rng[0] / ph.arrhenius(40, 23, T), 0),
                                                      round(rng[1] / ph.arrhenius(40, 23, T), 0)],
        beta_range_for_map=None if not req.get("beta_range") else [round(x, 2) if x else None for x in req["beta_range"]],
        wvtr_max_spec=None if wvtr_spec is None else round(wvtr_spec, 3),
        wvtr_class=_barrier_class_wvtr(wvtr_spec) if wvtr_spec is not None else "not critical",
        light_barrier_min_pct=90 if p.light >= 0.6 else 50 if p.light >= 0.3 else 0,
        grease_resistance="high" if p.fat > 20 else "moderate" if p.fat > 8 else "low",
        min_ldpe_equivalent_thickness_um=round(mech_thickness_ldpe_eq(p), 0),
        puncture_resistance="high" if p.sharp else "normal",
        service_temperature_c=[round(min(p.temp, p.transit_temp), 1),
                               121 if p.process == "retort" else 90 if p.process == "hot_fill" else round(max(p.temp, p.transit_temp), 1)],
        map=dict(applicable=bool(p.o2_win or (p.map_gas and p.map_benefit > 1)),
                 o2_window=p.o2_win, co2_window=p.co2_win,
                 gas_mix=p.map_gas if not p.is_produce else None,
                 respiration_rate_at_storage_ml_o2_kg_h=round(rr_air_at(p, T), 2) if p.is_produce else None),
        summary=_summary(p, req, otr_spec, wvtr_spec),
    )

    result = dict(
        engine_version=ENGINE_VERSION,
        generated_at=time.strftime("%Y-%m-%dT%H:%M:%S"),
        compute_ms=None,
        profile=_profile_out(p),
        requirements=requirements_out,
        recommendations=recs,
        alternatives=alternatives,
        rejected=rejected,
        evaluated=len(ok),
        ml=ml_out,
        notes=p.notes,
    )
    if detail and top:
        result["temperature_curve"] = temperature_curve(p, top[:4])
        sim = next((map_simulation(p, e) for e in top if p.is_produce and not e["c"].is_open), None)
        result["map_simulation"] = sim
        result["secondary_packaging"] = secondary_packaging(p)
        result["storage_guidance"] = storage_guidance(p)
    result["compute_ms"] = round((time.time() - t0) * 1000, 1)
    # expose for ML dataset generation
    result["_ranked_families"] = [e["family"] for e in ok]
    result["_req"] = req
    return result


def _summary(p: Profile, req: dict, otr_spec, wvtr_spec) -> str:
    parts = [f"{p.name} ({p.category_label.lower()}) stored at {p.temp:g} °C / {p.rh*100:.0f} % RH for a target of "
             f"{p.desired_days:.0f} days."]
    d = req["drivers"]
    if p.is_produce:
        parts.append(f"It respires at ≈{rr_air_at(p, p.temp):.1f} mL O2/kg·h at storage temperature, so the package "
                     "must be breathable and balance O2 ingress against consumption"
                     + (f" to reach {p.o2_win[0]}-{p.o2_win[1]} % O2 and {p.co2_win[0]}-{p.co2_win[1]} % CO2." if p.o2_win
                        else "; this commodity does not benefit from MAP and needs ventilation."))
    if otr_spec is not None:
        parts.append(f"Oxygen must be limited to OTR ≤ {otr_spec:.2f} cc/m²·day (23 °C, 0 % RH).")
    if wvtr_spec is not None:
        parts.append(f"Water vapour must be limited to WVTR ≤ {wvtr_spec:.2f} g/m²·day (38 °C, 90 % RH).")
    if not d:
        parts.append("Barrier requirements are modest; mechanical protection and hygiene dominate.")
    return " ".join(parts)


def _profile_out(p: Profile) -> dict:
    return dict(
        name=p.name, commodity_id=p.commodity_id, category=p.cat, category_label=p.category_label, state=p.state,
        moisture=p.moisture, fat=p.fat, protein=p.protein, ph=p.ph, aw=p.aw,
        respiration_rate=p.rr, respiration_temp=p.rr_temp, is_produce=p.is_produce, is_dry=p.is_dry,
        storage=p.storage, temp=p.temp, rh=round(p.rh * 100, 1), desired_days=p.desired_days, weight_kg=p.weight_kg,
        area_m2=round(p.area_m2, 4), headspace_ml=round(p.headspace_ml, 0), transport=p.transport,
        transport_days=p.transport_days, transit_temp=round(p.transit_temp, 1), cold_chain=p.cold_chain,
        process=p.process, o2_tolerance=p.o2_tol, light_sensitivity=p.light, aw_critical=p.aw_c,
        chill_threshold=p.chill, ethylene=p.eth, climacteric=p.climacteric,
    )


def shelf_life_at(inp: dict, solution_id: str, temps_days: list[tuple[float, float]]) -> dict:
    """Remaining-life accounting for a packed batch given logged (temperature, duration_days) segments.
    Uses the same mechanistic model (fraction of life consumed = Σ Δt / L(T))."""
    p = build_profile(inp)
    req = requirements(p)
    sol = next(s for s in SOLUTIONS if s["id"] == solution_id)
    c, _ = choose_structure(p, sol, req)
    if p.is_produce:
        design_map(p, c)
    choose_technique(p, c, barrier(c, p.temp, p.rh, p.aw))
    consumed = 0.0
    seg_out = []
    for t_c, dur in temps_days:
        life = min(mechanisms(p, c, t_c, p.rh, light_exposed=False).values())
        frac = dur / max(life, 1e-6)
        consumed += frac
        seg_out.append(dict(temp=t_c, days=round(dur, 3), life_at_temp=round(life, 1), consumed_pct=round(frac * 100, 2)))
    life_ref = min(mechanisms(p, c, p.temp, p.rh, light_exposed=False).values())
    remaining_frac = max(0.0, 1 - consumed)
    return dict(consumed_pct=round(consumed * 100, 1), remaining_pct=round(remaining_frac * 100, 1),
                remaining_days_at_storage=round(remaining_frac * life_ref, 1), life_at_storage=round(life_ref, 1),
                storage_temp=p.temp, segments=seg_out, status="OK" if remaining_frac > 0.2 else (
                    "Consume soon" if remaining_frac > 0 else "Expired / unsafe"))


def _default_temps(p: Profile) -> list[float]:
    if p.is_frozen:
        return [-30, -25, -20, -18, -15, -12, -10, -7]
    if p.is_produce:
        return [0, 2, 5, 8, 10, 12, 15, 20, 25, 30]
    if p.storage == "chilled":
        return [0, 2, 4, 6, 8, 10, 12, 15, 20, 25]
    return [10, 15, 20, 25, 30, 35, 40, 45]


def analyse_solution(inp: dict, solution_id: str, temps: list[float] | None = None) -> dict:
    """Shelf-life simulator for one packaging solution across storage temperatures."""
    p = build_profile(inp)
    req = requirements(p)
    sol = next((s for s in SOLUTIONS if s["id"] == solution_id), None)
    if sol is None:
        raise KeyError(solution_id)
    issues = compatibility(p, sol)
    c, h2 = choose_structure(p, sol, req)
    if p.is_produce:
        h2 += design_map(p, c)
    bar = barrier(c, p.temp, p.rh, p.aw)
    choose_technique(p, c, bar)
    sl = total_shelf_life(p, c)
    ads = addons(p, c)
    cc = cost_carbon(p, c, ads)
    curve = []
    for t in temps or _default_temps(p):
        m = mechanisms(p, c, t, p.rh, light_exposed=p.retail_light)
        curve.append(dict(temp=t, days=round(min(m.values()), 1),
                          mechanisms={MECH_LABELS.get(k, k): round(v, 1) for k, v in m.items()}))
    return dict(solution_id=solution_id, name=display_name(c), compatible=not (issues or h2), issues=issues + h2,
                shelf_life=dict(predicted_days=round(sl["total"], 1), limiting=MECH_LABELS.get(sl["limiting"]),
                                mechanisms={MECH_LABELS.get(k, k): v for k, v in sl["mechanisms"].items()},
                                transit_consumed_pct=round(sl["transit_consumed"] * 100, 1)),
                target_days=p.desired_days, storage_temp=p.temp, curve=curve, specs=_specs(p, c, bar, cc), cost=cc,
                sustainability=eco_score(sol, cc, p.weight_kg))


def compare(inp: dict, solution_ids: list[str]) -> dict:
    items = []
    for sid in solution_ids:
        try:
            items.append(analyse_solution(inp, sid))
        except KeyError:
            items.append(dict(solution_id=sid, error="unknown solution"))
    return dict(profile=_profile_out(build_profile(inp)), items=items)
