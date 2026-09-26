"""
Packaging material knowledge base.

Units / reference conditions (industry-standard test methods):
  otr   : Oxygen Transmission Rate, cc(STP)/m²·day·atm at 23 °C, 0 % RH  (ASTM D3985 / ISO 15105-2)
  wvtr  : Water Vapour Transmission Rate, g/m²·day at 38 °C, 90 % RH     (ASTM F1249 / ISO 15106)
  Both are quoted at `ref_um` thickness.  For homogeneous films the transmission
  rate scales inversely with thickness (Fick's first law).

Values are representative mid-range literature / supplier-datasheet figures
(Robertson, *Food Packaging: Principles and Practice*, 3rd ed.; Lee, Yam & Piergiovanni,
*Food Packaging Science and Technology*; Mangaraj et al. 2009; resin supplier datasheets).
They are *indicative* and must be confirmed with the converter's certificate of analysis.

cost_inr_kg : indicative Indian market price of converted film / container material (₹/kg, 2025-26)
co2e_kg     : cradle-to-gate carbon footprint (kg CO2e per kg material; PlasticsEurope eco-profiles,
              European Aluminium, FEVE, ecoinvent averages)
pwm_cat     : Plastic Waste Management (Amendment) Rules 2022, EPR category
              I = rigid plastic, II = flexible mono/multilayer plastic, III = multilayer plastic +
              non-plastic layer, IV = compostable plastic, None = non-plastic
"""
from __future__ import annotations

from copy import deepcopy

