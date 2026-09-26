"""Process-wide ML model holder (thread-safe lazy load, hot-swap on retrain)."""
from __future__ import annotations

import threading

from .model import PackagingModel, load_user_data, train_and_save, MODEL_DIR

_lock = threading.Lock()
_model: PackagingModel | None = None
_loaded = False


def get_model() -> PackagingModel | None:
    global _model, _loaded
    if not _loaded:
        with _lock:
            if not _loaded:
                _model = PackagingModel.load()
                _loaded = True
    return _model


def scorer():
    m = get_model()
    return m.predict if m else None


def retrain() -> dict:
    global _model, _loaded
    import pandas as pd
    base = MODEL_DIR / "training_data.csv"
    m = PackagingModel()
    if base.exists():
        m.train(pd.read_csv(base), load_user_data())
        m.save()
    else:
        m = train_and_save()
    with _lock:
        _model, _loaded = m, True
    return m.meta
