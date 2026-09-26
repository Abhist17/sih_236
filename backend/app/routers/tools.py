import math

from fastapi import APIRouter, HTTPException

from ..data.materials import BASE, SOLUTION_INDEX
from ..engine import physics as ph
from ..engine.recommender import analyse_solution, compare
from ..schemas import CompareIn, MapToolIn, ShelfLifeToolIn

router = APIRouter(prefix="/api/tools", tags=["tools"])


@router.post("/shelf-life")
def shelf_life_tool(body: ShelfLifeToolIn):
    try:
        return analyse_solution(body.scenario.model_dump(exclude_none=True), body.solution_id, body.temps)
    except KeyError:
        raise HTTPException(404, "unknown solution")


@router.post("/compare")
def compare_tool(body: CompareIn):
    return compare(body.scenario.model_dump(exclude_none=True), body.solution_ids)


@router.post("/map-design")
def map_design(b: MapToolIn):
    """Stand-alone passive-MAP designer: film permeability + micro-perforations for a target atmosphere."""
    if b.o2_min >= b.o2_max or b.co2_min > b.co2_max:
        raise HTTPException(422, "invalid gas window")
    T = b.storage_temp
    area = b.area_m2 or ph.estimate_area(b.weight_kg, 0.45, 0.4)[0]
    if b.film_otr:
        otr23, beta, ea = b.film_otr, b.film_beta or 4.0, 38
    else:
        base = BASE.get(b.film_id or "ldpe")
        sol = SOLUTION_INDEX.get(b.film_id or "")
        if base is None and sol is None:
            raise HTTPException(404, "unknown film")
        if base is None:
            otr23, beta, ea = sol["otr"] * sol["ref_um"] / b.thickness_um, sol.get("beta", 4), 35
        else:
            otr23 = base["otr"] * base["ref_um"] / b.thickness_um
            beta, ea = base["beta"], base["ea_o2"]
    otr_T = otr23 * ph.arrhenius(ea, 23, T)
    rra = ph.rr_air(b.respiration_rate, b.rr_temp, b.q10, T)
    g_film_o2, g_film_co2 = otr_T * area, otr_T * beta * area
    eq_film = ph.map_equilibrium(rra, b.weight_kg, g_film_o2, g_film_co2)
    t_o2, t_co2 = (b.o2_min + b.o2_max) / 200, (b.co2_min + b.co2_max) / 200
    rr_t = ph.rr_mm(rra, t_o2, t_co2)
    g_need = rr_t * b.weight_kg * 24 / (ph.O2_AIR - t_o2)
    otr_needed_T = g_need / area
    beta_ideal = (ph.O2_AIR - t_o2) / t_co2 if t_co2 > 0 else None
    options = []
    for d in ([b.perf_diameter_um] if b.perf_diameter_um else [60, 80, 100, 150, 200, 300]):
        gh = ph.perforation_conductance("O2", d, b.thickness_um, T)
        n = max(0, math.ceil((g_need - g_film_o2) / gh)) if g_need > g_film_o2 else 0
        go = g_film_o2 + n * gh
        gc = g_film_co2 + n * ph.perforation_conductance("CO2", d, b.thickness_um, T)
        y_o2, y_co2, rr_eq = ph.map_equilibrium(rra, b.weight_kg, go, gc)
        options.append(dict(diameter_um=d, perforations=n, eq_o2=round(y_o2 * 100, 2), eq_co2=round(y_co2 * 100, 2),
                            in_window=b.o2_min * 0.85 <= y_o2 * 100 <= b.o2_max * 1.15 and y_co2 * 100 <= b.co2_max * 1.2 + 0.5,
                            rr_reduction_pct=round((1 - rr_eq / rra) * 100, 1), g_o2=go, g_co2=gc))
    best = next((o for o in options if o["in_window"]), options[0])
    free = b.free_volume_ml or (b.weight_kg * 1000 / 0.45 * 0.3 + b.weight_kg * 400)
    curve = ph.map_transient(rra, b.weight_kg, best["g_o2"], best["g_co2"], free, days=7)
    for o in options:
        o.pop("g_o2"), o.pop("g_co2")
    return dict(
        area_m2=round(area, 4), respiration_at_storage_ml_o2_kg_h=round(rra, 2), film_otr_at_storage=round(otr_T, 1),
        film_only=dict(eq_o2=round(eq_film[0] * 100, 2), eq_co2=round(eq_film[1] * 100, 2)),
        required_film_otr_at_storage=round(otr_needed_T, 0),
        required_film_otr_spec_23c=round(otr_needed_T / ph.arrhenius(ea, 23, T), 0),
        ideal_beta=None if beta_ideal is None else round(beta_ideal, 2), film_beta=beta,
        options=options, recommended=best, transient=curve,
        note=("Film alone meets the requirement — no perforation needed." if best["perforations"] == 0 else
              f"Use {best['perforations']} laser micro-perforations of {best['diameter_um']:.0f} µm per pack."),
    )
