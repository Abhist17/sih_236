"""
PackAI — AI-based intelligent food packaging recommendation system.
Run:  uvicorn app.main:app --reload   (from the backend/ directory)
"""
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse

from .blockchain.ledger import Ledger
from .config import FRONTEND_DIR
from .database import SessionLocal, init_db
from .engine.recommender import ENGINE_VERSION
from .ml import service as ml_service
from .ml.model import MODEL_DIR
from .routers import catalog, chain, ml, recommend, stats, tools


def _bootstrap_model():
    if not (MODEL_DIR / "model.joblib").exists():
        try:
            ml_service.retrain()
        except Exception as ex:  # pragma: no cover
            print("ML bootstrap failed:", ex)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    with SessionLocal() as db:
        Ledger(db).ensure_genesis()
    threading.Thread(target=_bootstrap_model, daemon=True).start()
    yield


app = FastAPI(
    title="PackAI — Intelligent Food Packaging Recommendation API",
    version=ENGINE_VERSION,
    description="Physics-informed + ML packaging recommendation, shelf-life prediction, MAP design, "
                "sustainability & cost optimisation, and blockchain (PackChain) traceability.",
    lifespan=lifespan,
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.add_middleware(GZipMiddleware, minimum_size=1024)

for r in (catalog, recommend, tools, ml, chain, stats):
    app.include_router(r.router)


@app.get("/api/health")
def health():
    return dict(status="ok", engine=ENGINE_VERSION, ml_model=bool(ml_service.get_model()))


@app.get("/{path:path}", include_in_schema=False)
def spa(path: str):
    if path.startswith("api/"):
        raise HTTPException(404, "not found")
    root = FRONTEND_DIR.resolve()
    f = (root / path).resolve()
    if path and f.is_file() and root in f.parents:
        headers = {"Cache-Control": "no-cache"} if f.name in ("sw.js", "index.html") else None
        return FileResponse(f, headers=headers)
    return FileResponse(root / "index.html", headers={"Cache-Control": "no-cache"})
