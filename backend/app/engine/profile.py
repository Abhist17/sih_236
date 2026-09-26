"""Builds a normalised commodity + condition profile from user input and the knowledge base."""
from __future__ import annotations

from dataclasses import dataclass, field

from ..data.commodities import COMMODITY_INDEX, PRODUCE_CATS, DRY_CATS, CATEGORIES
from . import physics as ph

TRANSPORT = {
    "local": dict(label="Local (<100 km, same day)", days=0.5, severity=0.9, dT=2),
    "regional": dict(label="Regional road (100-500 km)", days=1.5, severity=1.0, dT=4),
    "long_road": dict(label="Long-distance road (>500 km)", days=4, severity=1.25, dT=6),
    "rail": dict(label="Rail (Kisan Rail / parcel van)", days=4, severity=1.15, dT=5),
    "sea_export": dict(label="Sea export (reefer / dry container)", days=25, severity=1.2, dT=3, rh=0.9),
    "air_export": dict(label="Air export", days=2, severity=1.05, dT=5, pressure=True),
}

# Days until oxidative failure when the product is fully exposed to air (dark, 25 °C).
# Oxidation can never be faster than this, however poor the package (reaction-limited regime).
AIR_LIFE = {"snack": 30, "biscuit": 60, "dry_fruit": 45, "dairy_powder": 30, "oil": 60, "dairy_fat": 45,
            "spice": 60, "dehydrated": 30, "sauce": 45, "rte": 30, "beverage": 20, "dairy_liquid": 20,
            "dairy_fresh": 30, "frozen": 60, "seafood": 3, "flour": 45, "bakery": 10, "meat": 4}

STORAGE_DEFAULT_T = {"ambient": 30.0, "chilled": 4.0, "frozen": -18.0}
AMBIENT_INDIA_T = 32.0


@dataclass
class Profile:
    name: str
    commodity_id: str | None
    cat: str
    state: str
    moisture: float
    fat: float
    protein: float
    ph: float
    aw: float
    rr: float                 # mg CO2 / kg·h at rr_temp
    rr_temp: float
    q10: float
    eth: str
    eth_sens: bool
    climacteric: bool
    t_opt: float
    rh_opt: float
    chill: float | None
    o2_win: tuple | None
    co2_win: tuple | None
    map_gas: dict | None
    map_benefit: float
    o2_tol: float | None
    air_life: float
    light: float
    aw_c: float | None
    b: float | None
    max_wl: float | None
    transp: float | None
    base_life: float | None
    tmin_r: float | None
    intrinsic: float | None
    insect: bool
    sharp: bool
    fragile: bool
    degassing: bool
    density: float
    headspace_per_g: float
    food_co2e: float
    process: str
    # conditions
    storage: str
    temp: float
    rh: float
    desired_days: float
    weight_kg: float
    area_m2: float
    headspace_ml: float
    transport: str
    transport_days: float
    transit_temp: float
    transit_rh: float
    severity: float
    cold_chain: bool
    retail_light: bool
    # requirements
    need_transparent: bool = False
    need_microwave: bool = False
    recyclable_only: bool = False
    compostable_only: bool = False
    max_cost: float | None = None
    notes: list = field(default_factory=list)

    @property
    def is_produce(self) -> bool:
        return self.rr > 0 and self.cat in PRODUCE_CATS

    @property
    def is_dry(self) -> bool:
        return self.aw_c is not None and self.b is not None

    @property
    def is_frozen(self) -> bool:
        return self.storage == "frozen" or self.temp <= -5

    @property
    def is_liquid(self) -> bool:
        return self.state in ("liquid",)

    @property
    def sterile(self) -> bool:
        return self.process in ("retort", "aseptic")

    @property
    def category_label(self) -> str:
        return CATEGORIES.get(self.cat, self.cat)


