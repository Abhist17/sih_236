"""
Food commodity knowledge base (Indian market focus).

Field glossary
  cat        : commodity class (drives the physical model that applies)
  state      : solid | liquid | paste | powder | granular
  moisture   : % wet basis;  fat / protein : %;  ph ;  aw : water activity
  rr         : respiration rate, mg CO2 / kg·h measured at t_opt (Kader 2002 classes:
               very low <5, low 5-10, moderate 10-20, high 20-40, very high 40-60, extreme >60)
  q10        : temperature quotient of respiration / deterioration
  eth        : ethylene production class;  eth_sens : sensitive to ethylene
  t_opt/rh_opt : recommended storage temperature (°C) / relative humidity (%)
  chill      : chilling-injury threshold (°C) or None
  o2, co2    : recommended MAP/CA window (% O2, % CO2) for fresh produce (Kader; Saltveit 2003)
  map_gas    : recommended flush composition for non-respiring foods (Robertson 2013; Sivertsvik 2002)
  map_benefit: shelf-life multiplier achievable with MAP / vacuum at t_opt
  o2_tol     : oxygen that can be absorbed before quality failure (mg O2 / kg food) — calibrated so
               reference packages reproduce known commercial shelf lives
  light      : light sensitivity 0-1 (photo-oxidation, colour fading, riboflavin loss)
  aw_c, b    : critical water activity & linear sorption-isotherm slope (g water / g dry solid per unit aw)
               used in the Labuza moisture-gain model
  max_wl     : max acceptable weight (moisture) loss, %
  transp     : transpiration coefficient, mg / kg·s·MPa (Sastry & Buffington; Kader 2002)
  base_life  : storage life (days) at t_opt in a non-modified, food-grade package
  tmin_r     : Ratkowsky Tmin (°C) for the dominant spoilage flora
  intrinsic  : intrinsic quality life at 25 °C independent of package (days), e.g. atta lipolysis
  insect     : prone to insect infestation during storage
  sharp      : product has bones/edges that puncture films
  density    : bulk density kg/L;  headspace : typical headspace mL per g of product
  food_co2e  : cradle-to-farm-gate footprint, kg CO2e / kg (Poore & Nemecek 2018 averages)
All values are indicative literature values and should be validated for a specific cultivar/recipe.
"""
from __future__ import annotations

CATEGORIES = {
    "fruit": "Fresh fruit",
    "vegetable": "Fresh vegetable",
    "leafy": "Leafy greens & herbs",
    "fresh_cut": "Fresh-cut / minimally processed",
    "root_bulb": "Roots, tubers & bulbs",
    "dairy_liquid": "Liquid dairy",
    "dairy_fresh": "Fresh dairy (paneer, curd, cheese)",
    "dairy_fat": "Ghee & butter",
    "dairy_powder": "Dairy & infant powders",
    "meat": "Meat & poultry",
    "seafood": "Fish & seafood",
    "bakery": "Bread & bakery",
    "snack": "Fried & extruded snacks",
    "biscuit": "Biscuits, cereals & confectionery",
    "grain": "Cereal grains & pulses",
    "flour": "Flours & milled products",
    "sugar_salt": "Sugar, salt & jaggery",
    "spice": "Spices, tea & coffee",
    "dry_fruit": "Dry fruits & nuts",
    "dehydrated": "Dehydrated foods & powders",
    "oil": "Edible oils",
    "sauce": "Pickles, sauces & preserves",
    "beverage": "Juices & beverages",
    "rte": "Ready-to-eat / retort meals",
    "frozen": "Frozen foods",
    "egg": "Eggs",
    "batter": "Fermented batters",
}

PRODUCE_CATS = {"fruit", "vegetable", "leafy", "fresh_cut", "root_bulb"}
DRY_CATS = {"snack", "biscuit", "grain", "flour", "sugar_salt", "spice", "dry_fruit", "dehydrated", "dairy_powder"}
PERISHABLE_CATS = {"dairy_liquid", "dairy_fresh", "meat", "seafood", "bakery", "batter"}

_DEFAULTS = dict(
    state="solid", moisture=10.0, fat=1.0, protein=2.0, ph=6.0, aw=0.9, rr=0.0, q10=2.5, eth="none",
    eth_sens=False, climacteric=False, t_opt=25.0, rh_opt=65.0, chill=None, o2=None, co2=None, map_gas=None,
    map_benefit=1.0, o2_tol=None, light=0.1, aw_c=None, b=None, max_wl=None, transp=None, base_life=None,
    tmin_r=None, intrinsic=None, insect=False, sharp=False, density=0.6, headspace=0.3, food_co2e=1.5,
    storage="ambient", process="none", fragile=False, degassing=False, desired=90, hi="",
)


def C(id, name, cat, **kw):
    d = dict(_DEFAULTS)
    d.update(kw)
    d.update(id=id, name=name, cat=cat)
    return d


def _produce(id, name, cat, hi, rr, t_opt, o2, co2, base_life, transp, max_wl=5.0, chill=None, eth="low",
             eth_sens=False, climacteric=False, rh=92, q10=2.5, moisture=88, density=0.45, **kw):
    return C(id, name, cat, hi=hi, rr=rr, t_opt=t_opt, o2=o2, co2=co2, base_life=base_life, transp=transp,
             max_wl=max_wl, chill=chill, eth=eth, eth_sens=eth_sens, climacteric=climacteric, rh_opt=rh,
             q10=q10, moisture=moisture, aw=0.98, ph=kw.pop("ph", 5.5), fat=kw.pop("fat", 0.3),
             protein=kw.pop("protein", 1.0), storage="chilled" if t_opt < 15 else "ambient", density=density,
             headspace=0.4, desired=max(3, int(base_life * 0.7)), food_co2e=kw.pop("food_co2e", 0.6), **kw)


