"""PDF generation: recommendation report and QR batch label (ReportLab)."""
from __future__ import annotations

import io

import qrcode
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)

GREEN = colors.HexColor("#1f6f4a")
LIGHT = colors.HexColor("#eef5f0")
GREY = colors.HexColor("#5b6670")


def qr_png(data: str, box: int = 8) -> bytes:
    q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=box, border=2)
    q.add_data(data)
    q.make(fit=True)
    img = q.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle("H1x", parent=ss["Heading1"], textColor=GREEN, fontSize=17, spaceAfter=4))
    ss.add(ParagraphStyle("H2x", parent=ss["Heading2"], textColor=GREEN, fontSize=12.5, spaceBefore=8, spaceAfter=4))
    ss.add(ParagraphStyle("H3x", parent=ss["Heading3"], fontSize=10.5, spaceBefore=4, spaceAfter=2))
    ss.add(ParagraphStyle("Bodyx", parent=ss["BodyText"], fontSize=8.8, leading=11.5, alignment=TA_LEFT))
    ss.add(ParagraphStyle("Smallx", parent=ss["BodyText"], fontSize=7.5, leading=9.5, textColor=GREY))
    ss.add(ParagraphStyle("Cellx", parent=ss["BodyText"], fontSize=8, leading=10))
    return ss


def _table(rows, widths, header=True, ss=None):
    ss = ss or _styles()
    data = [[Paragraph(str(c) if c is not None else "–", ss["Cellx"]) for c in r] for r in rows]
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    style = [("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#c9d3cc")),
             ("VALIGN", (0, 0), (-1, -1), "TOP"),
             ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4)]
    if header:
        style += [("BACKGROUND", (0, 0), (-1, 0), LIGHT)]
    t.setStyle(TableStyle(style))
    return t


def _fmt(v, nd=2):
    if v is None:
        return "–"
    if isinstance(v, float):
        return f"{v:,.{nd}f}"
    return str(v)