def _infer_custom(inp: dict) -> dict:
    """Fill physiological parameters for a commodity not in the database from its composition."""
    rr = inp.get("respiration_rate") or 0
    aw = inp.get("aw")
    moisture = inp.get("moisture", 10)
    if aw is None:
        aw = 0.98 if moisture > 60 else (0.9 if moisture > 30 else (0.6 if moisture > 10 else 0.3))
    fat = inp.get("fat", 1)
    d = dict(state=inp.get("state", "solid"), moisture=moisture, fat=fat, protein=inp.get("protein", 2),
             ph=inp.get("ph", 6.0), aw=aw, q10=2.5, eth="low", eth_sens=False, climacteric=False,
             chill=None, map_gas=None, map_benefit=1.0, light=0.3, aw_c=None, b=None, max_wl=None,
             transp=None, base_life=None, tmin_r=None, intrinsic=None, insect=False, sharp=False,
             fragile=False, degassing=False, density=0.6, headspace=0.3, food_co2e=2.0, process="none",
             hi="", o2=None, co2=None)
    if rr > 0:
        cat = inp.get("category") or "vegetable"
        d.update(cat=cat, rr=rr, t_opt=inp.get("respiration_temp", 5), rh_opt=92, o2=(2, 5), co2=(3, 8),
                 base_life=max(3, min(120, 400 / rr)), transp=300, max_wl=5, density=0.45, headspace=0.4,
                 food_co2e=0.7)
    elif aw < 0.7:
        cat = inp.get("category") or ("snack" if fat > 15 else "dehydrated")
        d.update(cat=cat, rr=0, t_opt=25, rh_opt=60, aw_c=min(0.75, aw + 0.2), b=0.15,
                 o2_tol=(60000 / fat) if fat > 5 else None, light=0.5 if fat > 10 else 0.2,
                 intrinsic=None, density=0.4, headspace=0.5)
    else:
        cat = inp.get("category") or "dairy_fresh"
        chilled = inp.get("storage_type") in ("chilled", None)
        d.update(cat=cat, rr=0, t_opt=4 if chilled else 25, rh_opt=85, base_life=7 if chilled else 3,
                 tmin_r=-7 if chilled else 2, map_benefit=2.0, map_gas={"CO2": 40, "N2": 60}, max_wl=3,
                 o2_tol=(90000 / fat) if fat > 10 else None, density=0.9, headspace=0.3)
        if inp.get("ph", 6) < 4.2 and aw < 0.95:
            d.update(tmin_r=None, base_life=None, intrinsic=270, map_benefit=1.0)
    return d