COMMODITIES = [
    # ============================== FRUITS =================================
    _produce("apple", "Apple", "fruit", "सेब", rr=4, t_opt=1, o2=(1, 3), co2=(1, 5), base_life=90, transp=42,
             eth="very high", eth_sens=True, climacteric=True, rh=92, ph=3.5, moisture=85, density=0.55, max_wl=5),
    _produce("banana", "Banana (green-mature)", "fruit", "केला", rr=20, t_opt=13.5, o2=(2, 5), co2=(2, 5), base_life=21,
             transp=136, chill=12, eth="moderate", eth_sens=True, climacteric=True, rh=92, ph=5.0, moisture=75, food_co2e=0.9),
    _produce("mango", "Mango (Alphonso/Kesar)", "fruit", "आम", rr=15, t_opt=12, o2=(3, 7), co2=(5, 8), base_life=21,
             transp=60, chill=10, eth="moderate", eth_sens=True, climacteric=True, rh=90, ph=4.0, moisture=83),
    _produce("tomato", "Tomato (breaker/turning)", "vegetable", "टमाटर", rr=12, t_opt=12, o2=(3, 5), co2=(2, 3),
             base_life=14, transp=140, chill=10, eth="high", eth_sens=True, climacteric=True, rh=90, ph=4.3, moisture=94,
             food_co2e=1.4),
    _produce("strawberry", "Strawberry", "fruit", "स्ट्रॉबेरी", rr=15, t_opt=1, o2=(5, 10), co2=(15, 20), base_life=7,
             transp=700, eth="low", rh=93, ph=3.4, moisture=91, max_wl=6, q10=3.0, fragile=True),
    _produce("grapes", "Table grapes", "fruit", "अंगूर", rr=3, t_opt=0.5, o2=(2, 5), co2=(1, 3), base_life=45, transp=79,
             eth="very low", rh=92, ph=3.5, moisture=81, max_wl=4),
    _produce("pomegranate", "Pomegranate (Bhagwa)", "fruit", "अनार", rr=6, t_opt=6, o2=(3, 5), co2=(5, 10), base_life=60,
             transp=100, chill=5, eth="very low", rh=92, ph=3.8, moisture=78, max_wl=6),
    _produce("guava", "Guava", "fruit", "अमरूद", rr=12, t_opt=8, o2=(3, 5), co2=(2, 5), base_life=14, transp=100, chill=5,
             eth="moderate", eth_sens=True, climacteric=True, rh=90, ph=4.2, moisture=81),
    _produce("papaya", "Papaya", "fruit", "पपीता", rr=12, t_opt=12, o2=(2, 5), co2=(5, 8), base_life=14, transp=100,
             chill=7, eth="moderate", eth_sens=True, climacteric=True, rh=90, ph=5.4, moisture=88),
    _produce("orange", "Orange / Kinnow mandarin", "fruit", "संतरा / किन्नू", rr=5, t_opt=6, o2=(5, 10), co2=(0, 5),
             base_life=56, transp=117, chill=4, eth="very low", rh=92, ph=3.6, moisture=87, max_wl=6),
    _produce("litchi", "Litchi", "fruit", "लीची", rr=12, t_opt=3, o2=(3, 5), co2=(3, 5), base_life=25, transp=300,
             eth="low", rh=93, ph=4.5, moisture=82, max_wl=3),
    _produce("cherry", "Sweet cherry", "fruit", "चेरी", rr=8, t_opt=0.5, o2=(3, 10), co2=(10, 15), base_life=14,
             transp=200, eth="very low", rh=92, ph=3.9, moisture=82),
    _produce("kiwi", "Kiwifruit", "fruit", "कीवी", rr=3, t_opt=0.5, o2=(1, 2), co2=(3, 5), base_life=90, transp=50,
             eth="low", eth_sens=True, climacteric=True, rh=92, ph=3.4, moisture=83),
    _produce("pineapple", "Pineapple", "fruit", "अनानास", rr=8, t_opt=10, o2=(2, 5), co2=(5, 10), base_life=21,
             transp=50, chill=7, eth="low", rh=90, ph=3.7, moisture=86, sharp=True),
    _produce("avocado", "Avocado", "fruit", "एवोकाडो", rr=20, t_opt=6, o2=(2, 5), co2=(3, 10), base_life=21, transp=60,
             chill=5, eth="high", eth_sens=True, climacteric=True, rh=90, ph=6.3, moisture=73, fat=15),
    _produce("sapota", "Sapota (chikoo)", "fruit", "चीकू", rr=15, t_opt=12, o2=(5, 10), co2=(5, 10), base_life=14,
             transp=100, chill=10, eth="high", eth_sens=True, climacteric=True, rh=90, ph=5.5, moisture=74),
    # ============================ VEGETABLES ================================
    _produce("broccoli", "Broccoli", "vegetable", "ब्रोकली", rr=25, t_opt=1, o2=(1, 2), co2=(5, 10), base_life=14,
             transp=1500, eth="very low", eth_sens=True, rh=97, ph=6.3, moisture=89, max_wl=4, q10=3.0),
    _produce("cauliflower", "Cauliflower", "vegetable", "फूलगोभी", rr=12, t_opt=1, o2=(2, 5), co2=(2, 5), base_life=21,
             transp=500, eth="very low", eth_sens=True, rh=95, ph=6.0, moisture=92, max_wl=5),
    _produce("cabbage", "Cabbage", "vegetable", "पत्ता गोभी", rr=5, t_opt=1, o2=(2, 3), co2=(3, 6), base_life=90,
             transp=223, eth="very low", eth_sens=True, rh=95, ph=6.2, moisture=92, max_wl=7),
    _produce("okra", "Okra (bhindi)", "vegetable", "भिंडी", rr=40, t_opt=10, o2=(15, 21), co2=(4, 10), base_life=8,
             transp=800, chill=7, eth="low", rh=92, ph=6.5, moisture=90, max_wl=5, q10=3.0),
    _produce("green_chilli", "Green chilli", "vegetable", "हरी मिर्च", rr=12, t_opt=8, o2=(3, 5), co2=(0, 5), base_life=14,
             transp=300, chill=7, eth="low", rh=92, ph=5.8, moisture=88, max_wl=5),
    _produce("capsicum", "Capsicum / bell pepper", "vegetable", "शिमला मिर्च", rr=10, t_opt=8, o2=(2, 5), co2=(2, 5),
             base_life=18, transp=90, chill=7, eth="low", rh=93, ph=5.2, moisture=92, max_wl=6),
    _produce("cucumber", "Cucumber", "vegetable", "खीरा", rr=10, t_opt=11, o2=(3, 5), co2=(0, 5), base_life=12, transp=150,
             chill=7, eth="low", eth_sens=True, rh=93, ph=5.6, moisture=96, max_wl=5),
    _produce("sweet_corn", "Sweet corn (cob)", "vegetable", "मीठा मक्का", rr=40, t_opt=1, o2=(2, 4), co2=(5, 10),
             base_life=6, transp=200, eth="very low", rh=96, ph=6.8, moisture=76, max_wl=4, q10=3.0),
    _produce("peas_pod", "Green peas (in pod)", "vegetable", "हरी मटर", rr=30, t_opt=1, o2=(2, 3), co2=(2, 5),
             base_life=10, transp=1000, eth="very low", rh=96, ph=6.5, moisture=79, max_wl=4, q10=3.0),
    _produce("mushroom", "Button mushroom", "vegetable", "मशरूम", rr=35, t_opt=1, o2=(3, 21), co2=(5, 15), base_life=6,
             transp=1000, eth="very low", rh=95, ph=6.5, moisture=92, max_wl=5, q10=3.0, protein=3.1),
    _produce("asparagus", "Asparagus", "vegetable", "शतावरी", rr=40, t_opt=1, o2=(15, 21), co2=(5, 10), base_life=14,
             transp=1000, eth="very low", rh=97, ph=6.0, moisture=93, max_wl=5, q10=3.0),
    # ============================== LEAFY ===================================
    _produce("lettuce", "Lettuce (crisphead)", "leafy", "लेट्यूस", rr=8, t_opt=1, o2=(1, 5), co2=(0, 2), base_life=14,
             transp=7400, eth="very low", eth_sens=True, rh=97, ph=6.0, moisture=95, max_wl=3),
    _produce("spinach", "Spinach (palak)", "leafy", "पालक", rr=20, t_opt=1, o2=(7, 10), co2=(5, 10), base_life=10,
             transp=2500, eth="very low", eth_sens=True, rh=97, ph=6.5, moisture=91, max_wl=3, q10=3.0),
    _produce("coriander", "Coriander / fresh herbs", "leafy", "धनिया", rr=30, t_opt=1, o2=(5, 10), co2=(4, 6), base_life=14,
             transp=3000, eth="very low", eth_sens=True, rh=97, ph=6.0, moisture=87, max_wl=3, q10=3.0),
    _produce("methi", "Fenugreek leaves (methi)", "leafy", "मेथी", rr=30, t_opt=1, o2=(5, 10), co2=(4, 8), base_life=7,
             transp=3000, eth="very low", eth_sens=True, rh=97, ph=6.2, moisture=86, max_wl=3, q10=3.0),
    # ============================ FRESH-CUT =================================
    _produce("fresh_salad", "Fresh-cut salad mix", "fresh_cut", "कटा सलाद", rr=20, t_opt=3, o2=(1, 3), co2=(5, 10),
             base_life=7, transp=3000, eth="very low", eth_sens=True, rh=95, ph=6.0, moisture=94, max_wl=3, q10=3.0,
             tmin_r=-5),
    _produce("cut_fruit", "Fresh-cut fruit (apple/pineapple)", "fresh_cut", "कटे फल", rr=8, t_opt=3, o2=(1, 3),
             co2=(5, 10), base_life=7, transp=300, eth="low", rh=95, ph=3.8, moisture=86, max_wl=3, tmin_r=-5),
    _produce("baby_corn", "Baby corn (peeled)", "fresh_cut", "बेबी कॉर्न", rr=45, t_opt=1, o2=(2, 5), co2=(5, 10),
             base_life=10, transp=500, eth="very low", rh=95, ph=6.5, moisture=89, max_wl=4, q10=3.0),
    # =========================== ROOTS & BULBS ==============================
    _produce("potato", "Potato (table)", "root_bulb", "आलू", rr=6, t_opt=8, o2=None, co2=None, base_life=150, transp=44,
             chill=4, q10=1.6, eth="very low", rh=92, ph=5.8, moisture=79, max_wl=7, density=0.67, food_co2e=0.5),
    _produce("onion", "Onion (cured, dry)", "root_bulb", "प्याज", rr=8, t_opt=27, o2=None, co2=None, base_life=120,
             transp=60, q10=1.5, eth="very low", rh=68, ph=5.5, moisture=89, max_wl=15, density=0.65, food_co2e=0.5),
    _produce("garlic", "Garlic (cured)", "root_bulb", "लहसुन", rr=6, t_opt=25, o2=None, co2=None, base_life=150,
             transp=50, q10=1.5, eth="very low", rh=65, ph=5.8, moisture=62, max_wl=10, density=0.5),
    _produce("carrot", "Carrot (topped)", "root_bulb", "गाजर", rr=10, t_opt=1, o2=None, co2=None, base_life=120,
             transp=1207, eth="very low", eth_sens=True, rh=97, ph=6.0, moisture=88, max_wl=8, density=0.6),
    _produce("ginger", "Ginger (fresh)", "root_bulb", "अदरक", rr=5, t_opt=13, o2=None, co2=None, base_life=120,
             transp=150, chill=12, eth="very low", rh=65, ph=6.0, moisture=79, max_wl=10, density=0.55),

    # ============================== DAIRY ===================================
    C("milk", "Pasteurised toned milk", "dairy_liquid", hi="पाश्चुरीकृत दूध", state="liquid", moisture=88, fat=3.0,
      protein=3.2, ph=6.7, aw=0.99, t_opt=4, rh_opt=85, base_life=3, tmin_r=-7, light=0.9, density=1.03,
      headspace=0.03, storage="chilled", process="pasteurised", food_co2e=1.4, max_wl=1, desired=2),
    C("uht_milk", "UHT milk", "dairy_liquid", hi="यूएचटी दूध", state="liquid", moisture=88, fat=3.0, protein=3.2,
      ph=6.7, aw=0.99, t_opt=25, o2_tol=45, light=0.8, density=1.03, headspace=0.05, process="aseptic",
      intrinsic=240, food_co2e=1.4, max_wl=1, desired=180),
    C("curd", "Curd / dahi", "dairy_fresh", hi="दही", state="paste", moisture=85, fat=3.5, protein=3.5, ph=4.4,
      aw=0.99, t_opt=4, rh_opt=85, base_life=10, tmin_r=-2, light=0.3, density=1.05, headspace=0.1,
      storage="chilled", process="pasteurised", food_co2e=1.6, max_wl=2, desired=10),
    C("paneer", "Paneer", "dairy_fresh", hi="पनीर", state="solid", moisture=55, fat=22, protein=18, ph=5.8,
      aw=0.97, t_opt=4, rh_opt=85, base_life=6, tmin_r=-7, map_benefit=3.0, map_gas={"CO2": 50, "N2": 50},
      light=0.3, density=1.0, headspace=0.05, storage="chilled", food_co2e=6.0, max_wl=3, desired=15),
    C("cheese", "Cheddar / processed cheese block", "dairy_fresh", hi="चीज़", state="solid", moisture=38, fat=32,
      protein=25, ph=5.3, aw=0.93, t_opt=5, rh_opt=85, base_life=40, tmin_r=-5, map_benefit=3.0,
      map_gas={"CO2": 30, "N2": 70}, o2_tol=900, light=0.5, density=1.1, headspace=0.05, storage="chilled",
      food_co2e=13.0, max_wl=4, desired=120),
    C("ghee", "Ghee (clarified butter)", "dairy_fat", hi="घी", state="paste", moisture=0.3, fat=99.5, protein=0,
      ph=6.0, aw=0.3, t_opt=25, o2_tol=450, light=0.7, density=0.91, headspace=0.05, map_gas={"N2": 100},
      food_co2e=12.0, desired=270),
    C("butter", "Table butter", "dairy_fat", hi="मक्खन", state="solid", moisture=16, fat=81, protein=0.8, ph=6.2,
      aw=0.93, t_opt=4, rh_opt=80, base_life=120, tmin_r=-3, o2_tol=600, light=0.8, density=0.95, headspace=0.02,
      storage="chilled", food_co2e=9.0, max_wl=2, desired=120),
    C("milk_powder", "Whole milk powder", "dairy_powder", hi="दूध पाउडर", state="powder", moisture=3, fat=26,
      protein=26, ph=6.6, aw=0.2, aw_c=0.4, b=0.15, o2_tol=90, light=0.5, density=0.5, headspace=0.6,
      map_gas={"N2": 100}, food_co2e=9.0, desired=365),
    C("infant_formula", "Infant formula", "dairy_powder", hi="शिशु आहार", state="powder", moisture=2.5, fat=27,
      protein=12, ph=6.8, aw=0.2, aw_c=0.35, b=0.15, o2_tol=40, light=0.6, density=0.5, headspace=0.6,
      map_gas={"N2": 100}, food_co2e=8.0, desired=540),
    C("ice_cream", "Ice cream", "frozen", hi="आइसक्रीम", state="paste", moisture=62, fat=10, protein=3.8, ph=6.5,
      aw=0.97, t_opt=-20, base_life=240, light=0.3, density=0.55, headspace=0.1, storage="frozen", q10=3.0,
      max_wl=3, food_co2e=3.5, desired=180),

    # ========================== MEAT & SEAFOOD ==============================
    C("chicken", "Fresh chicken (cut, skin-on)", "meat", hi="चिकन", moisture=74, fat=6, protein=19, ph=6.1, aw=0.99,
      t_opt=2, rh_opt=90, base_life=5, tmin_r=-8, map_benefit=2.2, map_gas={"CO2": 30, "N2": 70}, sharp=True,
      density=0.8, headspace=1.0, storage="chilled", food_co2e=6.0, max_wl=2, desired=10),
    C("mutton", "Fresh mutton / red meat", "meat", hi="मटन", moisture=72, fat=10, protein=20, ph=5.7, aw=0.99,
      t_opt=1, rh_opt=90, base_life=6, tmin_r=-8, map_benefit=2.0, map_gas={"O2": 70, "CO2": 30}, sharp=True,
      density=0.9, headspace=1.2, storage="chilled", food_co2e=24.0, max_wl=2, desired=12),
    C("fish_lean", "Fresh fish, lean (rohu, pomfret)", "seafood", hi="ताज़ी मछली", moisture=78, fat=2, protein=18,
      ph=6.6, aw=0.99, t_opt=0, rh_opt=95, base_life=8, tmin_r=-10, map_benefit=1.8,
      map_gas={"CO2": 40, "O2": 30, "N2": 30}, sharp=True, density=0.85, headspace=1.5, storage="chilled",
      food_co2e=5.0, max_wl=3, desired=12),
    C("fish_fatty", "Fresh fish, fatty (mackerel, sardine)", "seafood", hi="बांगड़ा / सार्डिन", moisture=70, fat=12,
      protein=19, ph=6.4, aw=0.99, t_opt=0, rh_opt=95, base_life=6, tmin_r=-10, map_benefit=1.7,
      map_gas={"CO2": 60, "N2": 40}, o2_tol=250, sharp=True, density=0.85, headspace=1.5, storage="chilled",
      food_co2e=4.0, max_wl=3, desired=10),
    C("shrimp_frozen", "Frozen shrimp (IQF, export)", "frozen", hi="जमे हुए झींगे", moisture=80, fat=1.5, protein=18,
      ph=7.0, aw=0.99, t_opt=-18, base_life=365, o2_tol=500, sharp=True, density=0.6, headspace=0.3,
      storage="frozen", q10=3.0, max_wl=3, food_co2e=12.0, desired=365),
    C("frozen_peas", "Frozen green peas / vegetables", "frozen", hi="जमी हुई मटर", moisture=79, fat=0.4, protein=5,
      ph=6.5, aw=0.99, t_opt=-18, base_life=450, density=0.6, headspace=0.3, storage="frozen", q10=3.0, max_wl=3,
      food_co2e=1.0, desired=365),
    C("frozen_paratha", "Frozen paratha / snacks", "frozen", hi="जमे पराठे", moisture=35, fat=15, protein=7, ph=6.0,
      aw=0.95, t_opt=-18, base_life=270, o2_tol=1500, density=0.8, headspace=0.2, storage="frozen", q10=3.0,
      max_wl=3, food_co2e=1.8, desired=270),
    C("egg", "Table eggs (shell)", "egg", hi="अंडे", moisture=75, fat=10, protein=12.5, ph=7.6, aw=0.97, t_opt=4,
      rh_opt=75, base_life=35, q10=1.6, fragile=True, density=0.5, max_wl=4, transp=30, food_co2e=4.5,
      storage="chilled", desired=21),

    # ============================== BAKERY ==================================
    C("bread", "Bread (white/brown)", "bakery", hi="ब्रेड", moisture=38, fat=3, protein=9, ph=5.5, aw=0.95, t_opt=25,
      rh_opt=60, base_life=4, tmin_r=2, map_benefit=2.5, map_gas={"CO2": 60, "N2": 40}, density=0.25, headspace=0.5,
      max_wl=3, food_co2e=1.3, desired=5),
    C("cake", "Cake / muffins", "bakery", hi="केक", moisture=25, fat=18, protein=6, ph=6.8, aw=0.85, t_opt=25,
      rh_opt=60, base_life=10, tmin_r=5, map_benefit=2.5, map_gas={"CO2": 50, "N2": 50}, o2_tol=2000, density=0.35,
      headspace=0.5, max_wl=3, food_co2e=2.5, desired=30),
    C("biscuit", "Biscuits / cookies", "biscuit", hi="बिस्कुट", moisture=3, fat=20, protein=7, ph=7.0, aw=0.2,
      aw_c=0.45, b=0.12, o2_tol=3500, light=0.3, density=0.45, headspace=0.5, food_co2e=2.5, desired=180,
      fragile=True),
    C("cornflakes", "Breakfast cereal (cornflakes)", "biscuit", hi="कॉर्नफ्लेक्स", moisture=3, fat=1, protein=7,
      ph=6.5, aw=0.25, aw_c=0.5, b=0.12, o2_tol=3000, light=0.3, density=0.12, headspace=1.0, food_co2e=1.5,
      desired=270, fragile=True),
    C("chocolate", "Chocolate / confectionery", "biscuit", hi="चॉकलेट", moisture=1, fat=30, protein=6, ph=6.5,
      aw=0.4, aw_c=0.6, b=0.05, o2_tol=3500, light=0.6, t_opt=20, density=1.2, headspace=0.1, food_co2e=19.0,
      desired=270),
    C("noodles", "Instant noodles (fried)", "snack", hi="इंस्टेंट नूडल्स", moisture=5, fat=18, protein=9, ph=6.5,
      aw=0.35, aw_c=0.6, b=0.1, o2_tol=1800, light=0.4, density=0.3, headspace=0.8, food_co2e=2.0, desired=270),

    # ============================== SNACKS ==================================
    C("potato_chips", "Potato chips", "snack", hi="आलू चिप्स", moisture=2, fat=35, protein=6, ph=6.5, aw=0.2,
      aw_c=0.4, b=0.1, o2_tol=3000, light=0.8, density=0.08, headspace=15, map_gas={"N2": 100}, food_co2e=2.5,
      desired=90, fragile=True),
    C("namkeen", "Namkeen / bhujia", "snack", hi="नमकीन / भुजिया", moisture=3, fat=38, protein=12, ph=6.5, aw=0.3,
      aw_c=0.5, b=0.1, o2_tol=1200, light=0.6, density=0.35, headspace=2.0, map_gas={"N2": 100}, food_co2e=2.5,
      desired=150),
    C("peanuts_roasted", "Roasted peanuts / chikki", "dry_fruit", hi="भुनी मूंगफली", moisture=3, fat=48, protein=26,
      ph=6.5, aw=0.3, aw_c=0.55, b=0.08, o2_tol=700, light=0.5, density=0.55, headspace=0.5, map_gas={"N2": 100},
      food_co2e=3.2, desired=180),
    C("cashew", "Cashew / almonds (raw)", "dry_fruit", hi="काजू / बादाम", moisture=5, fat=45, protein=20, ph=6.0,
      aw=0.4, aw_c=0.65, b=0.08, o2_tol=1400, light=0.5, density=0.6, headspace=0.4, map_gas={"N2": 100},
      insect=True, food_co2e=4.0, desired=270),
    C("raisins", "Raisins / dates", "dry_fruit", hi="किशमिश / खजूर", moisture=16, fat=0.5, protein=3, ph=4.0,
      aw=0.55, aw_c=0.7, b=0.3, light=0.2, max_wl=4, density=0.7, headspace=0.3, insect=True, food_co2e=1.5,
      desired=270),
    C("makhana", "Roasted makhana (fox nut)", "snack", hi="मखाना", moisture=4, fat=5, protein=9, ph=6.5, aw=0.25,
      aw_c=0.45, b=0.12, o2_tol=2000, light=0.3, density=0.1, headspace=3, food_co2e=1.5, desired=180,
      fragile=True),

    # ========================= GRAINS & FLOURS ==============================
    C("rice", "Rice (milled)", "grain", hi="चावल", state="granular", moisture=12.5, fat=0.6, protein=7, ph=6.5,
      aw=0.6, aw_c=0.7, b=0.2, insect=True, intrinsic=720, density=0.8, headspace=0.1, food_co2e=2.7, desired=365),
    C("wheat", "Wheat grain (storage)", "grain", hi="गेहूं", state="granular", moisture=12, fat=1.8, protein=12,
      ph=6.5, aw=0.6, aw_c=0.7, b=0.2, insect=True, intrinsic=900, density=0.78, headspace=0.1, food_co2e=0.8,
      desired=365),
    C("pulses", "Pulses / dal (toor, moong)", "grain", hi="दालें", state="granular", moisture=10, fat=1.5,
      protein=22, ph=6.5, aw=0.55, aw_c=0.7, b=0.18, insect=True, intrinsic=540, density=0.8, headspace=0.1,
      food_co2e=0.9, desired=365),
    C("atta", "Whole wheat flour (atta)", "flour", hi="आटा", state="powder", moisture=12, fat=2, protein=12, ph=6.2,
      aw=0.6, aw_c=0.7, b=0.2, insect=True, intrinsic=110, density=0.55, headspace=0.1, food_co2e=0.9, desired=90),
    C("besan", "Gram flour (besan)", "flour", hi="बेसन", state="powder", moisture=10, fat=6, protein=22, ph=6.4,
      aw=0.55, aw_c=0.68, b=0.2, insect=True, intrinsic=150, o2_tol=6000, density=0.5, headspace=0.1,
      food_co2e=1.0, desired=120),
    C("millet_flour", "Millet flour (ragi/bajra)", "flour", hi="बाजरा / रागी आटा", state="powder", moisture=10, fat=5,
      protein=8, ph=6.4, aw=0.55, aw_c=0.68, b=0.2, insect=True, intrinsic=45, o2_tol=3000, density=0.55,
      headspace=0.1, food_co2e=0.9, desired=60),

    # ======================= SUGAR / SALT / JAGGERY =========================
    C("sugar", "Sugar (crystal)", "sugar_salt", hi="चीनी", state="granular", moisture=0.05, fat=0, protein=0, ph=6.5,
      aw=0.35, aw_c=0.75, b=0.004, density=0.85, headspace=0.1, food_co2e=1.0, desired=720),
    C("salt", "Iodised salt", "sugar_salt", hi="आयोडीन युक्त नमक", state="granular", moisture=0.5, fat=0, protein=0,
      ph=7.0, aw=0.3, aw_c=0.7, b=0.01, light=0.4, density=1.2, headspace=0.1, food_co2e=0.2, desired=365),
    C("jaggery", "Jaggery (gur)", "sugar_salt", hi="गुड़", state="solid", moisture=7, fat=0.1, protein=0.4, ph=5.8,
      aw=0.6, aw_c=0.7, b=0.3, density=0.9, headspace=0.1, food_co2e=1.2, desired=180),
    C("honey", "Honey", "sugar_salt", hi="शहद", state="liquid", moisture=18, fat=0, protein=0.3, ph=3.9, aw=0.6,
      aw_c=0.65, b=0.3, light=0.4, density=1.4, headspace=0.05, food_co2e=1.5, desired=720),

    # ========================== SPICES, TEA, COFFEE ==========================
    C("tea", "Black tea (CTC)", "spice", hi="चाय पत्ती", state="granular", moisture=3.5, fat=1, protein=20, ph=5.5,
      aw=0.25, aw_c=0.5, b=0.15, o2_tol=3500, light=0.5, density=0.35, headspace=0.2, food_co2e=5.0, desired=365),
    C("coffee", "Roasted ground coffee", "spice", hi="कॉफी", state="powder", moisture=2, fat=12, protein=12, ph=5.0,
      aw=0.2, aw_c=0.45, b=0.1, o2_tol=180, light=0.5, density=0.35, headspace=0.5, map_gas={"N2": 100},
      degassing=True, food_co2e=15.0, desired=180),
    C("turmeric", "Turmeric powder", "spice", hi="हल्दी पाउडर", state="powder", moisture=9, fat=5, protein=8, ph=5.8,
      aw=0.5, aw_c=0.65, b=0.2, o2_tol=3000, light=0.8, density=0.5, headspace=0.2, insect=True, food_co2e=1.5,
      desired=365),
    C("chilli_powder", "Red chilli powder", "spice", hi="लाल मिर्च पाउडर", state="powder", moisture=9, fat=10,
      protein=12, ph=5.5, aw=0.5, aw_c=0.65, b=0.2, o2_tol=2000, light=0.9, density=0.45, headspace=0.2,
      insect=True, food_co2e=1.5, desired=365),
    C("garam_masala", "Blended spice (garam masala)", "spice", hi="गरम मसाला", state="powder", moisture=8, fat=10,
      protein=10, ph=5.8, aw=0.45, aw_c=0.6, b=0.2, o2_tol=1500, light=0.7, density=0.45, headspace=0.2,
      insect=True, food_co2e=2.0, desired=365),
    C("dehydrated_veg", "Dehydrated vegetables / fruit powder", "dehydrated", hi="निर्जलित सब्ज़ियाँ",
      state="powder", moisture=5, fat=1, protein=5, ph=5.0, aw=0.25, aw_c=0.4, b=0.15, o2_tol=900, light=0.8,
      density=0.4, headspace=0.3, food_co2e=2.0, desired=270),

    # ============================ OILS & SAUCES =============================
    C("edible_oil", "Refined edible oil (sunflower/soy)", "oil", hi="खाद्य तेल", state="liquid", moisture=0.05,
      fat=100, protein=0, ph=6.0, aw=0.2, o2_tol=400, light=0.7, density=0.91, headspace=0.04, map_gas={"N2": 100},
      food_co2e=3.5, desired=270),
    C("mustard_oil", "Kachi ghani mustard oil", "oil", hi="सरसों का तेल", state="liquid", moisture=0.1, fat=100,
      protein=0, ph=6.0, aw=0.2, o2_tol=550, light=0.6, density=0.91, headspace=0.04, food_co2e=3.0, desired=270),
    C("pickle", "Pickle in oil (achar)", "sauce", hi="अचार", state="paste", moisture=45, fat=25, protein=2, ph=3.6,
      aw=0.85, o2_tol=3000, light=0.3, intrinsic=540, density=1.0, headspace=0.05, food_co2e=1.5, desired=365),
    C("ketchup", "Tomato ketchup / sauce", "sauce", hi="टमाटर कैचप", state="paste", moisture=68, fat=0.1, protein=1.5,
      ph=3.8, aw=0.93, o2_tol=280, light=0.5, intrinsic=540, density=1.1, headspace=0.05, process="hot_fill",
      food_co2e=1.5, desired=365),
    C("jam", "Fruit jam", "sauce", hi="जैम", state="paste", moisture=32, fat=0.1, protein=0.4, ph=3.3, aw=0.82,
      o2_tol=600, light=0.4, intrinsic=540, density=1.3, headspace=0.05, process="hot_fill", food_co2e=1.6,
      desired=365),

    # ============================ BEVERAGES ================================
    C("juice", "Fruit juice / nectar (aseptic)", "beverage", hi="फलों का रस", state="liquid", moisture=88, fat=0.1,
      protein=0.5, ph=3.6, aw=0.98, o2_tol=35, light=0.6, intrinsic=270, density=1.05, headspace=0.04,
      process="aseptic", food_co2e=1.0, desired=180),
    C("lassi", "Flavoured milk / lassi (UHT)", "beverage", hi="लस्सी", state="liquid", moisture=82, fat=2.5,
      protein=3, ph=4.3, aw=0.98, o2_tol=40, light=0.7, intrinsic=180, density=1.05, headspace=0.05,
      process="aseptic", food_co2e=1.6, desired=120),
    C("coconut_water", "Coconut water (packaged)", "beverage", hi="नारियल पानी", state="liquid", moisture=95,
      fat=0.2, protein=0.7, ph=5.2, aw=0.99, o2_tol=35, light=0.4, intrinsic=270, density=1.02, headspace=0.04,
      process="aseptic", food_co2e=0.5, desired=180),

    # =========================== READY-TO-EAT ==============================
    C("rte_curry", "Ready-to-eat curry / dal (retort)", "rte", hi="रेडी-टू-ईट करी", state="paste", moisture=75,
      fat=8, protein=6, ph=5.6, aw=0.98, o2_tol=220, light=0.4, intrinsic=540, density=1.05, headspace=0.05,
      process="retort", food_co2e=2.5, desired=365),
    C("rte_rice", "Ready-to-eat rice (biryani/pulao, retort)", "rte", hi="रेडी-टू-ईट चावल", state="solid",
      moisture=65, fat=6, protein=5, ph=6.0, aw=0.97, o2_tol=250, light=0.3, intrinsic=540, density=0.8,
      headspace=0.1, process="retort", food_co2e=3.0, desired=365),
    C("idli_batter", "Idli / dosa batter (fermented)", "batter", hi="इडली / डोसा घोल", state="paste", moisture=60,
      fat=0.5, protein=6, ph=4.5, aw=0.98, t_opt=4, base_life=5, tmin_r=-2, density=1.05, headspace=0.2,
      degassing=True, storage="chilled", food_co2e=1.2, max_wl=2, desired=5),
]