def recommendation_pdf(rec_id: str, result: dict, result_hash: str, verify_url: str, certified_tx: str | None) -> bytes:
    ss = _styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=14 * mm,
                            bottomMargin=14 * mm, title=f"PackAI report {rec_id}", author="PackAI")
    st = []
    p = result["profile"]
    req = result["requirements"]

    qr = Image(io.BytesIO(qr_png(verify_url, 4)), width=28 * mm, height=28 * mm)
    head = Table([[
        [Paragraph("PackAI — Packaging Recommendation Report", ss["H1x"]),
         Paragraph(f"Report ID <b>{rec_id}</b> · generated {result['generated_at']} · engine v{result['engine_version']}"
                   + (f" · ML model {result['ml'].get('model_version')}" if result.get("ml") and result["ml"].get("model_version") else ""),
                   ss["Smallx"]),
         Paragraph(f"SHA-256: <font face='Courier'>{result_hash}</font>", ss["Smallx"]),
         Paragraph(("Certified on PackChain, tx <font face='Courier'>" + certified_tx[:24] + "…</font>") if certified_tx
                   else "Not yet certified on PackChain", ss["Smallx"])],
        qr]], colWidths=[150 * mm, 30 * mm])
    head.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    st += [head, Spacer(1, 4)]

    st.append(Paragraph("1. Commodity & conditions", ss["H2x"]))
    rows = [["Parameter", "Value", "Parameter", "Value"],
            ["Commodity", p["name"], "Category", p["category_label"]],
            ["Moisture (% wb)", _fmt(p["moisture"], 1), "Fat (%)", _fmt(p["fat"], 1)],
            ["pH", _fmt(p["ph"], 1), "Water activity", _fmt(p["aw"], 2)],
            ["Respiration (mg CO₂/kg·h)", _fmt(p["respiration_rate"], 1) if p["respiration_rate"] else "non-respiring",
             "Storage", f"{p['storage']} · {p['temp']} °C · {p['rh']} % RH"],
            ["Target shelf life", f"{p['desired_days']:.0f} days", "Net weight / pack", f"{p['weight_kg']} kg"],
            ["Transport", f"{p['transport']} ({p['transport_days']} d, transit {p['transit_temp']} °C)", "Cold chain",
             "yes" if p["cold_chain"] else "no"],
            ["Package area (est.)", f"{p['area_m2']} m²", "Headspace", f"{p['headspace_ml']:.0f} mL"]]
    st.append(_table(rows, [42 * mm, 48 * mm, 42 * mm, 48 * mm], ss=ss))

    st.append(Paragraph("2. Derived packaging requirements", ss["H2x"]))
    st.append(Paragraph(req["summary"], ss["Bodyx"]))
    rows = [["Requirement", "Value"],
            ["Deterioration drivers", ", ".join(req["drivers"]) or "—"],
            ["Max OTR (23 °C, 0 % RH)", f"{_fmt(req['otr_max_spec'])} cc/m²·day ({req['otr_class']})"],
            ["OTR range for passive MAP", f"{req['otr_range_for_map_spec']}" if req["otr_range_for_map_spec"] else "–"],
            ["Max WVTR (38 °C, 90 % RH)", f"{_fmt(req['wvtr_max_spec'])} g/m²·day ({req['wvtr_class']})"],
            ["Light barrier", f"≥ {req['light_barrier_min_pct']} %"],
            ["Grease resistance", req["grease_resistance"]],
            ["Min. LDPE-equivalent thickness", f"{req['min_ldpe_equivalent_thickness_um']:.0f} µm"],
            ["Service temperature", f"{req['service_temperature_c'][0]} to {req['service_temperature_c'][1]} °C"]]
    m = req["map"]
    if m["applicable"]:
        rows.append(["MAP", f"O₂ {m['o2_window']} %, CO₂ {m['co2_window']} %" if m["o2_window"]
                     else ", ".join(f"{k} {v}%" for k, v in (m["gas_mix"] or {}).items())])
    st.append(_table(rows, [60 * mm, 120 * mm], ss=ss))

    st.append(Paragraph("3. Recommended packaging solutions", ss["H2x"]))
    for r in result["recommendations"]:
        s = r["specs"]
        sl = r["shelf_life"]
        block = [Paragraph(f"#{r['rank']} — {r['name']}  <font color='#5b6670' size=8>({r['family_label']})</font>",
                           ss["H3x"])]
        rows = [["Structure", s["structure"], "Overall score", f"{r['scores']['overall']:.1f} / 100"],
                ["Thickness / grammage", f"{_fmt(s['total_thickness_um'], 0)} µm / {_fmt(s['grammage_gsm'], 1)} g/m²",
                 "Predicted shelf life", f"{sl['predicted_days']:.0f} d (target {sl['target_days']:.0f}) — {sl['limiting_label']}"],
                ["OTR spec / at storage", f"{_fmt(s['otr_spec'], 3)} / {_fmt(s['otr_at_storage'], 3)} cc/m²·day",
                 "WVTR spec / at storage", f"{_fmt(s['wvtr_spec'], 3)} / {_fmt(s['wvtr_at_storage'], 3)} g/m²·day"],
                ["CO₂TR / β", f"{_fmt(s['co2tr_spec'])} / {_fmt(s['beta_co2_o2'])}", "Tensile / elongation",
                 f"{_fmt(s['tensile_mpa'], 0)} MPa / {_fmt(s['elongation_pct'], 0)} %"],
                ["Sealing", f"{s['seal']['method']}" + (f", {s['seal']['temp_range'][0]}-{s['seal']['temp_range'][1]} °C" if s['seal'].get('temp_range') else "")
                 + (f", ≥ {s['seal']['min_strength_n_15mm']} N/15 mm" if s['seal'].get('min_strength_n_15mm') else ""),
                 "MAP", (f"{s['map']['technique']}" + (f" · {', '.join(f'{k} {v}%' for k, v in s['map']['gas'].items())}" if s['map'].get('gas') else "")
                         + (f" · eq. O₂ {s['map'].get('eq_o2')} % / CO₂ {s['map'].get('eq_co2')} %" if s['map'].get('eq_o2') is not None else ""))],
                ["Light barrier", f"{s['light_barrier_pct']} %", "Puncture resistance", s["puncture_resistance"]],
                ["Cost", f"₹{r['cost']['per_pack_inr']:.2f}/pack · ₹{r['cost']['per_1000_inr']:,.0f}/1000",
                 "Sustainability", f"{r['sustainability']['score']:.0f}/100 · {r['sustainability']['recyclability']} · "
                                   f"{r['cost']['co2e_g']:.1f} g CO₂e/pack"]]
        block.append(_table(rows, [30 * mm, 60 * mm, 30 * mm, 60 * mm], header=False, ss=ss))
        if r["reasons"]:
            block.append(Paragraph("<b>Why:</b> " + " ".join(r["reasons"]), ss["Bodyx"]))
        if r["warnings"]:
            block.append(Paragraph("<b>Watch-outs:</b> " + " ".join(w["text"] for w in r["warnings"]), ss["Bodyx"]))
        if r["addons"]:
            block.append(Paragraph("<b>Add-ons:</b> " + "; ".join(f"{a['item']} ({a['detail']})" for a in r["addons"]),
                                   ss["Bodyx"]))
        block.append(Spacer(1, 5))
        st.append(KeepTogether(block))

    alt = result.get("alternatives") or {}
    if alt:
        st.append(Paragraph("4. Trade-off alternatives", ss["H2x"]))
        rows = [["Objective", "Solution", "Shelf life (d)", "₹/pack", "Eco score", "Recyclability"]]
        for k, v in alt.items():
            rows.append([k.replace("_", " "), v["name"], _fmt(v["shelf_life_days"], 0), _fmt(v["cost_per_pack"]),
                         _fmt(v["eco_score"], 0), v["recyclability"]])
        st.append(_table(rows, [30 * mm, 55 * mm, 22 * mm, 18 * mm, 18 * mm, 37 * mm], ss=ss))

    st.append(Paragraph("5. Secondary packaging, storage & handling", ss["H2x"]))
    for sp in result.get("secondary_packaging", []):
        st.append(Paragraph(f"• <b>{sp['item']}</b> — {sp['detail']}", ss["Bodyx"]))
    for g in result.get("storage_guidance", []):
        st.append(Paragraph(f"• {g}", ss["Bodyx"]))

    if result["recommendations"]:
        st.append(Paragraph("6. Regulatory checklist (top recommendation)", ss["H2x"]))
        rows = [["Area", "Requirement"]] + [[c["area"], c["requirement"]] for c in result["recommendations"][0]["compliance"]]
        st.append(_table(rows, [55 * mm, 125 * mm], ss=ss))

    ml = result.get("ml") or {}
    if ml.get("top_families"):
        st.append(Paragraph("7. AI insights", ss["H2x"]))
        st.append(Paragraph("Industry-practice model probabilities: " + ", ".join(
            f"{f['label']} {f['probability']*100:.0f} %" for f in ml["top_families"][:4]), ss["Bodyx"]))
        if ml.get("similar_commodities"):
            st.append(Paragraph("Similar commodities: " + ", ".join(
                f"{s['name']} ({', '.join(s['typical_packaging'])})" for s in ml["similar_commodities"][:4]), ss["Bodyx"]))

    st.append(Spacer(1, 8))
    st.append(Paragraph(
        "Disclaimer: predictions are derived from mechanistic models (permeation, sorption, respiration, microbial "
        "kinetics) with indicative literature data and a machine-learning model. Validate with the converter's "
        "certificate of analysis and an accelerated/real-time shelf-life study before commercial launch. "
        f"Verify this report's integrity at {verify_url}", ss["Smallx"]))
    doc.build(st)
    return buf.getvalue()


