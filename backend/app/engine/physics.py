"""
Physical models used by the recommendation engine.

References
  * Permeation & Arrhenius temperature dependence: Robertson (2013) ch.4; Siracusa (2012) Int J Polym Sci.
  * Moisture-gain shelf life (linear isotherm): Labuza, Mizrahi & Karel (1972); Taoukis et al. (1988).
  * Micro-perforation diffusion: Fishman et al. (1996) J Food Sci 61:956 — effective path L + r.
  * Respiration kinetics: Michaelis-Menten with uncompetitive CO2 inhibition, Lee et al. (1991);
    Fonseca, Oliveira & Brecht (2002) J Food Eng 52:99.
  * Microbial growth vs temperature: Ratkowsky square-root model (Ratkowsky et al. 1982).
"""
from __future__ import annotations

import math

R = 8.314  # J/mol·K
O2_AIR = 0.209
MG_PER_ML_O2 = 1.429
MG_PER_ML_CO2 = 1.977


def k(t_c: float) -> float:
    return t_c + 273.15


def p_sat(t_c: float) -> float:
    """Saturation vapour pressure (Pa). Magnus-Tetens over water / Murphy-Koop approx. over ice."""
    if t_c >= 0:
        return 610.94 * math.exp(17.625 * t_c / (t_c + 243.04))
    return 611.15 * math.exp(22.452 * t_c / (t_c + 272.55))


def arrhenius(ea_kj: float, t_ref_c: float, t_c: float) -> float:
    """Multiplier for a rate/permeability going from t_ref to t (activation energy in kJ/mol)."""
    if not ea_kj:
        return 1.0
    return math.exp(-ea_kj * 1000 / R * (1 / k(t_c) - 1 / k(t_ref_c)))


def humidity_factor(humid_k: float, rh_eff: float) -> float:
    """Plasticisation of hydrophilic barriers (EVOH, PA, cellulose) at high RH.
    Empirical: OTR multiplies by (1 + k·x²), x = (RH − 50 %) / 50 %, 0 below 50 % RH."""
    if not humid_k:
        return 1.0
    x = max(0.0, (rh_eff - 0.5) / 0.5)
    return 1.0 + humid_k * x * x


# ------------------------------------------------------------------ geometry
def estimate_area(net_kg: float, density: float, headspace_ml_per_g: float, rigid: bool = False) -> tuple[float, float]:
    """Package surface area (m²) and headspace (mL) of a pillow pouch / near-cubic container
    holding `net_kg` of product.  Area ≈ 0.066·V^(2/3) m² with V in litres (empirical fit to
    retail pouches: 1 L ↔ 15 × 22 cm two-sided)."""
    product_l = net_kg / max(density, 0.02)
    headspace_ml = headspace_ml_per_g * net_kg * 1000
    vol_l = product_l + headspace_ml / 1000
    coef = 0.060 if rigid else 0.066
    return coef * vol_l ** (2 / 3), headspace_ml


# ------------------------------------------------------------------ gas diffusion through holes
def gas_diffusivity(gas: str, t_c: float) -> float:
    """Binary diffusivity in air, cm²/s (Chapman-Enskog scaling T^1.75)."""
    d20 = {"O2": 0.20, "CO2": 0.16, "H2O": 0.25}[gas]
    return d20 * (k(t_c) / 293.15) ** 1.75


def perforation_conductance(gas: str, diameter_um: float, film_um: float, t_c: float) -> float:
    """Fishman (1996): flow through one hole per unit volume-fraction difference, mL/day."""
    r = diameter_um / 2 * 1e-4  # cm
    L = film_um * 1e-4
    return gas_diffusivity(gas, t_c) * math.pi * r * r / (L + r) * 86400


# ------------------------------------------------------------------ respiration
KM_O2 = 0.02    # Michaelis constant (fraction O2)
KI_CO2 = 0.15   # uncompetitive CO2 inhibition constant (fraction CO2)
RQ = 1.0


