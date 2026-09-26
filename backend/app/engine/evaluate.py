"""
Per-candidate technical evaluation: compatibility, thickness optimisation, barrier at use
conditions, MAP / perforation design, mechanistic shelf-life prediction, cost and carbon.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from ..data.materials import BASE, STANDARD_GAUGES, get_solutions
from . import physics as ph
from .profile import Profile, mech_thickness_ldpe_eq, rr_air_at

SOLUTIONS = get_solutions()
PSAT38 = ph.p_sat(38)

CAPACITY_KG = {
    "glass_jar": 5, "tin_can": 15, "pet_bottle": 5, "hdpe_bottle": 35, "pp_tub": 2, "pp_evoh_tray": 2.5,
    "rpet_clamshell": 1, "molded_pulp_tray": 5, "pp_leno": 50, "jute_bag": 100, "aseptic_carton": 1.5,
    "pet_al_cpp_retort": 3, "pet_pa_cpp": 3, "pa_pe_vacuum": 10, "pe_evoh_pe": 15, "hermetic_grain": 100,
    "pp_woven_liner": 50, "cellulose": 2, "pla": 5, "pvdc_bopp": 2, "paper_al_pe": 1, "bopp": 2, "bopp_bopp": 2,
    "bopp_metbopp": 2, "compostable_barrier": 2, "ldpe_coex_milk": 1, "kraft": 10, "paper_pe": 10, "cpp": 5,
    "alox_pet_pe": 5, "pet_al_pe": 10, "pet_metpet_pe": 10, "mdope_evoh_pe": 10, "pet_pe": 25,
}
MIN_KG = {"hermetic_grain": 5, "pp_woven_liner": 10, "jute_bag": 10}

DEDICATED = {
    "ldpe_coex_milk": {"dairy_liquid", "beverage", "batter", "dairy_fresh"},
    "pp_woven_liner": {"grain", "flour", "sugar_salt"},
    "hermetic_grain": {"grain", "flour", "dry_fruit", "spice"},
    "jute_bag": {"grain", "sugar_salt", "root_bulb"},
    "pp_leno": {"root_bulb", "fruit", "vegetable"},
    "molded_pulp_tray": {"fruit", "vegetable", "egg", "root_bulb"},
    "rpet_clamshell": {"fruit", "vegetable", "fresh_cut", "leafy", "egg", "bakery"},
    "aseptic_carton": {"dairy_liquid", "beverage", "sauce", "rte"},
    "pp_evoh_tray": {"meat", "seafood", "dairy_fresh", "rte", "bakery", "fresh_cut"},
    "pp_tub": {"dairy_fresh", "frozen", "sauce", "rte", "fresh_cut", "dairy_fat", "batter", "dry_fruit"},
}
PRODUCE_FAMILIES = {"polyolefin_mono", "compostable", "paper_based", "pet_pe_laminate", "ventilated_rigid",
                    "ventilated_mesh"}
HERMETIC_CATS = {"meat", "seafood", "dairy_fresh", "dairy_liquid", "rte", "beverage", "oil", "batter", "sauce",
                 "dairy_powder"}

PERF_DIAMETERS = [40, 50, 60, 80, 100, 150, 200, 300, 500]


@dataclass
class Candidate:
    sol: dict
    thickness: float | None = None          # mono: film µm; laminate: sealant µm
    layers: list | None = None
    n_perf: int = 0
    perf_d: float = 0.0
    technique: str = "standard"            # standard | passive_map | active_map | vacuum | n2_flush | ventilated
    gas: dict | None = None
    hs_o2: float = ph.O2_AIR
    headspace_ml: float = 0.0
    scavenger: bool = False
    addons: list = field(default_factory=list)
    warnings: list = field(default_factory=list)
    map_info: dict = field(default_factory=dict)

    @property
    def kind(self):
        return self.sol["kind"]

    @property
    def is_open(self):
        return self.sol["kind"] == "open"

    @property
    def total_um(self):
        if self.kind == "mono":
            return self.thickness
        if self.kind == "laminate":
            return sum(um for _, um in self.layers)
        return self.sol.get("wall_um")


# =========================================================================== barrier
def barrier(c: Candidate, t_c: float, rh: float, aw: float) -> dict:
    """OTR (cc/m²·day·atm) & water-vapour permeance K (g/m²·day·Pa) at use conditions,
    plus the standard-condition values for the specification sheet."""
    sol = c.sol
    rh_max = max(rh, aw)
    if c.kind == "mono":
        b = BASE[sol["base"]]
        f = b["ref_um"] / c.thickness
        otr_std, wvtr_std = b["otr"] * f, b["wvtr"] * f
        otr = otr_std * ph.arrhenius(b["ea_o2"], 23, t_c) * ph.humidity_factor(b["humid_k"], rh_max)
        K = wvtr_std / (0.9 * PSAT38) * ph.arrhenius(b["ea_h2o"], 38, t_c)
        co2 = otr * b["beta"]
        return dict(otr=otr, K=K, co2tr=co2, beta=b["beta"], otr_std=otr_std, wvtr_std=wvtr_std,
                    co2tr_std=otr_std * b["beta"])
    if c.kind == "laminate":
        buried = set(sol.get("buried", []))
        r_o = r_w = r_c = r_os = r_ws = r_cs = 0.0
        for base_id, um in c.layers:
            b = BASE[base_id]
            f = b["ref_um"] / um
            rh_eff = (rh + aw) / 2 if base_id in buried else rh_max
            o = b["otr"] * f * ph.arrhenius(b["ea_o2"], 23, t_c) * ph.humidity_factor(b["humid_k"], rh_eff)
            w = b["wvtr"] * f / (0.9 * PSAT38) * ph.arrhenius(b["ea_h2o"], 38, t_c)
            r_o += 1 / o
            r_c += 1 / (o * b["beta"])
            r_w += 1 / w
            r_os += 1 / (b["otr"] * f)
            r_cs += 1 / (b["otr"] * f * b["beta"])
            r_ws += 1 / (b["wvtr"] * f)
        otr = 1 / r_o
        return dict(otr=otr, K=1 / r_w, co2tr=1 / r_c, beta=(1 / r_c) / otr, otr_std=1 / r_os,
                    wvtr_std=1 / r_ws, co2tr_std=1 / r_cs)
    if c.kind == "rigid":
        otr = sol["otr_eff"] * ph.arrhenius(30, 23, t_c)
        K = sol["wvtr_eff"] / (0.9 * PSAT38) * ph.arrhenius(30, 38, t_c)
        return dict(otr=otr, K=K, co2tr=otr, beta=1.0, otr_std=sol["otr_eff"], wvtr_std=sol["wvtr_eff"],
                    co2tr_std=sol["otr_eff"])
    # open / ventilated
    v = sol.get("vent_factor", 1.0)
    return dict(otr=None, K=0.01 * v, co2tr=None, beta=None, otr_std=None, wvtr_std=None, co2tr_std=None)


# =========================================================================== requirements
def requirements(p: Profile) -> dict:
    """Barrier requirements derived from the food & conditions (storage temperature values)."""
    req = {"otr_max_T": None, "otr_range_T": None, "wvtr_K_max_T": None, "drivers": []}
    T, A, W, t = p.temp, p.area_m2, p.weight_kg, p.desired_days
    if p.o2_tol:
        tol_T = p.o2_tol * 2 ** ((25 - T) / 10)
        hs_o2_mg = p.headspace_ml * 0.02 * ph.MG_PER_ML_O2  # assume N2 flush to 2 % if needed
        allowed = tol_T * W - hs_o2_mg
        if allowed <= 0:
            allowed = tol_T * W * 0.3
        req["otr_max_T"] = allowed / (t * A * ph.O2_AIR * ph.MG_PER_ML_O2)
        req["drivers"].append("oxidation")
    if p.map_benefit > 1 and not p.is_produce:
        gas_ret = 0.3 * max(p.headspace_ml, 50) / (A * t * 0.5)   # CO2 retention, β≈3-4 → per OTR
        req["otr_max_T"] = min(req["otr_max_T"] or 1e9, gas_ret / 3.5)
        req["drivers"].append("MAP gas retention")
    if p.is_produce and p.o2_win:
        rra = rr_air_at(p, T)
        o_lo, o_hi = p.o2_win[0] / 100, p.o2_win[1] / 100
        co2_mid = (p.co2_win[0] + p.co2_win[1]) / 200 if p.co2_win else 0.05
        o_hi = min(o_hi, 0.19)
        g_lo = ph.rr_mm(rra, o_hi, co2_mid) * W * 24 / (ph.O2_AIR - o_hi)
        g_hi = ph.rr_mm(rra, o_lo, co2_mid) * W * 24 / (ph.O2_AIR - o_lo)
        req["otr_range_T"] = (min(g_lo, g_hi) / A, max(g_lo, g_hi) / A)
        rq_beta_lo = (ph.O2_AIR - o_hi) / max(p.co2_win[1] / 100, 0.005) if p.co2_win else None
        rq_beta_hi = (ph.O2_AIR - o_lo) / max(p.co2_win[0] / 100, 0.005) if p.co2_win else None
        req["beta_range"] = (rq_beta_lo, rq_beta_hi) if p.co2_win else None
        req["drivers"].append("respiration (MAP)")
    # water vapour
    p0 = ph.p_sat(T)
    if p.is_dry:
        m_i = p.moisture / (100 - p.moisture)
        c0 = m_i - p.b * p.aw
        m_c = p.b * p.aw_c + c0
        m_e = p.b * p.rh + c0
        if m_e > m_c:
            w_dry = W * 1000 * (1 - p.moisture / 100)
            req["wvtr_K_max_T"] = w_dry * p.b * math.log((m_e - m_i) / (m_e - m_c)) / (A * p0 * t)
            req["drivers"].append("moisture gain")
    elif p.max_wl and not p.is_produce:
        dp = _drying_dp(p, T, p.rh)
        if dp > 0:
            req["wvtr_K_max_T"] = p.max_wl / 100 * W * 1000 / (t * A * dp)
            req["drivers"].append("sublimation (freezer burn)" if p.is_frozen else "moisture loss")
    elif p.is_liquid:
        dp = p0 * max(0.05, p.aw - p.rh)
        req["wvtr_K_max_T"] = 0.01 * W * 1000 / (t * A * dp)
    return req


def _drying_dp(p: Profile, T: float, rh: float) -> float:
    p0 = ph.p_sat(T)
    if p.is_frozen and T < 0:
        return p0 * (1 - rh) + 0.15 * p0   # temperature cycling drives sublimation
    return p0 * max(0.0, p.aw - rh)


def std_from_T(value_T, ea, t_ref, T):
    return None if value_T is None else value_T / ph.arrhenius(ea, t_ref, T)


# =========================================================================== compatibility
def compatibility(p: Profile, sol: dict) -> list[str]:
    r = []
    fam, sid = sol["family"], sol["id"]
    if sid in DEDICATED and p.cat not in DEDICATED[sid]:
        r.append(f"{sol['short'] if sol['kind'] != 'laminate' else sol['name']} is designed for other commodity classes")
    if p.is_produce and fam not in PRODUCE_FAMILIES and sid not in DEDICATED:
        r.append("High-barrier/hermetic format would suffocate respiring produce (anaerobic fermentation)")
    if p.cat == "egg" and sid not in ("molded_pulp_tray", "rpet_clamshell"):
        r.append("Shell eggs need a cushioning cell tray, not a film/pouch")
    if p.is_liquid and not sol.get("liquid_ok"):
        r.append("Not suitable for liquids (leakage)")
    if p.state == "paste" and sol["kind"] == "open":
        r.append("Open/ventilated format cannot contain a paste")
    if sol["kind"] == "open" and not p.is_produce and sid not in DEDICATED:
        r.append("Ventilated format gives no barrier for this product")
    if sol["kind"] == "open" and (p.cat in HERMETIC_CATS or p.state == "powder"):
        r.append("Product needs a hermetically sealed package")
    if sid in ("kraft",) and (p.cat in HERMETIC_CATS or p.aw > 0.9 and not p.is_produce):
        r.append("Paper alone is not a hygienic barrier for moist/perishable foods")
    if sid in ("cellulose", "compostable_barrier") and (p.is_frozen or (p.aw > 0.9 and not p.is_produce)):
        r.append("Cellulose barrier plasticises and weakens in contact with moist/frozen foods")
    if sol.get("retort") and p.process not in ("retort", "aseptic") and p.cat not in ("rte", "sauce", "meat", "seafood",
                                                                                          "dairy_fresh", "frozen"):
        r.append("Retort-grade structure is unnecessary for this product (over-specification)")
    if p.process == "retort" and not sol.get("retort"):
        r.append("Cannot withstand retort sterilisation (121 °C, 2 bar)")
    if p.process == "hot_fill" and sol.get("tmax", 0) < 85:
        r.append(f"Maximum use temperature {sol.get('tmax')} °C is below hot-fill temperature (85-92 °C)")
    if p.process == "aseptic" and not sol.get("liquid_ok"):
        r.append("Aseptic filling needs a liquid-tight sterilisable package")
    if p.sterile and sol["kind"] in ("open",):
        r.append("Commercially sterile food needs a hermetic package")
    if sol.get("tmin", -99) > min(p.temp, p.transit_temp):
        r.append(f"Becomes brittle below {sol['tmin']} °C (storage {p.temp:g} °C)")
    if sol.get("tmax", 999) < max(p.temp, p.transit_temp) + 5:
        r.append(f"Maximum service temperature {sol['tmax']} °C too low for exposure conditions")
    cap = CAPACITY_KG.get(sid, 50 if sol["kind"] == "mono" else 25)
    if p.weight_kg > cap:
        r.append(f"Pack size {p.weight_kg:g} kg exceeds practical capacity ({cap:g} kg) of this format")
    if sid in MIN_KG and p.weight_kg < MIN_KG[sid]:
        r.append(f"Bulk format — intended for ≥ {MIN_KG[sid]} kg")
    if p.fat > 20 and sol.get("grease", 5) < 2:
        r.append("Poor grease resistance for a high-fat product (oil staining/migration)")
    if p.need_transparent and sol.get("transparency") == "opaque":
        r.append("Opaque (transparency required)")
    if p.need_microwave and not (sol.get("microwave") or (sol.get("light_block", 0) < 0.9 and sol.get("tmax", 0) >= 100)):
        r.append("Not microwavable (metal layer or low heat resistance)")
    if p.recyclable_only and sol.get("recycle") not in ("widely",) and not sol.get("reusable"):
        r.append("Not widely recyclable")
    if p.compostable_only and not sol.get("compostable"):
        r.append("Not compostable")
    return r


# =========================================================================== thickness
def _gauge(t: float) -> float:
    for g in STANDARD_GAUGES:
        if g >= t - 0.5:
            return g
    return math.ceil(t / 10) * 10


def choose_structure(p: Profile, sol: dict, req: dict) -> tuple[Candidate, list[str]]:
    c = Candidate(sol=sol)
    hard = []
    t_mech_eq = mech_thickness_ldpe_eq(p)
    T, rh, aw = p.temp, p.rh, p.aw
    if sol["kind"] == "mono":
        b = BASE[sol["base"]]
        strength = math.sqrt(b["tensile"] / 12)
        t_need = t_mech_eq / strength
        drivers = {"mechanical": t_need}
        if not p.is_produce:
            otr_ref_T = b["otr"] * ph.arrhenius(b["ea_o2"], 23, T) * ph.humidity_factor(b["humid_k"], max(rh, aw))
            if req.get("otr_max_T"):
                drivers["oxygen barrier"] = b["ref_um"] * otr_ref_T / req["otr_max_T"]
            if req.get("wvtr_K_max_T"):
                K_ref = b["wvtr"] / (0.9 * PSAT38) * ph.arrhenius(b["ea_h2o"], 38, T)
                drivers["moisture barrier"] = b["ref_um"] * K_ref / req["wvtr_K_max_T"]
        key = max(drivers, key=drivers.get)
        t = max(drivers[key], sol["t_range"][0])
        if t > sol["t_range"][1] * 1.001:
            hard.append(f"Would need {t:.0f} µm for {key} (> {sol['t_range'][1]} µm practical limit) — "
                        "use a higher-barrier structure")
            t = sol["t_range"][1]
        c.thickness = _gauge(t)
        c.map_info["thickness_driver"] = key
    elif sol["kind"] == "laminate":
        layers = [list(x) for x in sol["layers"]]
        if not sol.get("fixed"):
            eq = sum(um * math.sqrt(BASE[b]["tensile"] / 12) for b, um in layers)
            if eq < t_mech_eq:
                sb = layers[-1][0]
                extra = (t_mech_eq - eq) / math.sqrt(BASE[sb]["tensile"] / 12)
                layers[-1][1] = _gauge(layers[-1][1] + extra)
                if layers[-1][1] > 150:
                    hard.append("Sealant layer would exceed 150 µm — pack too heavy for this laminate")
                    layers[-1][1] = 150
        c.layers = [tuple(x) for x in layers]
        c.thickness = c.layers[-1][1]
    return c, hard


# =========================================================================== MAP design
def _conductances(p, c, bar, t_c):
    g_o2 = bar["otr"] * p.area_m2
    g_co2 = bar["co2tr"] * p.area_m2
    if c.n_perf:
        film = c.total_um or 25
        g_o2 += c.n_perf * ph.perforation_conductance("O2", c.perf_d, film, t_c)
        g_co2 += c.n_perf * ph.perforation_conductance("CO2", c.perf_d, film, t_c)
    return g_o2, g_co2


def design_map(p: Profile, c: Candidate) -> list[str]:
    """Passive MAP for respiring produce: equilibrium atmosphere + micro-perforation design."""
    hard = []
    T = p.temp
    if c.is_open:
        c.technique = "ventilated"
        c.map_info.update(mode="ventilated", eq_o2=20.9, eq_co2=0.0)
        return hard
    bar = barrier(c, T, 0.97, 0.98)
    rra = rr_air_at(p, T)
    g_o2, g_co2 = _conductances(p, c, bar, T)
    y_o2, y_co2, _ = ph.map_equilibrium(rra, p.weight_kg, g_o2, g_co2)
    film_eq = (y_o2, y_co2)
    if p.o2_win:
        target_o2 = (p.o2_win[0] + min(p.o2_win[1], 19)) / 200
        target_co2 = (p.co2_win[0] + p.co2_win[1]) / 200 if p.co2_win else 0.05
    else:  # produce that does not benefit from MAP: keep it near-aerobic with vent holes
        target_o2, target_co2 = 0.17, 0.03
    if y_o2 < target_o2 * 0.9:
        # search hole diameter × count for the equilibrium closest to the target O2 (integer holes!)
        rr_t = ph.rr_mm(rra, target_o2, target_co2)
        g_need = rr_t * p.weight_kg * 24 / (ph.O2_AIR - target_o2)
        diameters = PERF_DIAMETERS if p.o2_win else [6000]
        best = None
        for d in diameters:
            g_hole = ph.perforation_conductance("O2", d, c.total_um or 25, T)
            n0 = max(0.0, g_need - g_o2) / g_hole
            for n in {max(1, math.floor(n0)), max(1, math.ceil(n0))}:
                if n > 60 and d != diameters[-1]:
                    continue
                c.n_perf, c.perf_d = n, d
                go, gc = _conductances(p, c, bar, T)
                yo, yc, _ = ph.map_equilibrium(rra, p.weight_kg, go, gc)
                err = abs(yo - target_o2) / target_o2 + (0.5 if p.co2_win and yc * 100 > p.co2_win[1] * 1.2 + 0.5 else 0)
                err += 0.002 * n  # prefer fewer holes (cheaper, more robust)
                if best is None or err < best[0]:
                    best = (err, n, d)
        c.n_perf, c.perf_d = best[1], best[2]
        g_o2, g_co2 = _conductances(p, c, bar, T)
        y_o2, y_co2, _ = ph.map_equilibrium(rra, p.weight_kg, g_o2, g_co2)
    c.technique = "passive_map" if (p.o2_win and y_o2 < 0.18) else ("breathable" if p.o2_win else "ventilated")
    info = dict(mode=c.technique, eq_o2=round(y_o2 * 100, 2), eq_co2=round(y_co2 * 100, 2),
                film_only_o2=round(film_eq[0] * 100, 2), film_only_co2=round(film_eq[1] * 100, 2),
                perforations=c.n_perf, perf_diameter_um=c.perf_d,
                target_o2=p.o2_win, target_co2=p.co2_win, g_o2=round(g_o2, 1), g_co2=round(g_co2, 1),
                rr_air_ml_kg_h=round(rra, 2))
    if p.o2_win:
        in_o2 = p.o2_win[0] * 0.85 <= y_o2 * 100 <= p.o2_win[1] * 1.15 + 0.5
        in_co2 = (p.co2_win is None) or (y_co2 * 100 <= p.co2_win[1] * 1.2 + 0.5)
        info["in_window"] = bool(in_o2 and in_co2)
        if y_o2 * 100 > p.o2_win[1] * 1.15 + 0.5 and c.n_perf == 0:
            info["note"] = "Film is more permeable than needed; atmosphere stays close to air (little MAP benefit)."
        if p.co2_win and y_co2 * 100 > p.co2_win[1] * 1.2 + 0.5:
            info["note"] = (f"Predicted CO2 {y_co2*100:.1f} % exceeds tolerance ({p.co2_win[1]} %) — film CO2/O2 "
                            "selectivity too low; add perforations or a higher-β film.")
    else:
        info["in_window"] = y_o2 > 0.1
    c.map_info.update(info)
    if y_o2 * 100 < 0.8:
        hard.append("Anaerobic headspace predicted even after perforation design")
    return hard


# =========================================================================== shelf-life mechanisms
MECH_LABELS = {
    "senescence": "Respiration & senescence",
    "weight_loss": "Moisture / weight loss",
    "moisture_gain": "Moisture gain (loss of crispness / caking)",
    "drying": "Drying / freezer burn",
    "oxidation": "Oxidative rancidity / flavour loss",
    "light": "Light-induced deterioration",
    "microbial": "Microbial spoilage",
    "insect": "Insect infestation",
    "intrinsic": "Intrinsic quality decline",
    "frozen_quality": "Frozen-storage quality (HQL)",
}


def mechanisms(p: Profile, c: Candidate, t_c: float, rh: float, light_exposed: bool = True) -> dict:
    out = {}
    W, A = p.weight_kg, p.area_m2
    bar = barrier(c, t_c, rh, p.aw)
    p0 = ph.p_sat(t_c)
    is_open = c.is_open
    Tk = t_c + 273.15

    # --- fresh produce -----------------------------------------------------
    if p.is_produce:
        rra = rr_air_at(p, t_c)
        rr_opt = rr_air_at(p, p.t_opt)
        if is_open:
            y_o2, y_co2, rr_eff = ph.O2_AIR, 0.0, rra
        else:
            g_o2, g_co2 = _conductances(p, c, bar, t_c)
            y_o2, y_co2, rr_eff = ph.map_equilibrium(rra, W, g_o2, g_co2)
        ratio = max(rr_eff / rra, 1 / 3) if rra else 1
        life = (p.base_life or 14) * (rr_opt / rra) / ratio
        if p.o2_win:
            if y_o2 * 100 < p.o2_win[0] * 0.7:
                life *= 0.25 if y_o2 * 100 < 1 else 0.5
            if p.co2_win and y_co2 * 100 > p.co2_win[1] * 1.3 + 0.5:
                life *= 0.6
        else:
            if not is_open and y_o2 < 0.05:
                life *= 0.3
        if p.rh_opt < 0.8 and not is_open:
            life *= 0.5 if c.n_perf == 0 else 0.6
        if p.chill is not None and t_c < p.chill:
            life *= max(0.3, 1 - 0.12 * (p.chill - t_c))
        out["senescence"] = life
        # weight loss
        if p.max_wl:
            if is_open:
                vpd_kpa = p0 / 1000 * max(0.0, 0.98 - rh)
                bulk = min(1.0, (2.0 / W) ** 0.33) if W > 2 else 1.0   # stacked product shields itself
                rate_pct = (p.transp or 200) * 8.64e-3 * vpd_kpa * c.sol.get("vent_factor", 1.0) * bulk
                out["weight_loss"] = p.max_wl / max(rate_pct, 1e-6)
            else:
                loss = bar["K"] * A * p0 * max(0.0, 0.98 - rh)
                if c.n_perf:
                    d_rho = p0 * max(0.0, 0.98 - rh) * 0.018 / (ph.R * Tk) * 1e-3  # g/cm³
                    loss += c.n_perf * ph.perforation_conductance("H2O", c.perf_d, c.total_um or 25, t_c) * d_rho
                out["weight_loss"] = p.max_wl / 100 * W * 1000 / max(loss, 1e-6)

    # --- moisture gain of dry foods -----------------------------------------
    if p.is_dry:
        m_i = p.moisture / (100 - p.moisture)
        c0 = m_i - p.b * p.aw
        m_c = p.b * p.aw_c + c0
        m_e = p.b * rh + c0
        if m_e > m_c:
            w_dry = W * 1000 * (1 - p.moisture / 100)
            out["moisture_gain"] = w_dry * p.b / (bar["K"] * A * p0) * math.log((m_e - m_i) / (m_e - m_c))
        if p.max_wl and rh < p.aw:
            loss = bar["K"] * A * p0 * (p.aw - rh)
            out["drying"] = p.max_wl / 100 * W * 1000 / max(loss, 1e-9)

    # --- drying of moist foods / freezer burn -------------------------------
    elif p.max_wl and not p.is_produce:
        dp = _drying_dp(p, t_c, rh)
        if dp > 0:
            out["drying"] = p.max_wl / 100 * W * 1000 / max(bar["K"] * A * dp, 1e-9)

    # --- oxidation ------------------------------------------------------------
    if p.o2_tol:
        tol = p.o2_tol * 2 ** ((25 - t_c) / 10)
        hs = c.headspace_ml * c.hs_o2 * ph.MG_PER_ML_O2
        allowed = tol * W - hs + (150 * ph.MG_PER_ML_O2 if c.scavenger else 0)
        ingress = (bar["otr"] if not is_open else 1e5) * A * ph.O2_AIR * ph.MG_PER_ML_O2
        life = max(allowed, tol * W * 0.02) / max(ingress, 1e-9)
        life = max(life, p.air_life * ph.q10_factor(2.0, 25, t_c))   # reaction-limited floor
        if light_exposed and p.light > 0.2:
            life /= 1 + 3 * p.light * (1 - c.sol.get("light_block", 0))
        out["oxidation"] = life
    elif light_exposed and p.light >= 0.5:
        exposure = 10 * p.light * (1 - c.sol.get("light_block", 0))
        if exposure > 0.05:
            out["light"] = 30 / exposure

    # --- microbial ------------------------------------------------------------
    if p.base_life and p.tmin_r is not None and not p.sterile:
        life = p.base_life * ph.ratkowsky_factor(p.t_opt, t_c, p.tmin_r)
        if c.technique in ("active_map",):
            life *= p.map_benefit
        elif c.technique == "vacuum":
            life *= 1 + (p.map_benefit - 1) * 0.85
        if is_open or c.sol["id"] == "kraft":
            life *= 0.7
        out["microbial"] = life
    elif p.base_life and not p.is_produce and not p.is_frozen and p.tmin_r is None:
        out["intrinsic"] = p.base_life * ph.q10_factor(p.q10, p.t_opt, t_c)

    # --- frozen quality --------------------------------------------------------
    if p.is_frozen and p.base_life:
        if t_c > -5:
            out["frozen_quality"] = 1.0
        else:
            out["frozen_quality"] = p.base_life * ph.q10_factor(p.q10, p.t_opt, t_c)

    # --- insects -------------------------------------------------------------
    if p.insect:
        # hermetic = O2 ingress low enough that insect respiration drives O2 below ~5 % (Navarro 2012)
        hermetic = ((not is_open) and bar["otr_std"] is not None and bar["otr_std"] <= 10) or \
            c.sol["id"] == "hermetic_grain"
        if not hermetic:
            base = 120 * ph.q10_factor(2.5, 30, t_c) if t_c > 15 else 480
            if not is_open and c.sol["kind"] != "open":
                base *= 1.5 if (c.total_um or 0) >= 50 else 1.2
            out["insect"] = min(base, 720)

    # --- intrinsic -------------------------------------------------------------
    if p.intrinsic:
        out["intrinsic"] = min(out.get("intrinsic", 1e9), p.intrinsic * ph.q10_factor(2.0, 25, t_c))

    if not out:
        out["intrinsic"] = 365 * ph.q10_factor(2.0, 25, t_c)
    return out


def total_shelf_life(p: Profile, c: Candidate) -> dict:
    """Time-temperature integration: transit at transit_temp, then storage at temp."""
    store = mechanisms(p, c, p.temp, p.rh, light_exposed=p.retail_light)
    life_store = min(store.values())
    transit = mechanisms(p, c, p.transit_temp, p.transit_rh, light_exposed=False)
    life_transit = min(transit.values())
    td = p.transport_days
    consumed = td / max(life_transit, 1e-6)
    if consumed >= 1:
        total = life_transit
        spoiled_in_transit = True
    else:
        total = td + (1 - consumed) * life_store
        spoiled_in_transit = False
    limiting = min(store, key=store.get)
    return dict(total=total, storage_only=life_store, transit_consumed=consumed, spoiled_in_transit=spoiled_in_transit,
                limiting=limiting, mechanisms={k: round(v, 1) for k, v in store.items()})


# =========================================================================== techniques & add-ons
def choose_technique(p: Profile, c: Candidate, bar_T: dict) -> None:
    sol = c.sol
    c.headspace_ml = p.headspace_ml
    if p.is_produce or c.is_open:
        return
    otr_A = bar_T["otr"] * p.area_m2
    co2tr_A = bar_T["co2tr"] * p.area_m2
    if p.map_benefit > 1:
        retains = co2tr_A * p.desired_days * 0.5 <= 0.3 * max(p.headspace_ml, 50)
        if sol.get("map_ok") and retains and not (p.cat == "bakery" and sol["kind"] == "rigid" and sol["id"] != "pp_evoh_tray"):
            c.technique, c.gas = "active_map", p.map_gas or {"CO2": 40, "N2": 60}
            c.hs_o2 = (c.gas.get("O2", 0) / 100) or 0.005
            return
        if sol.get("vacuum") and bar_T["otr"] < 60 and not p.fragile:
            c.technique, c.gas, c.hs_o2 = "vacuum", None, ph.O2_AIR
            c.headspace_ml = p.headspace_ml * 0.03
            return
    if p.o2_tol:
        hs_air_mg = p.headspace_ml * ph.O2_AIR * ph.MG_PER_ML_O2
        tol_mg = p.o2_tol * p.weight_kg
        worth = otr_A * ph.O2_AIR * ph.MG_PER_ML_O2 * p.desired_days < tol_mg * 1.5
        if hs_air_mg > 0.25 * tol_mg and worth:
            c.technique = "n2_flush"
            c.gas = p.map_gas or {"N2": 100}
            c.hs_o2 = 0.02
            if p.o2_tol < 200 and otr_A < 5:
                c.scavenger = True
                c.hs_o2 = 0.005


def addons(p: Profile, c: Candidate) -> list[dict]:
    a = []
    if c.technique in ("n2_flush", "active_map"):
        gas = ", ".join(f"{g} {v}%" for g, v in (c.gas or {}).items())
        a.append(dict(item="Gas flushing (MAP)", detail=f"Flush with {gas}; residual O2 ≤ {c.hs_o2*100:.1f} %",
                      cost=0.35 + p.headspace_ml / 1000 * 0.4))
    if c.technique == "vacuum":
        a.append(dict(item="Vacuum packing", detail="Chamber vacuum ≤ 10 mbar before sealing", cost=0.6))
    if c.scavenger:
        a.append(dict(item="Oxygen scavenger sachet", detail="Iron-based, 100-200 cc capacity", cost=2.5))
    if p.degassing and not c.is_open:
        a.append(dict(item="One-way degassing valve", detail="Releases CO2 from roasted coffee / fermenting batter",
                      cost=4.0))
    if p.is_produce and not c.is_open:
        a.append(dict(item="Anti-fog coating", detail="Prevents condensation fogging at high in-pack RH", cost=0.3 * p.area_m2 * 10))
        if p.eth in ("high", "very high") or (p.climacteric and p.eth_sens):
            a.append(dict(item="Ethylene absorber sachet (KMnO4 / zeolite)",
                          detail="Delays ripening of climacteric fruit", cost=1.5))
    if p.commodity_id == "grapes":
        a.append(dict(item="SO2-generating pad", detail="Controls Botrytis grey mould in grapes", cost=3.0))
    if p.is_dry and p.aw_c is not None and p.aw_c - p.aw < 0.2 and p.rh > 0.7 and p.state != "liquid":
        a.append(dict(item="Food-grade desiccant (silica gel / clay)", detail="Buffers moisture ingress at seal areas",
                      cost=1.0))
    if p.cat in ("meat", "seafood") and not c.is_open:
        a.append(dict(item="Absorbent drip pad", detail="Absorbs purge / exudate", cost=1.2))
    if p.sharp and not c.is_open and c.sol.get("puncture", 5) < 4:
        a.append(dict(item="Bone-guard / puncture-resistant patch", detail="Prevents puncture by bones/fins/spines", cost=1.5))
    if p.fragile and c.sol["kind"] in ("mono", "laminate") and c.technique != "vacuum":
        a.append(dict(item="Air/N2 cushion headspace", detail="Protects fragile product from breakage", cost=0.0))
    return a


# =========================================================================== cost, carbon
def cost_carbon(p: Profile, c: Candidate, addon_list: list) -> dict:
    sol, A = c.sol, p.area_m2
    if c.kind == "mono":
        b = BASE[sol["base"]]
        gsm = b["density"] * c.thickness
        mat = A * gsm / 1000 * b["cost_inr_kg"]
        co2 = A * gsm / 1000 * b["co2e_kg"]
        conv = A * 0.8 + 0.25
    elif c.kind == "laminate":
        gsm = co2 = mat = 0.0
        for base_id, um in c.layers:
            b = BASE[base_id]
            g = b["density"] * um
            gsm += g
            mat += A * g / 1000 * b["cost_inr_kg"]
            co2 += A * g / 1000 * b["co2e_kg"]
        extra = sol.get("extra_mass_gm2", 0)
        gsm += extra
        mat += A * extra / 1000 * 160
        co2 += A * extra / 1000 * 1.9
        conv = A * (0.8 + 1.4 * (len(c.layers) - 1)) + 0.3
    else:
        gsm = sol["density"] * sol["wall_um"]
        mass_kg = A * gsm / 1000
        mat = mass_kg * sol["cost_inr_kg"]
        co2 = mass_kg * sol["co2e_kg"]
        closure = {"glass_jar": 3.5, "tin_can": 1.5, "pet_bottle": 1.5, "hdpe_bottle": 2.0, "pp_tub": 1.5,
                   "pp_evoh_tray": 2.5}.get(sol["id"], 0.5)
        conv = closure + 0.5
    if c.n_perf:
        conv += 0.25
    add = sum(x["cost"] for x in addon_list)
    mass_g = A * gsm
    total = mat + conv + add
    return dict(material_inr=round(mat, 2), conversion_inr=round(conv, 2), addons_inr=round(add, 2),
                per_pack_inr=round(total, 2), per_1000_inr=round(total * 1000, 0),
                per_kg_product_inr=round(total / p.weight_kg, 2), pack_mass_g=round(mass_g, 1),
                grammage_gsm=round(gsm, 1), co2e_g=round(co2 * 1000, 1),
                co2e_g_per_kg_food=round(co2 * 1000 / p.weight_kg, 1))