def batch_label_pdf(batch: dict, verify_url: str) -> bytes:
    """100 × 150 mm thermal-printer label with QR."""
    ss = _styles()
    buf = io.BytesIO()
    w, h = 100 * mm, 150 * mm
    doc = SimpleDocTemplate(buf, pagesize=(w, h), leftMargin=5 * mm, rightMargin=5 * mm, topMargin=5 * mm,
                            bottomMargin=5 * mm, title=f"Label {batch['id']}")
    st = [Paragraph(f"<b>{batch['commodity']}</b>", ParagraphStyle("t", fontSize=13, leading=15, textColor=GREEN)),
          Paragraph(f"Batch <font face='Courier'><b>{batch['id']}</b></font>", ss["Bodyx"]), Spacer(1, 3),
          Image(io.BytesIO(qr_png(verify_url, 6)), width=48 * mm, height=48 * mm), Spacer(1, 2)]
    rows = [["Packed", batch["pack_date"]], ["Best before", batch["best_before"]],
            ["Qty", f"{batch['quantity']} {batch['unit']}"], ["Packaging", batch["solution_name"]],
            ["Structure", batch.get("structure", "")], ["Storage", batch.get("storage", "")]]
    st.append(_table(rows, [22 * mm, 66 * mm], header=False, ss=ss))
    st.append(Spacer(1, 2))
    st.append(Paragraph("Scan to verify origin, packaging & cold-chain on PackChain", ss["Smallx"]))
    st.append(Paragraph(f"<font face='Courier' size=6>{batch['spec_hash'][:32]}</font>", ss["Smallx"]))
    doc.build(st)
    return buf.getvalue()