# ---------------------------------------------------------------------------
# Base (single-component) materials.  Laminates below are built from these.
# ---------------------------------------------------------------------------
BASE = {
    "ldpe": dict(
        name="Low-Density Polyethylene (LDPE)", short="LDPE", ref_um=25, otr=7800, wvtr=18,
        beta=4.5, ea_o2=40, ea_h2o=35, density=0.92, tensile=12, elongation=500, puncture=3,
        seal=(110, 150), tmin=-50, tmax=80, transparency="translucent", light_block=0.05,
        grease=2, humid_k=0, cost_inr_kg=125, co2e_kg=2.0, recycle="widely", resin_code="4",
        pwm_cat="II", bio_based=False, compostable=None, std="IS 10146", t_range=(15, 200),
        standalone=True,
    ),
    "lldpe": dict(
        name="Linear Low-Density Polyethylene (LLDPE)", short="LLDPE", ref_um=25, otr=7000, wvtr=16,
        beta=4.2, ea_o2=40, ea_h2o=35, density=0.92, tensile=25, elongation=700, puncture=4,
        seal=(105, 145), tmin=-60, tmax=85, transparency="translucent", light_block=0.05,
        grease=3, humid_k=0, cost_inr_kg=130, co2e_kg=1.9, recycle="widely", resin_code="4",
        pwm_cat="II", bio_based=False, compostable=None, std="IS 10146", t_range=(15, 200),
        standalone=True,
    ),
    "hdpe": dict(
        name="High-Density Polyethylene (HDPE)", short="HDPE", ref_um=25, otr=2300, wvtr=6,
        beta=3.5, ea_o2=35, ea_h2o=33, density=0.95, tensile=28, elongation=300, puncture=3,
        seal=(130, 160), tmin=-60, tmax=110, transparency="translucent", light_block=0.15,
        grease=4, humid_k=0, cost_inr_kg=128, co2e_kg=1.8, recycle="widely", resin_code="2",
        pwm_cat="II", bio_based=False, compostable=None, std="IS 10146", t_range=(10, 150),
        standalone=True,
    ),
    "cpp": dict(
        name="Cast Polypropylene (CPP)", short="CPP", ref_um=25, otr=3700, wvtr=10,
        beta=3.3, ea_o2=38, ea_h2o=33, density=0.90, tensile=30, elongation=600, puncture=3,
        seal=(140, 170), tmin=-10, tmax=130, transparency="clear", light_block=0.03,
        grease=4, humid_k=0, cost_inr_kg=140, co2e_kg=1.7, recycle="limited", resin_code="5",
        pwm_cat="II", bio_based=False, compostable=None, std="IS 10910", t_range=(20, 100),
        standalone=True,
    ),
    "bopp": dict(
        name="Biaxially Oriented Polypropylene (BOPP)", short="BOPP", ref_um=20, otr=1800, wvtr=5.5,
        beta=3.8, ea_o2=38, ea_h2o=33, density=0.91, tensile=150, elongation=120, puncture=3,
        seal=(120, 145), tmin=-20, tmax=120, transparency="clear", light_block=0.03,
        grease=4, humid_k=0, cost_inr_kg=160, co2e_kg=1.9, recycle="limited", resin_code="5",
        pwm_cat="II", bio_based=False, compostable=None, std="IS 10910", t_range=(12, 60),
        standalone=True,
    ),
    "bopet": dict(
        name="Biaxially Oriented PET (BOPET)", short="PET", ref_um=12, otr=110, wvtr=45,
        beta=4.0, ea_o2=30, ea_h2o=30, density=1.39, tensile=200, elongation=110, puncture=4,
        seal=None, tmin=-70, tmax=150, transparency="clear", light_block=0.05,
        grease=5, humid_k=0, cost_inr_kg=180, co2e_kg=2.7, recycle="limited", resin_code="1",
        pwm_cat="II", bio_based=False, compostable=None, std="IS 12252", t_range=(12, 36),
        standalone=False,
    ),
    "bopa": dict(
        name="Biaxially Oriented Polyamide (Nylon, BOPA)", short="PA", ref_um=15, otr=30, wvtr=260,
        beta=3.5, ea_o2=35, ea_h2o=25, density=1.14, tensile=220, elongation=100, puncture=5,
        seal=None, tmin=-60, tmax=180, transparency="clear", light_block=0.03,
        grease=5, humid_k=4, cost_inr_kg=360, co2e_kg=8.0, recycle="not recyclable", resin_code="7",
        pwm_cat="II", bio_based=False, compostable=None, std="IS 9845 migration tested", t_range=(12, 30),
        standalone=False,
    ),
    "evoh": dict(
        name="Ethylene-Vinyl Alcohol (EVOH, 32 mol%)", short="EVOH", ref_um=25, otr=0.3, wvtr=50,
        beta=3.0, ea_o2=45, ea_h2o=30, density=1.19, tensile=60, elongation=200, puncture=2,
        seal=None, tmin=-40, tmax=120, transparency="clear", light_block=0.03,
        grease=5, humid_k=12, cost_inr_kg=900, co2e_kg=5.5, recycle="limited", resin_code="7",
        pwm_cat="II", bio_based=False, compostable=None, std="IS 9845 migration tested", t_range=(3, 10),
        standalone=False,
    ),
    "pvdc": dict(
        name="Polyvinylidene Chloride (PVDC) coating", short="PVDC", ref_um=25, otr=5, wvtr=2,
        beta=5.0, ea_o2=50, ea_h2o=45, density=1.70, tensile=70, elongation=60, puncture=2,
        seal=(120, 150), tmin=-20, tmax=100, transparency="clear", light_block=0.03,
        grease=5, humid_k=0, cost_inr_kg=520, co2e_kg=5.0, recycle="not recyclable", resin_code="7",
        pwm_cat="II", bio_based=False, compostable=None, std="IS 9845 migration tested", t_range=(2, 10),
        standalone=False,
    ),
    "pvc_cling": dict(
        name="Plasticised PVC cling film", short="PVC-cling", ref_um=12, otr=9000, wvtr=150,
        beta=4.5, ea_o2=35, ea_h2o=30, density=1.25, tensile=20, elongation=250, puncture=2,
        seal=None, tmin=-20, tmax=70, transparency="clear", light_block=0.02,
        grease=2, humid_k=0, cost_inr_kg=190, co2e_kg=2.4, recycle="not recyclable", resin_code="3",
        pwm_cat="II", bio_based=False, compostable=None, std="IS 10151", t_range=(10, 15),
        standalone=False,
    ),
    "pla": dict(
        name="Polylactic Acid film (PLA)", short="PLA", ref_um=25, otr=550, wvtr=250,
        beta=4.0, ea_o2=30, ea_h2o=20, density=1.25, tensile=60, elongation=10, puncture=2,
        seal=(90, 130), tmin=-10, tmax=50, transparency="clear", light_block=0.03,
        grease=4, humid_k=0, cost_inr_kg=420, co2e_kg=1.8, recycle="industrial compostable", resin_code="7",
        pwm_cat="IV", bio_based=True, compostable="industrial", std="IS/ISO 17088 compostable", t_range=(20, 60),
        standalone=True,
    ),
    "pbat_pla": dict(
        name="Compostable PBAT/PLA blend film", short="PBAT-PLA", ref_um=25, otr=1300, wvtr=170,
        beta=4.0, ea_o2=32, ea_h2o=22, density=1.25, tensile=30, elongation=300, puncture=3,
        seal=(100, 140), tmin=-20, tmax=60, transparency="translucent", light_block=0.05,
        grease=3, humid_k=0, cost_inr_kg=360, co2e_kg=2.8, recycle="industrial compostable", resin_code="7",
        pwm_cat="IV", bio_based=True, compostable="industrial", std="IS/ISO 17088 compostable", t_range=(20, 80),
        standalone=True,
    ),
    "cellulose": dict(
        name="Coated regenerated cellulose (compostable)", short="Cellulose", ref_um=23, otr=3, wvtr=7,
        beta=4.0, ea_o2=30, ea_h2o=30, density=1.44, tensile=100, elongation=20, puncture=2,
        seal=(90, 140), tmin=-20, tmax=180, transparency="clear", light_block=0.03,
        grease=5, humid_k=20, cost_inr_kg=650, co2e_kg=3.0, recycle="home compostable", resin_code=None,
        pwm_cat=None, bio_based=True, compostable="home", std="EN 13432 / IS 17088", t_range=(20, 45),
        standalone=True,
    ),
    "kraft": dict(
        name="Kraft paper", short="Paper", ref_um=90, otr=200000, wvtr=1500,
        beta=0.8, ea_o2=5, ea_h2o=5, density=0.78, tensile=45, elongation=3, puncture=2,
        seal=None, tmin=-40, tmax=180, transparency="opaque", light_block=0.95,
        grease=1, humid_k=0, cost_inr_kg=85, co2e_kg=1.1, recycle="widely", resin_code="PAP 20",
        pwm_cat=None, bio_based=True, compostable="home", std="IS 1397 / food-grade pulp", t_range=(60, 300),
        standalone=True,
    ),
    "paperboard": dict(
        name="Liquid-packaging paperboard", short="Board", ref_um=400, otr=100000, wvtr=800,
        beta=0.8, ea_o2=5, ea_h2o=5, density=0.80, tensile=40, elongation=3, puncture=3,
        seal=None, tmin=-40, tmax=180, transparency="opaque", light_block=0.98,
        grease=1, humid_k=0, cost_inr_kg=95, co2e_kg=1.0, recycle="widely", resin_code="PAP 21",
        pwm_cat=None, bio_based=True, compostable=None, std="Food-grade virgin fibre", t_range=(300, 500),
        standalone=False,
    ),
    "al_foil": dict(
        name="Aluminium foil", short="Al", ref_um=9, otr=0.05, wvtr=0.05,
        beta=1.0, ea_o2=0, ea_h2o=0, density=2.70, tensile=60, elongation=4, puncture=1,
        seal=None, tmin=-196, tmax=400, transparency="opaque", light_block=1.0,
        grease=5, humid_k=0, cost_inr_kg=430, co2e_kg=10.0, recycle="limited", resin_code="ALU 41",
        pwm_cat=None, bio_based=False, compostable=None, std="IS 15392 (food-grade foil)", t_range=(6, 40),
        standalone=False,
    ),
    "met_pet": dict(
        name="Metallised PET", short="MET-PET", ref_um=12, otr=1.0, wvtr=1.0,
        beta=2.0, ea_o2=25, ea_h2o=25, density=1.40, tensile=200, elongation=110, puncture=4,
        seal=None, tmin=-70, tmax=150, transparency="opaque", light_block=0.97,
        grease=5, humid_k=0, cost_inr_kg=225, co2e_kg=3.0, recycle="not recyclable", resin_code="7",
        pwm_cat="II", bio_based=False, compostable=None, std="IS 12252", t_range=(12, 12),
        standalone=False,
    ),
    "met_bopp": dict(
        name="Metallised BOPP", short="MET-BOPP", ref_um=20, otr=25, wvtr=0.3,
        beta=2.5, ea_o2=30, ea_h2o=30, density=0.91, tensile=150, elongation=120, puncture=3,
        seal=(120, 145), tmin=-20, tmax=120, transparency="opaque", light_block=0.95,
        grease=4, humid_k=0, cost_inr_kg=190, co2e_kg=2.2, recycle="limited", resin_code="5",
        pwm_cat="II", bio_based=False, compostable=None, std="IS 10910", t_range=(18, 30),
        standalone=False,
    ),
    "alox_pet": dict(
        name="AlOx-coated transparent barrier PET", short="AlOx-PET", ref_um=12, otr=1.0, wvtr=1.0,
        beta=2.0, ea_o2=25, ea_h2o=25, density=1.40, tensile=200, elongation=110, puncture=4,
        seal=None, tmin=-70, tmax=130, transparency="clear", light_block=0.05,
        grease=5, humid_k=0, cost_inr_kg=320, co2e_kg=3.0, recycle="limited", resin_code="1",
        pwm_cat="II", bio_based=False, compostable=None, std="IS 12252", t_range=(12, 12),
        standalone=False,
    ),
    "mdo_pe": dict(
        name="Machine-direction-oriented PE (MDO-PE)", short="MDO-PE", ref_um=25, otr=3500, wvtr=6,
        beta=4.0, ea_o2=38, ea_h2o=33, density=0.94, tensile=90, elongation=60, puncture=3,
        seal=None, tmin=-50, tmax=100, transparency="clear", light_block=0.03,
        grease=3, humid_k=0, cost_inr_kg=170, co2e_kg=2.0, recycle="widely", resin_code="4",
        pwm_cat="II", bio_based=False, compostable=None, std="IS 10146", t_range=(20, 30),
        standalone=False,
    ),
}