COMMODITY_INDEX = {c["id"]: c for c in COMMODITIES}


def search(q: str | None = None, cat: str | None = None) -> list[dict]:
    items = COMMODITIES
    if cat:
        items = [c for c in items if c["cat"] == cat]
    if q:
        ql = q.lower()
        items = [c for c in items if ql in c["name"].lower() or ql in c["id"] or ql in c.get("hi", "")]
    return items


# ---------------------------------------------------------------------------
# Curated industry-practice dataset: packaging families actually used in the
# Indian / export market for each commodity, most common first.  Sources: IIP
# (Indian Institute of Packaging) guidelines, APEDA export packaging
# standards, FSSAI guidance notes, NHB post-harvest manuals, retail audits.
# Used as the supervised label source for the ML model (see app/ml/model.py).
# ---------------------------------------------------------------------------
PRACTICE = {
    "apple": ["ventilated_rigid", "ventilated_mesh", "breathable_perforated"],
    "banana": ["breathable_perforated", "polyolefin_mono"],
    "mango": ["ventilated_rigid", "breathable_perforated"],
    "tomato": ["ventilated_rigid", "ventilated_mesh"],
    "strawberry": ["ventilated_rigid", "breathable_perforated"],
    "grapes": ["breathable_perforated", "ventilated_rigid"],
    "pomegranate": ["breathable_perforated", "ventilated_rigid"],
    "guava": ["ventilated_rigid", "breathable_perforated"],
    "papaya": ["ventilated_rigid", "breathable_perforated"],
    "orange": ["ventilated_mesh", "ventilated_rigid"],
    "litchi": ["breathable_perforated", "ventilated_rigid"],
    "cherry": ["breathable_perforated", "ventilated_rigid"],
    "kiwi": ["breathable_perforated", "ventilated_rigid"],
    "pineapple": ["ventilated_rigid", "ventilated_mesh"],
    "avocado": ["ventilated_rigid", "breathable_perforated"],
    "sapota": ["ventilated_rigid", "breathable_perforated"],
    "broccoli": ["breathable_perforated", "polyolefin_mono"],
    "cauliflower": ["breathable_perforated", "polyolefin_mono"],
    "cabbage": ["ventilated_mesh", "polyolefin_mono"],
    "okra": ["breathable_perforated", "ventilated_rigid"],
    "green_chilli": ["breathable_perforated", "ventilated_mesh"],
    "capsicum": ["breathable_perforated", "polyolefin_mono"],
    "cucumber": ["polyolefin_mono", "breathable_perforated"],
    "sweet_corn": ["breathable_perforated", "polyolefin_mono"],
    "peas_pod": ["breathable_perforated", "ventilated_mesh"],
    "mushroom": ["breathable_perforated", "ventilated_rigid"],
    "asparagus": ["breathable_perforated", "ventilated_rigid"],
    "lettuce": ["breathable_perforated", "polyolefin_mono"],
    "spinach": ["breathable_perforated", "ventilated_rigid"],
    "coriander": ["breathable_perforated"],
    "methi": ["breathable_perforated"],
    "fresh_salad": ["breathable_perforated", "ventilated_rigid"],
    "cut_fruit": ["ventilated_rigid", "breathable_perforated"],
    "baby_corn": ["breathable_perforated", "ventilated_rigid"],
    "potato": ["ventilated_mesh", "polyolefin_mono"],
    "onion": ["ventilated_mesh"],
    "garlic": ["ventilated_mesh"],
    "carrot": ["breathable_perforated", "polyolefin_mono"],
    "ginger": ["ventilated_mesh", "breathable_perforated"],
    "milk": ["polyolefin_mono"],
    "uht_milk": ["aseptic_carton", "foil_laminate"],
    "curd": ["rigid_plastic", "polyolefin_mono"],
    "paneer": ["vacuum_barrier", "map_tray"],
    "cheese": ["vacuum_barrier", "evoh_high_barrier"],
    "ghee": ["rigid_glass_metal", "rigid_plastic", "pet_pe_laminate"],
    "butter": ["foil_laminate"],
    "milk_powder": ["foil_laminate", "rigid_glass_metal"],
    "infant_formula": ["rigid_glass_metal", "foil_laminate"],
    "ice_cream": ["rigid_plastic"],
    "chicken": ["map_tray", "vacuum_barrier"],
    "mutton": ["map_tray", "vacuum_barrier"],
    "fish_lean": ["map_tray", "vacuum_barrier"],
    "fish_fatty": ["vacuum_barrier", "map_tray"],
    "shrimp_frozen": ["polyolefin_mono", "pet_pe_laminate"],
    "frozen_peas": ["polyolefin_mono", "pet_pe_laminate"],
    "frozen_paratha": ["polyolefin_mono", "pet_pe_laminate"],
    "egg": ["ventilated_rigid"],
    "bread": ["polyolefin_mono"],
    "cake": ["polyolefin_mono", "map_tray"],
    "biscuit": ["metallized_laminate", "polyolefin_mono"],
    "cornflakes": ["polyolefin_mono", "metallized_laminate"],
    "chocolate": ["foil_laminate", "metallized_laminate"],
    "noodles": ["metallized_laminate", "polyolefin_mono"],
    "potato_chips": ["metallized_laminate"],
    "namkeen": ["metallized_laminate", "pet_pe_laminate"],
    "peanuts_roasted": ["metallized_laminate", "pet_pe_laminate"],
    "cashew": ["metallized_laminate", "foil_laminate", "vacuum_barrier"],
    "raisins": ["pet_pe_laminate", "polyolefin_mono"],
    "makhana": ["metallized_laminate", "pet_pe_laminate"],
    "rice": ["polyolefin_mono", "bulk_sack", "hermetic_grain"],
    "wheat": ["ventilated_mesh", "hermetic_grain", "bulk_sack"],
    "pulses": ["polyolefin_mono", "bulk_sack"],
    "atta": ["polyolefin_mono", "paper_based", "pet_pe_laminate"],
    "besan": ["polyolefin_mono", "pet_pe_laminate"],
    "millet_flour": ["pet_pe_laminate", "polyolefin_mono"],
    "sugar": ["polyolefin_mono", "bulk_sack", "ventilated_mesh"],
    "salt": ["polyolefin_mono", "pet_pe_laminate"],
    "jaggery": ["polyolefin_mono", "pet_pe_laminate"],
    "honey": ["rigid_glass_metal", "rigid_plastic"],
    "tea": ["metallized_laminate", "pet_pe_laminate"],
    "coffee": ["foil_laminate", "metallized_laminate"],
    "turmeric": ["pet_pe_laminate", "metallized_laminate"],
    "chilli_powder": ["pet_pe_laminate", "metallized_laminate"],
    "garam_masala": ["metallized_laminate", "pet_pe_laminate"],
    "dehydrated_veg": ["foil_laminate", "metallized_laminate"],
    "edible_oil": ["rigid_plastic", "pet_pe_laminate", "rigid_glass_metal"],
    "mustard_oil": ["rigid_plastic", "rigid_glass_metal"],
    "pickle": ["rigid_glass_metal", "rigid_plastic"],
    "ketchup": ["rigid_glass_metal", "rigid_plastic", "pet_pe_laminate"],
    "jam": ["rigid_glass_metal"],
    "juice": ["aseptic_carton", "rigid_plastic"],
    "lassi": ["aseptic_carton", "rigid_plastic"],
    "coconut_water": ["aseptic_carton", "rigid_plastic"],
    "rte_curry": ["retort_pouch"],
    "rte_rice": ["retort_pouch"],
    "idli_batter": ["polyolefin_mono"],
}
for _c in COMMODITIES:
    _c["practice"] = PRACTICE.get(_c["id"], [])
