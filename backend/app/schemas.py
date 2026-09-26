from typing import Literal

from pydantic import BaseModel, Field


class RecommendInput(BaseModel):
    """Inputs of the recommendation engine. Only `commodity_id` or composition fields are required;
    everything else falls back to knowledge-base defaults."""
    commodity_id: str | None = Field(None, description="Knowledge-base commodity id (e.g. 'tomato'); omit for custom")
    name: str | None = Field(None, max_length=120)
    category: str | None = None
    state: Literal["solid", "liquid", "paste", "powder", "granular"] | None = None
    moisture: float | None = Field(None, ge=0, le=99.9, description="% wet basis")
    fat: float | None = Field(None, ge=0, le=100)
    protein: float | None = Field(None, ge=0, le=100)
    ph: float | None = Field(None, ge=1, le=14)
    aw: float | None = Field(None, ge=0.05, le=1.0)
    respiration_rate: float | None = Field(None, ge=0, le=500, description="mg CO2/kg·h")
    respiration_temp: float | None = Field(None, ge=-5, le=40)
    desired_shelf_life_days: float | None = Field(None, gt=0, le=3650)
    storage_type: Literal["ambient", "chilled", "frozen"] | None = None
    storage_temp: float | None = Field(None, ge=-40, le=50)
    rh: float | None = Field(None, ge=10, le=100, description="% relative humidity")
    transport: Literal["local", "regional", "long_road", "rail", "sea_export", "air_export"] | None = None
    cold_chain: bool | None = None
    net_weight_kg: float | None = Field(None, gt=0, le=100)
    package_area_m2: float | None = Field(None, gt=0, le=5)
    headspace_ml: float | None = Field(None, ge=0, le=100000)
    process: Literal["none", "pasteurised", "hot_fill", "retort", "aseptic"] | None = None
    retail_display: bool | None = True
    require_transparency: bool | None = False
    require_microwavable: bool | None = False
    recyclable_only: bool | None = False
    compostable_only: bool | None = False
    max_cost_per_pack: float | None = Field(None, gt=0)
    priority: Literal["balanced", "performance", "cost", "eco"] | None = "balanced"
    o2_tolerance: float | None = Field(None, gt=0, description="mg O2/kg absorbable before failure")
    light_sensitivity: float | None = Field(None, ge=0, le=1)
    aw_critical: float | None = Field(None, gt=0, lt=1)
    map_o2_min: float | None = Field(None, ge=0, le=21)
    map_o2_max: float | None = Field(None, ge=0, le=21)
    map_co2_min: float | None = Field(None, ge=0, le=100)
    map_co2_max: float | None = Field(None, ge=0, le=100)
    top_n: int | None = Field(5, ge=1, le=10)


class FeedbackIn(BaseModel):
    solution_id: str
    rating: int = Field(..., ge=1, le=5)
    observed_shelf_life_days: float | None = Field(None, gt=0)
    notes: str | None = Field(None, max_length=2000)


class CompareIn(BaseModel):
    scenario: RecommendInput
    solution_ids: list[str] = Field(..., min_length=1, max_length=8)


class ShelfLifeToolIn(BaseModel):
    scenario: RecommendInput
    solution_id: str
    temps: list[float] | None = None


class MapToolIn(BaseModel):
    respiration_rate: float = Field(..., gt=0, description="mg CO2/kg·h at rr_temp")
    rr_temp: float = 5
    q10: float = Field(2.5, gt=1, le=5)
    storage_temp: float = Field(5, ge=-2, le=35)
    weight_kg: float = Field(0.5, gt=0, le=50)
    area_m2: float | None = Field(None, gt=0, le=5)
    film_id: str | None = "ldpe"
    film_otr: float | None = Field(None, gt=0, description="custom film OTR cc/m²·day·atm at 23 °C")
    film_beta: float | None = Field(None, gt=0)
    thickness_um: float = Field(25, gt=5, le=300)
    o2_min: float = 2
    o2_max: float = 5
    co2_min: float = 3
    co2_max: float = 8
    perf_diameter_um: float | None = Field(None, gt=10, le=10000)
    free_volume_ml: float | None = None


class ActorIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    role: str
    org: str | None = Field(None, max_length=160)
    location: str | None = Field(None, max_length=160)


class BatchIn(BaseModel):
    rec_id: str | None = None
    scenario: RecommendInput | None = None
    solution_id: str | None = None
    quantity: float = Field(..., gt=0)
    unit: str = Field("packs", max_length=20)
    pack_date: str | None = None
    origin: str | None = Field(None, max_length=160)
    notes: str | None = Field(None, max_length=1000)


class EventIn(BaseModel):
    event: Literal["harvested", "packed", "dispatched", "in_transit", "received", "stored", "retail", "sold",
                   "quality_check", "temperature_log", "recalled"]
    location: str | None = Field(None, max_length=160)
    temperature_c: float | None = Field(None, ge=-50, le=70)
    rh: float | None = Field(None, ge=0, le=100)
    duration_h: float | None = Field(None, ge=0, le=24 * 365)
    notes: str | None = Field(None, max_length=1000)
    quality: dict | None = None


class MaterialCertIn(BaseModel):
    material_id: str
    supplier_lot: str = Field(..., max_length=80)
    measured_otr: float | None = None
    measured_wvtr: float | None = None
    thickness_um: float | None = None
    migration_test_pass: bool | None = None
    certificate_ref: str | None = Field(None, max_length=200)
    batch_id: str | None = None