# ---------------------------------------------------------------------------
# Packaging solutions offered to the recommender.
#   kind: mono      -> single film, thickness optimised by the engine
#         laminate  -> multilayer; layers = [(base_id, µm), ...] outer -> inner;
#                      the last (sealant) layer thickness is optimised
#         rigid     -> fixed-wall container (effective values at wall thickness)
#         open      -> ventilated/mesh/woven package, no gas barrier
# family: label used by the ML classifier
# ---------------------------------------------------------------------------
SOLUTIONS = [
    # ------------------------- mono flexible films -------------------------
    dict(id="ldpe", kind="mono", base="ldpe", family="polyolefin_mono", formats=["pillow pouch", "bag", "liner"],
         uses="Milk pouches, grains, pulses, flour, frozen vegetables, bread, produce bags",
         vacuum=False, map_ok=False, liquid_ok=True),
    dict(id="lldpe", kind="mono", base="lldpe", family="polyolefin_mono", formats=["pillow pouch", "FFS bag", "stand-up pouch"],
         uses="Heavy-duty bags, frozen foods, sugar, salt, edible oil pouches (as sealant)",
         vacuum=False, map_ok=False, liquid_ok=True),
    dict(id="hdpe", kind="mono", base="hdpe", family="polyolefin_mono", formats=["bag", "liner", "cereal liner"],
         uses="Cereal box liners, grocery bags, bulk liners",
         vacuum=False, map_ok=False, liquid_ok=False),
    dict(id="cpp", kind="mono", base="cpp", family="polyolefin_mono", formats=["bag", "flow wrap"],
         uses="Bakery, garments, sweets; sealant layer in retort pouches",
         vacuum=False, map_ok=False, liquid_ok=False),
    dict(id="bopp", kind="mono", base="bopp", family="polyolefin_mono", formats=["flow wrap", "bag"],
         uses="Biscuits (single-layer packs), bread, confectionery overwrap",
         vacuum=False, map_ok=False, liquid_ok=False),
    dict(id="pla", kind="mono", base="pla", family="compostable", formats=["bag", "flow wrap", "clamshell lid film"],
         uses="Fresh produce, bakery, salads (short shelf life, chilled)",
         vacuum=False, map_ok=False, liquid_ok=False),
    dict(id="pbat_pla", kind="mono", base="pbat_pla", family="compostable", formats=["bag", "pouch"],
         uses="Produce bags, bakery bags, compostable carry bags",
         vacuum=False, map_ok=False, liquid_ok=False),
    dict(id="cellulose", kind="mono", base="cellulose", family="compostable", formats=["flow wrap", "bag"],
         uses="Confectionery twist wrap, tea, coffee (with liner), dry snacks",
         vacuum=False, map_ok=False, liquid_ok=False),
    dict(id="kraft", kind="mono", base="kraft", family="paper_based", formats=["paper bag", "SOS bag"],
         uses="Flour, sugar, bread (short), take-away",
         vacuum=False, map_ok=False, liquid_ok=False),

    # ------------------------------ laminates ------------------------------
    dict(id="ldpe_coex_milk", kind="laminate", name="3-layer co-ex LDPE milk film (white/black/white)",
         layers=[("ldpe", 20), ("ldpe", 15), ("lldpe", 20)], light_override=0.99, family="polyolefin_mono",
         formats=["FFS pillow pouch"], uses="Pasteurised liquid milk, buttermilk, curd pouches (India)",
         vacuum=False, map_ok=False, liquid_ok=True, recycle_override="widely", pwm_override="II"),
    dict(id="bopp_bopp", kind="laminate", name="BOPP / BOPP (printed)",
         layers=[("bopp", 20), ("bopp", 20)], family="polyolefin_mono",
         formats=["pillow pouch", "center-seal pack"], uses="Biscuits, namkeen, tea (short/medium life)",
         vacuum=False, map_ok=False, liquid_ok=False, recycle_override="limited"),
    dict(id="bopp_metbopp", kind="laminate", name="BOPP / MET-BOPP (mono-PP)",
         layers=[("bopp", 20), ("met_bopp", 20)], family="metallized_laminate",
         formats=["pillow pouch (N2 flush)"], uses="Potato chips, extruded snacks, biscuits, noodles",
         vacuum=False, map_ok=True, liquid_ok=False, recycle_override="limited"),
    dict(id="pet_pe", kind="laminate", name="PET / LDPE",
         layers=[("bopet", 12), ("ldpe", 50)], family="pet_pe_laminate",
         formats=["pouch", "stand-up pouch", "3-side seal"], uses="Spices, pulses, dry fruits, frozen foods, edible oil",
         vacuum=False, map_ok=False, liquid_ok=True),
    dict(id="pet_metpet_pe", kind="laminate", name="PET / MET-PET / LDPE",
         layers=[("bopet", 12), ("met_pet", 12), ("ldpe", 50)], family="metallized_laminate",
         formats=["stand-up pouch", "3-side seal", "N2 flush pouch"], uses="Namkeen, nuts, tea, spices, milk powder (short)",
         vacuum=False, map_ok=True, liquid_ok=True),
    dict(id="pet_al_pe", kind="laminate", name="PET / Al foil / LDPE",
         layers=[("bopet", 12), ("al_foil", 9), ("ldpe", 60)], family="foil_laminate",
         formats=["stand-up pouch", "sachet", "valve bag"], uses="Coffee, milk powder, infant food, spices, pharma-grade",
         vacuum=True, map_ok=True, liquid_ok=True),
    dict(id="pet_al_cpp_retort", kind="laminate", name="PET / Al / CPP retort pouch",
         layers=[("bopet", 12), ("al_foil", 9), ("cpp", 70)], family="retort_pouch",
         formats=["retort pouch"], uses="Ready-to-eat curries, rice, dal (121 °C sterilised, shelf-stable)",
         vacuum=True, map_ok=True, liquid_ok=True, retort=True),
    dict(id="pet_pa_cpp", kind="laminate", name="PET / PA / CPP transparent retort",
         layers=[("bopet", 12), ("bopa", 15), ("cpp", 70)], family="retort_pouch",
         formats=["retort pouch", "microwavable pouch"], uses="Transparent retort meals, sweet corn, microwave packs",
         vacuum=True, map_ok=True, liquid_ok=True, retort=True, microwave=True),
    dict(id="pa_pe_vacuum", kind="laminate", name="PA / LDPE vacuum pouch",
         layers=[("bopa", 15), ("lldpe", 60)], family="vacuum_barrier",
         formats=["vacuum pouch", "thermoformed pack"], uses="Paneer, cheese, processed meat, fish, sweets",
         vacuum=True, map_ok=True, liquid_ok=True),
    dict(id="pe_evoh_pe", kind="laminate", name="PE / tie / EVOH / tie / PE co-extruded",
         layers=[("ldpe", 30), ("evoh", 5), ("lldpe", 40)], family="evoh_high_barrier",
         formats=["shrink bag", "MAP lidding", "vacuum pouch"], uses="Fresh meat, cheese, sauces, long-life chilled foods",
         vacuum=True, map_ok=True, liquid_ok=True, buried=["evoh"]),
    dict(id="mdope_evoh_pe", kind="laminate", name="MDO-PE / EVOH-PE (recyclable mono-PE barrier)",
         layers=[("mdo_pe", 25), ("evoh", 3), ("lldpe", 50)], family="evoh_high_barrier",
         formats=["stand-up pouch", "3-side seal"], uses="Recyclable replacement for PET/PE & PET/MET-PET/PE",
         vacuum=True, map_ok=True, liquid_ok=True, buried=["evoh"], recycle_override="widely", pwm_override="II"),
    dict(id="alox_pet_pe", kind="laminate", name="AlOx-PET / LDPE (transparent high barrier)",
         layers=[("alox_pet", 12), ("ldpe", 60)], family="evoh_high_barrier",
         formats=["lidding", "stand-up pouch", "microwavable pouch"], uses="Transparent high-barrier: RTE, cheese, dry fruits",
         vacuum=True, map_ok=True, liquid_ok=True, microwave=True),
    dict(id="pvdc_bopp", kind="laminate", name="PVDC-coated BOPP",
         layers=[("pvdc", 2), ("bopp", 20)], family="pet_pe_laminate",
         formats=["flow wrap", "overwrap"], uses="Confectionery, crackers, cheese overwrap",
         vacuum=False, map_ok=False, liquid_ok=False),
    dict(id="compostable_barrier", kind="laminate", name="Cellulose / PBAT-PLA compostable laminate",
         layers=[("cellulose", 23), ("pbat_pla", 40)], family="compostable",
         formats=["stand-up pouch", "flow wrap"], uses="Tea, coffee (short), granola, dry snacks — compostable",
         vacuum=False, map_ok=False, liquid_ok=False, buried=["cellulose"], recycle_override="industrial compostable",
         pwm_override="IV"),
    dict(id="paper_pe", kind="laminate", name="Paper / LDPE",
         layers=[("kraft", 70), ("ldpe", 25)], family="paper_based",
         formats=["paper pouch", "SOS bag"], uses="Flour, sugar, bakery, dry snacks (short)",
         vacuum=False, map_ok=False, liquid_ok=False, recycle_override="limited", pwm_override="III"),
    dict(id="paper_al_pe", kind="laminate", name="Paper / Al foil / LDPE",
         layers=[("kraft", 50), ("al_foil", 7), ("ldpe", 25)], family="foil_laminate",
         formats=["wrapper", "sachet"], uses="Butter, chocolate, tea sachets, spice sachets",
         vacuum=False, map_ok=False, liquid_ok=False, pwm_override="III"),
    dict(id="aseptic_carton", kind="laminate", name="Aseptic carton (PE / board / PE / Al / PE)",
         layers=[("ldpe", 15), ("paperboard", 400), ("ldpe", 20), ("al_foil", 6), ("ldpe", 30)],
         family="aseptic_carton", formats=["brick carton"], uses="UHT milk, juices, lassi, soups (ambient 6-12 months)",
         vacuum=False, map_ok=False, liquid_ok=True, rigid_like=True, pwm_override="III", fixed=True),
    dict(id="hermetic_grain", kind="laminate", name="Hermetic multilayer storage bag (PE/barrier/PE)",
         layers=[("hdpe", 40), ("evoh", 4), ("lldpe", 40)], family="hermetic_grain",
         formats=["hermetic liner inside woven sack"], uses="Grains, pulses, seeds, coffee beans — insect control without fumigants",
         vacuum=False, map_ok=False, liquid_ok=False, buried=["evoh"], bulk_only=True),
    dict(id="pp_woven_liner", kind="laminate", name="PP woven sack + LDPE liner",
         layers=[("ldpe", 50)], family="bulk_sack", formats=["25-50 kg sack"],
         uses="Rice, sugar, flour, pulses, salt (bulk)", vacuum=False, map_ok=False, liquid_ok=False,
         bulk_only=True, extra_strength=6.0, extra_mass_gm2=80, fixed=True),

    # ------------------------------- rigid ---------------------------------
    dict(id="glass_jar", kind="rigid", name="Glass jar/bottle with lug cap", wall_um=2500,
         otr_eff=0.05, wvtr_eff=0.02, density=2.5, cost_inr_kg=40, co2e_kg=1.1, family="rigid_glass_metal",
         light_block=0.2, transparency="clear", tmin=-10, tmax=130, recycle="widely", pwm_cat=None,
         resin_code="GL 70", std="IS 1392 (glass containers for food)", uses="Pickles, jams, honey, ghee, sauces, baby food",
         vacuum=True, map_ok=True, liquid_ok=True, retort=True, reusable=True, grease=5, puncture=5, tensile=50),
    dict(id="tin_can", kind="rigid", name="Lacquered tinplate can", wall_um=200,
         otr_eff=0.01, wvtr_eff=0.01, density=7.8, cost_inr_kg=120, co2e_kg=2.4, family="rigid_glass_metal",
         light_block=1.0, transparency="opaque", tmin=-40, tmax=150, recycle="widely", pwm_cat=None,
         resin_code="FE 40", std="IS 1993 tinplate, food-grade lacquer", uses="Ghee, edible oil, infant formula, milk powder, canned food",
         vacuum=True, map_ok=True, liquid_ok=True, retort=True, grease=5, puncture=5, tensile=300),
    dict(id="pet_bottle", kind="rigid", name="PET bottle/jar", wall_um=300,
         otr_eff=3.0, wvtr_eff=1.5, density=1.35, cost_inr_kg=190, co2e_kg=2.7, family="rigid_plastic",
         light_block=0.05, transparency="clear", tmin=-40, tmax=60, recycle="widely", pwm_cat="I",
         resin_code="1", std="IS 12252", uses="Edible oil, water, juices, sauces, dry fruits jars",
         vacuum=False, map_ok=False, liquid_ok=True, grease=5, puncture=4, tensile=55),
    dict(id="hdpe_bottle", kind="rigid", name="HDPE bottle/jar", wall_um=800,
         otr_eff=72, wvtr_eff=0.2, density=0.95, cost_inr_kg=150, co2e_kg=1.8, family="rigid_plastic",
         light_block=0.6, transparency="opaque", tmin=-60, tmax=110, recycle="widely", pwm_cat="I",
         resin_code="2", std="IS 10146", uses="Milk (ESL), oil, ghee, pickles, spices, protein powder",
         vacuum=False, map_ok=False, liquid_ok=True, grease=4, puncture=5, tensile=28),
    dict(id="pp_tub", kind="rigid", name="PP cup/tub with peelable lid", wall_um=500,
         otr_eff=185, wvtr_eff=0.5, density=0.90, cost_inr_kg=170, co2e_kg=1.7, family="rigid_plastic",
         light_block=0.3, transparency="translucent", tmin=-20, tmax=120, recycle="limited", pwm_cat="I",
         resin_code="5", std="IS 10910", uses="Curd/dahi, ice cream, shrikhand, sweets, ready meals",
         vacuum=False, map_ok=False, liquid_ok=True, microwave=True, grease=4, puncture=4, tensile=30),
    dict(id="pp_evoh_tray", kind="rigid", name="PP/EVOH/PP tray + barrier lidding (MAP)", wall_um=450,
         otr_eff=0.8, wvtr_eff=0.4, density=0.95, cost_inr_kg=260, co2e_kg=2.1, family="map_tray",
         light_block=0.3, transparency="translucent", tmin=-40, tmax=121, recycle="limited", pwm_cat="I",
         resin_code="5", std="IS 10910", uses="MAP fresh meat, poultry, fish, paneer, ready meals",
         vacuum=True, map_ok=True, liquid_ok=True, microwave=True, grease=5, puncture=4, tensile=30),
    dict(id="rpet_clamshell", kind="open", name="PET clamshell (vented)", wall_um=250,
         density=1.35, cost_inr_kg=190, co2e_kg=2.7, family="ventilated_rigid", light_block=0.05,
         transparency="clear", tmin=-20, tmax=60, recycle="widely", pwm_cat="I", resin_code="1",
         std="IS 12252", uses="Strawberries, berries, cherry tomatoes, grapes, mushrooms (retail)",
         vent_factor=0.5, liquid_ok=False, grease=4, puncture=4, tensile=55),
    dict(id="molded_pulp_tray", kind="open", name="Molded pulp tray + stretch overwrap", wall_um=1500,
         density=0.35, cost_inr_kg=70, co2e_kg=0.9, family="ventilated_rigid", light_block=0.5,
         transparency="opaque", tmin=-20, tmax=100, recycle="widely", pwm_cat=None, resin_code="PAP 22",
         std="Food-grade virgin/recycled pulp (indirect contact)", uses="Eggs, apples, avocados, tomatoes, fruit trays",
         vent_factor=0.35, liquid_ok=False, grease=1, puncture=3, tensile=10),
    dict(id="pp_leno", kind="open", name="PP/PE leno mesh bag", wall_um=300,
         density=0.3, cost_inr_kg=160, co2e_kg=1.9, family="ventilated_mesh", light_block=0.1,
         transparency="clear", tmin=-30, tmax=80, recycle="limited", pwm_cat="II", resin_code="5",
         std="IS 10910", uses="Onion, potato, garlic, citrus, coconut",
         vent_factor=1.0, liquid_ok=False, grease=2, puncture=4, tensile=40),
    dict(id="jute_bag", kind="open", name="Food-grade jute (gunny) bag", wall_um=1500,
         density=0.4, cost_inr_kg=90, co2e_kg=0.6, family="ventilated_mesh", light_block=0.7,
         transparency="opaque", tmin=-40, tmax=100, recycle="home compostable", pwm_cat=None, resin_code=None,
         std="IS 16186 food-grade jute (JBO-free)", uses="Grains, pulses, potato, onion, sugar (bulk, mandatory for food grains under JPM Act)",
         vent_factor=0.8, liquid_ok=False, grease=1, puncture=4, tensile=30, reusable=True, bulk_only=True),
]

