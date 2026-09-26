from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..data.commodities import COMMODITIES
from ..data.materials import MATERIAL_FAMILIES, SOLUTION_INDEX, SOLUTIONS
from ..database import get_db
from ..models import Actor, Batch, BlockRow, Feedback, RecommendationRecord, TxIndex
from ..ml import service

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    recs = db.scalars(select(RecommendationRecord).order_by(RecommendationRecord.created_at.desc()).limit(500)).all()
    fam = Counter(MATERIAL_FAMILIES.get(r.top_family, r.top_family) for r in recs if r.top_family)
    com = Counter(r.commodity for r in recs)
    tx_types = dict(db.execute(select(TxIndex.type, func.count()).group_by(TxIndex.type)).all())
    m = service.get_model()
    return dict(
        knowledge_base=dict(commodities=len(COMMODITIES), packaging_solutions=len(SOLUTIONS),
                            families=len(MATERIAL_FAMILIES)),
        recommendations=len(recs), certified=sum(1 for r in recs if r.certified_tx),
        batches=db.scalar(select(func.count(Batch.id))), actors=db.scalar(select(func.count(Actor.id))),
        blocks=db.scalar(select(func.count(BlockRow.idx))), transactions=sum(tx_types.values()), tx_types=tx_types,
        feedback=db.scalar(select(func.count(Feedback.id))),
        top_families=fam.most_common(8), top_commodities=com.most_common(8),
        recent=[dict(id=r.id, commodity=r.commodity, top_solution=SOLUTION_INDEX.get(r.top_solution, {}).get("name", r.top_solution), predicted_days=r.predicted_days,
                     created_at=r.created_at.isoformat(), certified=bool(r.certified_tx)) for r in recs[:8]],
        ml=dict(available=m is not None, version=m.meta.get("version") if m else None,
                holdout_accuracy=m.meta["holdout"]["accuracy"] if m else None,
                top3_unseen=m.meta["leave_commodity_out"]["top3_accuracy"] if m else None),
    )
