import io
import threading

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..data.materials import MATERIAL_FAMILIES
from ..database import get_db
from ..ml import service
from ..ml.model import FEATURES, USER_DATA, append_user_rows
from ..models import Feedback

router = APIRouter(prefix="/api/ml", tags=["machine learning"])
_training = {"running": False, "last": None, "error": None}


@router.get("/info")
def info(db: Session = Depends(get_db)):
    m = service.get_model()
    n_fb = db.scalar(select(func.count(Feedback.id)))
    user_rows = sum(1 for _ in open(USER_DATA)) - 1 if USER_DATA.exists() else 0
    return dict(available=m is not None, meta=m.meta if m else None, feedback_count=n_fb, user_training_rows=user_rows,
                training=_training, features=FEATURES, families=MATERIAL_FAMILIES)


def _bg_retrain():
    try:
        _training.update(running=True, error=None)
        meta = service.retrain()
        _training.update(last=meta.get("trained_at"))
    except Exception as ex:  # pragma: no cover
        _training["error"] = str(ex)
    finally:
        _training["running"] = False


@router.post("/retrain")
def retrain():
    if _training["running"]:
        return dict(started=False, message="training already running")
    threading.Thread(target=_bg_retrain, daemon=True).start()
    return dict(started=True)


@router.get("/template.csv", response_class=PlainTextResponse)
def template():
    return ",".join(FEATURES + ["label"]) + "\n"


@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    raw = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception:
        raise HTTPException(422, "could not parse CSV")
    if "label" not in df:
        raise HTTPException(422, "CSV needs a 'label' column with a packaging family id")
    bad = sorted(set(df["label"]) - set(MATERIAL_FAMILIES))
    if bad:
        raise HTTPException(422, f"unknown family labels: {bad[:5]}")
    missing = [f for f in FEATURES if f not in df]
    for f in missing:
        df[f] = 0.0
    df["weight"] = df.get("weight", 2.0)
    df["commodity"] = df.get("commodity", "upload")
    append_user_rows(df[FEATURES + ["label", "weight", "commodity"]].to_dict("records"))
    return dict(rows_added=len(df), missing_features_filled=missing, message="Rows stored — call /api/ml/retrain.")


@router.get("/feedback")
def feedback_list(db: Session = Depends(get_db)):
    rows = db.scalars(select(Feedback).order_by(Feedback.created_at.desc()).limit(100)).all()
    return [dict(id=f.id, rec_id=f.rec_id, solution_id=f.solution_id, family=f.family, rating=f.rating,
                 observed_days=f.observed_days, notes=f.notes, created_at=f.created_at.isoformat()) for f in rows]