MATERIAL_FAMILIES = {
    "polyolefin_mono": "Mono-material polyolefin film (PE/PP)",
    "compostable": "Bio-based / compostable film",
    "paper_based": "Paper-based",
    "metallized_laminate": "Metallised laminate",
    "pet_pe_laminate": "PET/PE-type laminate",
    "foil_laminate": "Aluminium-foil laminate",
    "retort_pouch": "Retort pouch",
    "vacuum_barrier": "Vacuum barrier pouch",
    "evoh_high_barrier": "EVOH / oxide high-barrier",
    "aseptic_carton": "Aseptic carton",
    "hermetic_grain": "Hermetic grain storage",
    "bulk_sack": "Bulk woven sack",
    "rigid_glass_metal": "Glass / metal container",
    "rigid_plastic": "Rigid plastic container",
    "map_tray": "Barrier tray for MAP",
    "ventilated_rigid": "Ventilated tray / clamshell",
    "ventilated_mesh": "Mesh / jute (ventilated)",
    "breathable_perforated": "Breathable micro-perforated film",
}

STANDARD_GAUGES = [12, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 100, 120, 150, 180, 200]


def _laminate(sol: dict) -> dict:
    """Aggregate a multilayer structure: barrier resistances in series, mass-weighted cost/CO2."""
    layers = sol["layers"]
    otr_res = wvtr_res = 0.0
    mass = cost = co2 = 0.0
    tensile_um = 0.0
    light = 0.0
    grease = 0
    tmin, tmax = -273, 999
    seal = None
    for base_id, um in layers:
        b = BASE[base_id]
        otr = b["otr"] * b["ref_um"] / um
        wvtr = b["wvtr"] * b["ref_um"] / um
        otr_res += 1.0 / otr
        wvtr_res += 1.0 / wvtr
        m = b["density"] * um  # g/m² (density g/cm³ × µm = g/m²)
        mass += m
        cost += m * b["cost_inr_kg"] / 1000
        co2 += m * b["co2e_kg"] / 1000
        tensile_um += b["tensile"] * um
        light = 1 - (1 - light) * (1 - b["light_block"])
        grease = max(grease, b["grease"])
        tmin = max(tmin, b["tmin"])
        tmax = min(tmax, b["tmax"])
    sealant = BASE[layers[-1][0]]
    seal = sealant["seal"]
    total_um = sum(um for _, um in layers)
    extra = sol.get("extra_mass_gm2", 0)
    mass_total = mass + extra
    return dict(
        total_um=total_um,
        otr=1.0 / otr_res,
        wvtr=1.0 / wvtr_res,
        grammage=mass_total,
        cost_inr_m2=cost + extra * 0.16,
        co2e_m2=co2 + extra * 0.0019,
        tensile_eq=tensile_um / total_um,
        light_block=sol.get("light_override", light),
        grease=grease,
        tmin=tmin,
        tmax=tmax,
        seal=seal,
    )


