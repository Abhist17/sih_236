from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class RecommendationRecord(Base):
    __tablename__ = "recommendations"
    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    commodity: Mapped[str] = mapped_column(String(120))
    commodity_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    top_solution: Mapped[str | None] = mapped_column(String(60), nullable=True)
    top_family: Mapped[str | None] = mapped_column(String(60), nullable=True)
    predicted_days: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_json: Mapped[str] = mapped_column(Text)
    result_json: Mapped[str] = mapped_column(Text)
    result_hash: Mapped[str] = mapped_column(String(64))
    certified_tx: Mapped[str | None] = mapped_column(String(64), nullable=True)


class Feedback(Base):
    __tablename__ = "feedback"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rec_id: Mapped[str] = mapped_column(String(16), ForeignKey("recommendations.id"))
    solution_id: Mapped[str] = mapped_column(String(60))
    family: Mapped[str] = mapped_column(String(60))
    rating: Mapped[int] = mapped_column(Integer)
    observed_days: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Actor(Base):
    __tablename__ = "actors"
    id: Mapped[str] = mapped_column(String(24), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(40))
    org: Mapped[str | None] = mapped_column(String(160), nullable=True)
    location: Mapped[str | None] = mapped_column(String(160), nullable=True)
    public_key: Mapped[str] = mapped_column(String(64))
    enc_private_key: Mapped[str] = mapped_column(Text)
    api_key_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class BlockRow(Base):
    __tablename__ = "blocks"
    idx: Mapped[int] = mapped_column(Integer, primary_key=True)
    hash: Mapped[str] = mapped_column(String(64), unique=True)
    prev_hash: Mapped[str] = mapped_column(String(64))
    merkle_root: Mapped[str] = mapped_column(String(64))
    nonce: Mapped[int] = mapped_column(Integer)
    difficulty: Mapped[int] = mapped_column(Integer)
    timestamp: Mapped[float] = mapped_column(Float)
    tx_json: Mapped[str] = mapped_column(Text)
    anchor_tx: Mapped[str | None] = mapped_column(String(80), nullable=True)


class TxIndex(Base):
    __tablename__ = "tx_index"
    tx_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    block_idx: Mapped[int] = mapped_column(Integer, index=True)
    type: Mapped[str] = mapped_column(String(40), index=True)
    actor_id: Mapped[str] = mapped_column(String(24), index=True)
    batch_id: Mapped[str | None] = mapped_column(String(24), index=True, nullable=True)
    timestamp: Mapped[float] = mapped_column(Float)


class Batch(Base):
    __tablename__ = "batches"
    id: Mapped[str] = mapped_column(String(24), primary_key=True)
    rec_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    commodity: Mapped[str] = mapped_column(String(120))
    commodity_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    solution_id: Mapped[str] = mapped_column(String(60))
    solution_name: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(20))
    pack_date: Mapped[str] = mapped_column(String(20))
    best_before: Mapped[str] = mapped_column(String(20))
    created_by: Mapped[str] = mapped_column(String(24))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    scenario_json: Mapped[str] = mapped_column(Text)
    spec_json: Mapped[str] = mapped_column(Text)
    spec_hash: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(30), default="packed")
    genesis_tx: Mapped[str] = mapped_column(String(64))
