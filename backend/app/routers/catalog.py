from fastapi import APIRouter, HTTPException

from ..data.commodities import CATEGORIES, COMMODITY_INDEX, search
from ..data.materials import BASE, MATERIAL_FAMILIES, SOLUTION_INDEX, get_solutions
from ..engine.profile import TRANSPORT

router = APIRouter(prefix="/api", tags=["catalog"])


def _commodity_out(c: dict) -> dict:
    return {k: v for k, v in c.items()}


@router.get("/categories")
def categories():
    return [dict(id=k, label=v) for k, v in CATEGORIES.items()]


@router.get("/commodities")
def commodities(q: str | None = None, category: str | None = None):
    return [dict(id=c["id"], name=c["name"], hi=c.get("hi"), category=c["cat"], category_label=CATEGORIES[c["cat"]],
                 storage=c["storage"], respiring=c["rr"] > 0) for c in search(q, category)]


@router.get("/commodities/{cid}")
def commodity(cid: str):
    c = COMMODITY_INDEX.get(cid)
    if not c:
        raise HTTPException(404, "commodity not found")
    return _commodity_out(c)


@router.get("/materials")
def materials():
    out = []
    for s in get_solutions():
        out.append(dict(id=s["id"], name=s.get("name"), short=s.get("short"), kind=s["kind"], family=s["family"],
                        family_label=s["family_label"], structure=s.get("structure"), ref_um=s.get("ref_um"),
                        otr=s.get("otr"), wvtr=s.get("wvtr"), beta=s.get("beta"), tensile=s.get("tensile"),
                        light_block=s.get("light_block"), transparency=s.get("transparency"),
                        tmin=s.get("tmin"), tmax=s.get("tmax"), seal=s.get("seal"), recycle=s.get("recycle"),
                        pwm_cat=s.get("pwm_cat"), resin_code=s.get("resin_code"), bio_based=s.get("bio_based"),
                        compostable=s.get("compostable"), std=s.get("std"), uses=s.get("uses"),
                        formats=s.get("formats"), cost_inr_kg=s.get("cost_inr_kg"), co2e_kg=s.get("co2e_kg"),
                        cost_inr_m2=s.get("cost_inr_m2"), co2e_m2=s.get("co2e_m2"), grammage=s.get("grammage"),
                        map_ok=s.get("map_ok"), vacuum=s.get("vacuum"), retort=s.get("retort", False),
                        microwave=s.get("microwave", False), liquid_ok=s.get("liquid_ok"),
                        standalone=s.get("standalone", True)))
    return out


@router.get("/materials/{sid}")
def material(sid: str):
    s = SOLUTION_INDEX.get(sid)
    if not s:
        raise HTTPException(404, "material not found")
    d = dict(s)
    if s["kind"] == "laminate":
        d["layer_details"] = [dict(id=b, um=um, **{k: BASE[b][k] for k in ("name", "short", "otr", "wvtr", "ref_um")})
                              for b, um in s["layers"]]
    return d


@router.get("/base-polymers")
def base_polymers():
    return [dict(id=k, **{kk: v for kk, v in b.items()}) for k, b in BASE.items()]


@router.get("/families")
def families():
    return [dict(id=k, label=v) for k, v in MATERIAL_FAMILIES.items()]


@router.get("/transport-modes")
def transport_modes():
    return [dict(id=k, **v) for k, v in TRANSPORT.items()]