def get_solutions() -> list[dict]:
    """Return fully-resolved solution records (static properties at reference build)."""
    out = []
    for s in SOLUTIONS:
        s = deepcopy(s)
        if s["kind"] == "mono":
            b = BASE[s["base"]]
            s.update(
                name=b["name"], short=b["short"], ref_um=b["ref_um"], otr=b["otr"], wvtr=b["wvtr"],
                beta=b["beta"], density=b["density"], tensile=b["tensile"], elongation=b["elongation"],
                puncture=b["puncture"], seal=b["seal"], tmin=b["tmin"], tmax=b["tmax"],
                transparency=b["transparency"], light_block=b["light_block"], grease=b["grease"],
                cost_inr_kg=b["cost_inr_kg"], co2e_kg=b["co2e_kg"], recycle=b["recycle"],
                resin_code=b["resin_code"], pwm_cat=b["pwm_cat"], bio_based=b["bio_based"],
                compostable=b["compostable"], std=b["std"], t_range=b["t_range"],
                structure=f"{b['short']} (mono-layer)",
            )
        elif s["kind"] == "laminate":
            agg = _laminate(s)
            names = [BASE[b]["short"] for b, _ in s["layers"]]
            sealant = BASE[s["layers"][-1][0]]
            recycle = s.get("recycle_override")
            if recycle is None:
                recycle = "not recyclable" if any(BASE[b]["recycle"] != "widely" for b, _ in s["layers"]) or len(
                    {BASE[b]["resin_code"] for b, _ in s["layers"]}) > 1 else "widely"
            pwm = s.get("pwm_override")
            if pwm is None:
                pwm = "III" if any(BASE[b]["pwm_cat"] is None for b, _ in s["layers"]) else "II"
            s.update(
                short=" / ".join(names), ref_um=agg["total_um"], otr=agg["otr"], wvtr=agg["wvtr"],
                beta=min(BASE[b]["beta"] for b, _ in s["layers"]), density=agg["grammage"] / agg["total_um"],
                tensile=agg["tensile_eq"] * s.get("extra_strength", 1.0), elongation=sealant["elongation"],
                puncture=max(BASE[b]["puncture"] for b, _ in s["layers"]) + (1 if s.get("extra_strength") else 0),
                seal=agg["seal"], tmin=agg["tmin"], tmax=agg["tmax"],
                transparency="opaque" if agg["light_block"] > 0.8 else (
                    "clear" if all(BASE[b]["transparency"] == "clear" for b, _ in s["layers"]) else "translucent"),
                light_block=agg["light_block"], grease=agg["grease"],
                cost_inr_m2=agg["cost_inr_m2"], co2e_m2=agg["co2e_m2"], grammage=agg["grammage"],
                recycle=recycle, resin_code="7" if pwm != "IV" else None, pwm_cat=pwm,
                bio_based=all(BASE[b]["bio_based"] for b, _ in s["layers"]),
                compostable="industrial" if pwm == "IV" else None,
                std=", ".join(sorted({BASE[b]["std"] for b, _ in s["layers"]})),
                structure=" / ".join(f"{BASE[b]['short']} {um} µm" for b, um in s["layers"]),
                t_range=(sealant["t_range"][0], min(150, sealant["t_range"][1])),
            )
        else:  # rigid / open
            s.setdefault("seal", None)
            s.update(short=s["name"], ref_um=s["wall_um"], bio_based=s.get("pwm_cat") is None and s["co2e_kg"] < 1.2,
                     compostable="home" if s.get("recycle") == "home compostable" else None,
                     structure=f"{s['name']} (wall ≈ {s['wall_um']/1000:.2f} mm)", beta=1.0,
                     elongation=None)
            if s["kind"] == "rigid":
                s.update(otr=s["otr_eff"], wvtr=s["wvtr_eff"])
            else:
                s.update(otr=None, wvtr=None)
        s["family_label"] = MATERIAL_FAMILIES.get(s["family"], s["family"])
        out.append(s)
    return out


SOLUTION_INDEX = {s["id"]: s for s in get_solutions()}


def base_for_mono(sol: dict) -> dict:
    return BASE[sol["base"]]