def build_profile(inp: dict) -> Profile:
    cid = inp.get("commodity_id")
    if cid and cid in COMMODITY_INDEX:
        c = dict(COMMODITY_INDEX[cid])
    else:
        c = _infer_custom(inp)
        c.setdefault("name", inp.get("name") or "Custom commodity")
        c["id"] = None

    def pick(key, ckey=None):
        v = inp.get(key)
        return v if v is not None else c.get(ckey or key)

    storage = inp.get("storage_type") or c.get("storage", "ambient")
    temp = inp.get("storage_temp")
    if temp is None:
        temp = c["t_opt"] if (storage != "ambient" or c.get("rr", 0) > 0 and c["t_opt"] > 10) else STORAGE_DEFAULT_T[storage]
        if storage == "frozen":
            temp = -18.0
    rh = inp.get("rh")
    if rh is None:
        rh = c.get("rh_opt", 65) if storage != "ambient" else 70
    rh = rh / 100 if rh > 1 else rh

    rr = inp.get("respiration_rate")
    rr_temp = inp.get("respiration_temp")
    if rr is None:
        rr = c.get("rr", 0)
        rr_temp = c.get("t_opt", 5)
    elif rr_temp is None:
        rr_temp = c.get("t_opt", 5)

    tr_key = inp.get("transport") or "regional"
    tr = TRANSPORT.get(tr_key, TRANSPORT["regional"])
    cold_chain = bool(inp.get("cold_chain", storage != "ambient"))
    transit_temp = temp + 1.5 if cold_chain else max(temp, AMBIENT_INDIA_T) + tr["dT"] * 0.3
    transit_rh = max(rh, tr.get("rh", rh))

    weight = float(inp.get("net_weight_kg") or 1.0)
    density = c.get("density", 0.6)
    hs_per_g = c.get("headspace", 0.3)
    area, headspace = ph.estimate_area(weight, density, hs_per_g)
    if inp.get("package_area_m2"):
        area = float(inp["package_area_m2"])
    if inp.get("headspace_ml") is not None:
        headspace = float(inp["headspace_ml"])

    o2_win = c.get("o2")
    co2_win = c.get("co2")
    if inp.get("map_o2_min") is not None and inp.get("map_o2_max") is not None:
        o2_win = (inp["map_o2_min"], inp["map_o2_max"])
    if inp.get("map_co2_min") is not None and inp.get("map_co2_max") is not None:
        co2_win = (inp["map_co2_min"], inp["map_co2_max"])

    desired = inp.get("desired_shelf_life_days") or c.get("desired", 90)

    p = Profile(
        name=inp.get("name") or c.get("name", "Commodity"), commodity_id=c.get("id"),
        cat=inp.get("category") or c["cat"], state=pick("state"), moisture=float(pick("moisture")),
        fat=float(pick("fat")), protein=float(pick("protein") or 0), ph=float(pick("ph")), aw=float(pick("aw")),
        rr=float(rr or 0), rr_temp=float(rr_temp if rr_temp is not None else 5), q10=c.get("q10", 2.5),
        eth=c.get("eth", "none"), eth_sens=c.get("eth_sens", False), climacteric=c.get("climacteric", False),
        t_opt=c.get("t_opt", 25), rh_opt=c.get("rh_opt", 65) / 100, chill=c.get("chill"), o2_win=o2_win,
        co2_win=co2_win, map_gas=c.get("map_gas"), map_benefit=c.get("map_benefit", 1.0),
        o2_tol=inp.get("o2_tolerance") if inp.get("o2_tolerance") is not None else c.get("o2_tol"),
        air_life=c.get("air_life") or AIR_LIFE.get(inp.get("category") or c["cat"], 30),
        light=inp.get("light_sensitivity") if inp.get("light_sensitivity") is not None else c.get("light", 0.1),
        aw_c=inp.get("aw_critical") if inp.get("aw_critical") is not None else c.get("aw_c"),
        b=c.get("b") if c.get("b") is not None else (0.15 if inp.get("aw_critical") else None),
        max_wl=c.get("max_wl"), transp=c.get("transp"), base_life=c.get("base_life"), tmin_r=c.get("tmin_r"),
        intrinsic=c.get("intrinsic"), insect=c.get("insect", False), sharp=c.get("sharp", False),
        fragile=c.get("fragile", False), degassing=c.get("degassing", False), density=density,
        headspace_per_g=hs_per_g, food_co2e=c.get("food_co2e", 2.0),
        process=inp.get("process") or c.get("process", "none"),
        storage=storage, temp=float(temp), rh=float(rh), desired_days=float(desired), weight_kg=weight,
        area_m2=area, headspace_ml=headspace, transport=tr_key, transport_days=tr["days"],
        transit_temp=transit_temp, transit_rh=transit_rh, severity=tr["severity"], cold_chain=cold_chain,
        retail_light=bool(inp.get("retail_display", True)),
        need_transparent=bool(inp.get("require_transparency")), need_microwave=bool(inp.get("require_microwavable")),
        recyclable_only=bool(inp.get("recyclable_only")), compostable_only=bool(inp.get("compostable_only")),
        max_cost=inp.get("max_cost_per_pack"),
    )
    # sanity notes
    if p.storage != "ambient" and not p.cold_chain:
        p.notes.append(f"No cold chain during transport: product is exposed to ≈{p.transit_temp:.0f} °C for "
                       f"{p.transport_days:g} day(s); this dominates shelf life.")
    if p.chill is not None and p.temp < p.chill:
        p.notes.append(f"Storage at {p.temp:g} °C is below the chilling-injury threshold ({p.chill:g} °C) "
                       f"for {p.name}.")
    if p.cat in DRY_CATS and p.rh > 0.8:
        p.notes.append("Very humid storage (RH > 80 %) — a high moisture barrier is critical.")
    return p


def mech_thickness_ldpe_eq(p: Profile) -> float:
    """Minimum LDPE-equivalent film thickness (µm) for handling/transport abuse."""
    t = (20 + 30 * p.weight_kg ** 0.5) * p.severity
    if p.sharp:
        t *= 1.4
    if p.is_frozen:
        t *= 1.15
    if p.is_liquid:
        t *= 1.15
    return t


def rr_air_at(p: Profile, t_c: float) -> float:
    return ph.rr_air(p.rr, p.rr_temp, p.q10, t_c)
