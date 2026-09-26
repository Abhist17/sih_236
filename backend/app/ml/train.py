"""CLI: python -m app.ml.train [--samples N] [--regenerate]"""
import argparse
import json

from .model import MODEL_DIR, train_and_save

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Generate the knowledge-distilled dataset and train the ML models")
    ap.add_argument("--samples", type=int, default=50, help="Monte-Carlo scenarios per commodity")
    ap.add_argument("--regenerate", action="store_true", help="discard the cached training_data.csv")
    a = ap.parse_args()
    if a.regenerate and (MODEL_DIR / "training_data.csv").exists():
        (MODEL_DIR / "training_data.csv").unlink()
    m = train_and_save(a.samples)
    print(json.dumps({k: m.meta[k] for k in ("n_samples", "holdout", "leave_commodity_out", "regressors")}, indent=2))
