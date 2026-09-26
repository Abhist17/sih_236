import json
import secrets

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..blockchain.ledger import SYSTEM_ACTOR, Ledger, canonical, sha256
from ..config import PUBLIC_BASE_URL
from ..database import get_db
from ..engine.recommender import recommend
from ..ml import service as ml
from ..ml.model import append_user_rows, features_from_profile
from ..engine.profile import build_profile
from ..models import Actor, Feedback, RecommendationRecord
from ..reports.pdf import recommendation_pdf
from ..schemas import FeedbackIn, RecommendInput
from ..data.materials import SOLUTION_INDEX

router = APIRouter(prefix="/api", tags=["recommendation"])


def _clean(result: dict) -> dict:
    return {k: v for k, v in result.items() if not k.startswith("_")}


def result_hash(result: dict) -> str:
    return sha256(canonical(result))


@router.post("/recommend")
def create_recommendation(inp: RecommendInput, db: Session = Depends(get_db)):
    data = inp.model_dump(exclude_none=True)
    top_n = data.pop("top_n", 5)
    if not data.get("commodity_id") and data.get("moisture") is None:
        raise HTTPException(422, "Provide commodity_id or at least the composition (moisture, fat, pH, aw).")
    result = _clean(recommend(data, ml_scorer=ml.scorer(), top_n=top_n))
    rid = "R" + secrets.token_hex(5).upper()
    result["id"] = rid
    h = result_hash(result)
    top = result["recommendations"][0] if result["recommendations"] else None
    db.add(RecommendationRecord(id=rid, commodity=result["profile"]["name"], commodity_id=result["profile"]["commodity_id"],
                                top_solution=top["id"] if top else None, top_family=top["family"] if top else None,
                                predicted_days=top["shelf_life"]["predicted_days"] if top else None,
                                input_json=json.dumps(data), result_json=json.dumps(result, ensure_ascii=False),
                                result_hash=h))
    db.commit()
    result["result_hash"] = h
    return result


@router.get("/recommendations")
def list_recommendations(limit: int = 30, db: Session = Depends(get_db)):
    rows = db.scalars(select(RecommendationRecord).order_by(RecommendationRecord.created_at.desc()).limit(limit)).all()
    return [dict(id=r.id, created_at=r.created_at.isoformat(), commodity=r.commodity, top_solution=r.top_solution,
                 top_solution_name=SOLUTION_INDEX.get(r.top_solution, {}).get("name") if r.top_solution else None,
                 top_family=r.top_family, predicted_days=r.predicted_days, certified=bool(r.certified_tx))
            for r in rows]


def _get(db, rid) -> RecommendationRecord:
    r = db.get(RecommendationRecord, rid)
    if not r:
        raise HTTPException(404, "recommendation not found")
    return r


@router.get("/recommendations/{rid}")
def get_recommendation(rid: str, db: Session = Depends(get_db)):
    r = _get(db, rid)
    res = json.loads(r.result_json)
    res.update(result_hash=r.result_hash, certified_tx=r.certified_tx, input=json.loads(r.input_json))
    return res


@router.get("/recommendations/{rid}/report.pdf")
def report_pdf(rid: str, db: Session = Depends(get_db)):
    r = _get(db, rid)
    pdf = recommendation_pdf(rid, json.loads(r.result_json), r.result_hash, f"{PUBLIC_BASE_URL}/verify-report/{rid}",
                             r.certified_tx)
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="PackAI_{rid}.pdf"'})


@router.post("/recommendations/{rid}/certify")
def certify(rid: str, db: Session = Depends(get_db)):
    r = _get(db, rid)
    if r.certified_tx:
        return dict(already_certified=True, tx_id=r.certified_tx)
    led = Ledger(db)
    sysact = db.get(Actor, SYSTEM_ACTOR)
    res = json.loads(r.result_json)
    tx = led.make_tx(sysact, "RECOMMENDATION_CERTIFIED", dict(
        rec_id=rid, result_hash=r.result_hash, commodity=r.commodity, top_solution=r.top_solution,
        engine_version=res.get("engine_version"), ml_version=(res.get("ml") or {}).get("model_version")))
    block = led.submit([tx])
    r.certified_tx = tx["tx_id"]
    db.commit()
    return dict(tx_id=tx["tx_id"], block_index=block["index"], block_hash=block["hash"])


@router.get("/recommendations/{rid}/verify")
def verify_report(rid: str, db: Session = Depends(get_db)):
    r = _get(db, rid)
    res = json.loads(r.result_json)
    recomputed = result_hash(res)
    out = dict(rec_id=rid, commodity=r.commodity, created_at=r.created_at.isoformat(), stored_hash=r.result_hash,
               recomputed_hash=recomputed, content_intact=recomputed == r.result_hash, certified=bool(r.certified_tx))
    if r.certified_tx:
        led = Ledger(db)
        tx, b = led.get_tx(r.certified_tx)
        proof = led.proof(r.certified_tx)
        out.update(on_chain_hash=tx["body"]["payload"]["result_hash"], block_index=b.idx, block_hash=b.hash,
                   signature_valid=proof["signature_valid"], merkle_valid=proof["merkle_valid"],
                   matches_chain=tx["body"]["payload"]["result_hash"] == recomputed)
        out["verdict"] = "AUTHENTIC" if out["matches_chain"] and out["content_intact"] and proof["signature_valid"] else "TAMPERED"
    else:
        out["verdict"] = "UNCERTIFIED" if out["content_intact"] else "TAMPERED"
    return out


@router.post("/recommendations/{rid}/feedback")
def feedback(rid: str, fb: FeedbackIn, db: Session = Depends(get_db)):
    r = _get(db, rid)
    sol = SOLUTION_INDEX.get(fb.solution_id)
    if not sol:
        raise HTTPException(404, "unknown solution")
    res = json.loads(r.result_json)
    fam = next((x["family"] for x in res["recommendations"] if x["id"] == fb.solution_id), sol["family"])
    db.add(Feedback(rec_id=rid, solution_id=fb.solution_id, family=fam, rating=fb.rating,
                    observed_days=fb.observed_shelf_life_days, notes=fb.notes))
    db.commit()
    # Positive, field-validated outcomes become labelled training data for the next retrain.
    target = res["profile"]["desired_days"]
    good = fb.rating >= 4 and (fb.observed_shelf_life_days is None or fb.observed_shelf_life_days >= 0.8 * target)
    if good:
        f = features_from_profile(build_profile(json.loads(r.input_json)))
        f.update(label=fam, commodity=r.commodity_id or "user", weight=3.0)
        append_user_rows([f])
    return dict(saved=True, used_for_training=good)
