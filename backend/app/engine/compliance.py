"""Regulatory checklist generator — FSSAI, BIS, PWM Rules (EPR), Legal Metrology (India)."""
from __future__ import annotations


def checklist(p, sol: dict, thickness_um: float | None) -> list[dict]:
    items = []
    plastic = sol.get("pwm_cat") is not None
    items.append(dict(
        area="Food contact (FSSAI Packaging Regulations 2018)",
        requirement=f"Packaging material must be food-grade and conform to {sol.get('std', 'the relevant IS')}.",
        status="required"))
    if plastic:
        items.append(dict(
            area="Overall migration (FSSAI / IS 9845)",
            requirement="Plastic food-contact layer must pass overall migration ≤ 60 mg/kg (10 mg/dm²) with no "
                        "visible colour migration; pigments per IS 9833.",
            status="required"))
        items.append(dict(
            area="Recycled plastic",
            requirement="Recycled plastic must not be used for direct food contact unless specifically permitted "
                        "by FSSAI (e.g. authorised food-grade rPET processes).",
            status="required"))
        items.append(dict(
            area="EPR — Plastic Waste Management (Amendment) Rules 2022",
            requirement=f"EPR Category {sol.get('pwm_cat')}: the brand owner/importer must register as a PIBO on "
                        "the CPCB centralised EPR portal and meet annual recycling/re-use targets.",
            status="required"))
        items.append(dict(
            area="Marking (PWM Rules)",
            requirement=f"Print resin identification code ({sol.get('resin_code') or '7'}), manufacturer name, "
                        "EPR registration number and thickness where applicable on the pack.",
            status="required"))
    if sol.get("compostable"):
        items.append(dict(
            area="Compostable plastic",
            requirement="Compostable plastic must be certified to IS/ISO 17088 and carry CPCB certificate & "
                        "'compostable' marking; falls under EPR Category IV.",
            status="required"))
    if sol["id"] == "tin_can" and p.ph < 4.6:
        items.append(dict(area="Acidic food in metal", requirement="Use an acid-resistant internal lacquer (epoxy-"
                          "phenolic/BPA-NI) to prevent tin dissolution and corrosion.", status="required"))
    if sol["id"] == "jute_bag":
        items.append(dict(area="Jute Packaging Materials Act 1987",
                          requirement="Food-grain packing in jute must use food-grade (JBO-free) bags per IS 16186; "
                                      "government procurement reserves food grains for jute packaging.",
                          status="required"))
    items.append(dict(
        area="Labelling (FSS Labelling & Display Regulations 2020)",
        requirement="Declare product name, ingredients, nutrition, veg/non-veg symbol, FSSAI logo & licence no., "
                    "batch/lot, date of manufacture/packing, 'Best Before'/'Use By', storage instructions, "
                    "allergen declaration.",
        status="required"))
    items.append(dict(
        area="Legal Metrology (Packaged Commodities) Rules 2011",
        requirement="Declare net quantity, MRP, manufacturer/packer address, consumer-care details and unit "
                    "sale price on the principal display panel.",
        status="required"))
    if p.process == "retort":
        items.append(dict(area="Thermal process validation",
                          requirement="Validate F0 ≥ 3 min (low-acid) with heat-penetration studies; test seal "
                                      "integrity (burst, dye penetration) per batch.", status="required"))
    if p.storage in ("chilled", "frozen"):
        items.append(dict(area="Storage instruction",
                          requirement=f"Label 'Keep {'frozen at −18 °C or below' if p.storage == 'frozen' else 'refrigerated at 0-4 °C'}'.",
                          status="required"))
    return items