def rr_air(rr_ref_mg: float, t_ref: float, q10: float, t_c: float) -> float:
    """Respiration rate in air at temperature t, mL O2 / kg·h (converted from mg CO2/kg·h, RQ = 1)."""
    return rr_ref_mg / MG_PER_ML_CO2 * q10 ** ((t_c - t_ref) / 10.0)


def rr_mm(rr_air_ml: float, y_o2: float, y_co2: float) -> float:
    """Michaelis-Menten O2 consumption with uncompetitive CO2 inhibition, mL O2/kg·h."""
    vm = rr_air_ml * (KM_O2 + O2_AIR) / O2_AIR
    y_o2 = max(y_o2, 0.0)
    return vm * y_o2 / (KM_O2 + y_o2 * (1 + y_co2 / KI_CO2))


def map_equilibrium(rr_air_ml: float, weight_kg: float, g_o2: float, g_co2: float) -> tuple[float, float, float]:
    """Steady-state headspace (O2, CO2 fractions, actual RR) for a package with total O2/CO2
    conductances g (mL/day per unit fraction difference).  Solved by bisection on O2."""
    if g_o2 <= 0:
        return 0.0, 0.3, 0.0

    def co2_for(rr):
        return min(0.9, RQ * rr * weight_kg * 24 / max(g_co2, 1e-9))

    def f(y):
        yc = 0.0
        rr = rr_mm(rr_air_ml, y, 0)
        for _ in range(6):
            yc = co2_for(rr)
            rr = rr_mm(rr_air_ml, y, yc)
        return g_o2 * (O2_AIR - y) - rr * weight_kg * 24, yc, rr

    lo, hi = 1e-6, O2_AIR
    for _ in range(50):
        mid = (lo + hi) / 2
        val, _, _ = f(mid)
        if val > 0:
            lo = mid
        else:
            hi = mid
    y = (lo + hi) / 2
    _, yc, rr = f(y)
    return y, yc, rr


def map_transient(rr_air_ml: float, weight_kg: float, g_o2: float, g_co2: float, free_vol_ml: float,
                  days: float = 7.0, y0_o2: float = O2_AIR, y0_co2: float = 0.0, points: int = 60):
    """Explicit-Euler integration of headspace O2/CO2 (%) versus time (h)."""
    free_vol_ml = max(free_vol_ml, 20.0)
    total_rate = g_o2 + g_co2 + rr_air_ml * weight_kg * 24 / 0.02
    dt = min(0.01, 0.2 * free_vol_ml / max(total_rate, 1e-9))
    steps = int(days / dt)
    every = max(1, steps // points)
    y_o2, y_co2 = y0_o2, y0_co2
    out = []
    for i in range(steps + 1):
        if i % every == 0:
            out.append({"h": round(i * dt * 24, 1), "o2": round(y_o2 * 100, 2), "co2": round(y_co2 * 100, 2)})
        rr = rr_mm(rr_air_ml, y_o2, y_co2) * weight_kg * 24  # mL/day
        d_o2 = (g_o2 * (O2_AIR - y_o2) - rr) / free_vol_ml
        d_co2 = (RQ * rr - g_co2 * y_co2) / free_vol_ml
        y_o2 = min(O2_AIR, max(0.0, y_o2 + d_o2 * dt))
        y_co2 = min(1.0, max(0.0, y_co2 + d_co2 * dt))
    return out


# ------------------------------------------------------------------ microbial
def ratkowsky_factor(t_ref: float, t_c: float, t_min: float) -> float:
    """Shelf-life multiplier going from t_ref to t (life ∝ 1/μ, √μ = b(T − Tmin))."""
    if t_c <= t_min + 0.5:
        return 20.0
    return ((t_ref - t_min) / (t_c - t_min)) ** 2


def q10_factor(q10: float, t_ref: float, t_c: float) -> float:
    """Shelf-life multiplier from t_ref to t for a Q10-driven deterioration."""
    return q10 ** ((t_ref - t_c) / 10.0)
