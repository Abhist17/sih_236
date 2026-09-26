"""
Machine-learning layer.

Why ML on top of a physics engine?
  The mechanistic engine guarantees *technical feasibility*, but many feasible packages are never
  used commercially (cost of converting lines, consumer expectations, supply-chain habits).  The ML
  model learns **industry packaging practice** as a function of food properties and conditions, so it
  generalises to commodities that are not in the database (e.g. a new millet snack) and it keeps
  learning from users' field feedback and uploaded lab data.

Training data
  1. Knowledge-distilled corpus: every commodity × randomised properties/conditions (Monte-Carlo
     perturbation).  The label is the first *industry-practice* family (data/commodities.PRACTICE)
     that the physics engine finds feasible for that scenario, with stochastic secondary choices to
     reflect real market diversity.
  2. User feedback (adopted solution + observed shelf life) — weighted ×3.
  3. Uploaded CSV datasets (lab / company data) using the same feature columns.

Models
  * RandomForestClassifier  -> packaging family probabilities (used as the "ML score" in TOPSIS)
  * RandomForestRegressor   -> log10 required OTR, log10 required WVTR, log10 achievable shelf life
  * NearestNeighbors        -> similar commodities (explainability)
Validation: stratified hold-out AND leave-commodity-out (GroupShuffleSplit) to measure generalisation
to unseen commodities.
"""
from __future__ import annotations

import json
import math
import os
import random
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, f1_score, r2_score, mean_absolute_error
from sklearn.model_selection import GroupShuffleSplit, train_test_split
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

from ..data.commodities import CATEGORIES, COMMODITIES, COMMODITY_INDEX
from ..data.materials import MATERIAL_FAMILIES
from ..engine.profile import Profile, TRANSPORT, build_profile, rr_air_at

MODEL_DIR = Path(os.environ.get("PACKAI_MODEL_DIR", Path(__file__).resolve().parents[3] / "data" / "models"))
USER_DATA = MODEL_DIR / "user_data.csv"

STATES = ["solid", "liquid", "paste", "powder", "granular"]
STORAGES = ["ambient", "chilled", "frozen"]
PROCESSES = ["none", "pasteurised", "hot_fill", "retort", "aseptic"]
CATS = list(CATEGORIES)

FEATURES = (
    ["moisture", "fat", "protein", "ph", "aw", "log_rr", "temp", "rh", "log_days", "log_weight", "log_o2_tol",
     "light", "aw_c", "map_benefit", "has_o2_window", "sharp", "fragile", "insect", "degassing", "severity",
     "cold_chain"]
    + [f"state_{s}" for s in STATES] + [f"storage_{s}" for s in STORAGES] + [f"process_{s}" for s in PROCESSES]
    + [f"cat_{c}" for c in CATS]
)


def features_from_profile(p: Profile) -> dict:
    f = dict(
        moisture=p.moisture, fat=p.fat, protein=p.protein, ph=p.ph, aw=p.aw,
        log_rr=math.log1p(rr_air_at(p, p.temp) if p.rr > 0 else 0.0), temp=p.temp, rh=p.rh * 100,
        log_days=math.log10(max(p.desired_days, 1)), log_weight=math.log10(max(p.weight_kg, 0.01)),
        log_o2_tol=math.log10(p.o2_tol) if p.o2_tol else 5.0, light=p.light, aw_c=p.aw_c if p.aw_c else 1.0,
        map_benefit=p.map_benefit, has_o2_window=1.0 if p.o2_win else 0.0, sharp=float(p.sharp),
        fragile=float(p.fragile), insect=float(p.insect), degassing=float(p.degassing), severity=p.severity,
        cold_chain=float(p.cold_chain),
    )
    for s in STATES:
        f[f"state_{s}"] = 1.0 if p.state == s else 0.0
    for s in STORAGES:
        f[f"storage_{s}"] = 1.0 if p.storage == s else 0.0
    for s in PROCESSES:
        f[f"process_{s}"] = 1.0 if p.process == s else 0.0
    for c in CATS:
        f[f"cat_{c}"] = 1.0 if p.cat == c else 0.0
    return f


def _vec(f: dict) -> np.ndarray:
    return np.array([[float(f.get(k, 0.0)) for k in FEATURES]])


# ============================================================================ dataset
WEIGHT_RANGE = {
    "grain": (1, 50), "flour": (0.5, 25), "sugar_salt": (0.5, 25), "root_bulb": (1, 50), "oil": (0.5, 15),
    "dairy_fat": (0.2, 15), "frozen": (0.2, 5), "fruit": (0.25, 10), "vegetable": (0.25, 5), "leafy": (0.1, 1),
    "fresh_cut": (0.1, 1), "snack": (0.03, 0.5), "biscuit": (0.05, 1), "spice": (0.05, 1), "beverage": (0.2, 1.5),
    "dairy_liquid": (0.2, 1.5), "egg": (0.3, 2), "rte": (0.2, 1), "meat": (0.25, 2), "seafood": (0.25, 2),
}


def _scenario(c: dict, rng: random.Random) -> dict:
    j = lambda v, rel: v * (1 + rng.uniform(-rel, rel))
    lo, hi = WEIGHT_RANGE.get(c["cat"], (0.1, 2))
    weight = round(math.exp(rng.uniform(math.log(lo), math.log(hi))), 3)
    storage = c.get("storage", "ambient")
    if storage == "ambient":
        temp = rng.uniform(18, 40) if not (c.get("rr", 0) > 0) else rng.uniform(c["t_opt"], 35)
    elif storage == "chilled":
        temp = rng.uniform(max(-1, c["t_opt"] - 2), c["t_opt"] + 6)
    else:
        temp = rng.uniform(-25, -12)
    inp = dict(
        commodity_id=c["id"], moisture=max(0.05, min(97, j(c["moisture"], 0.1))), fat=max(0, min(100, j(c["fat"], 0.15))),
        ph=max(2.5, min(8, c["ph"] + rng.uniform(-0.3, 0.3))), aw=max(0.1, min(0.995, c["aw"] + rng.uniform(-0.03, 0.03))),
        storage_type=storage, storage_temp=round(temp, 1), rh=round(rng.uniform(45, 97)),
        desired_shelf_life_days=max(2, round(c.get("desired", 90) * rng.uniform(0.5, 1.6))),
        net_weight_kg=weight, transport=rng.choice(list(TRANSPORT)), cold_chain=storage != "ambient" and rng.random() > 0.15,
        priority="performance",
    )
    if c.get("rr", 0) > 0:
        inp["respiration_rate"] = j(c["rr"], 0.25)
        inp["respiration_temp"] = c["t_opt"]
    return inp


def generate_dataset(samples_per_commodity: int = 50, seed: int = 42, progress: bool = False) -> pd.DataFrame:
    from ..engine.recommender import recommend  # local import avoids a cycle
    rng = random.Random(seed)
    rows = []
    t0 = time.time()
    for i, c in enumerate(COMMODITIES):
        for _ in range(samples_per_commodity):
            inp = _scenario(c, rng)
            try:
                res = recommend(inp, ml_scorer=None, top_n=3, detail=False)
            except Exception:
                continue
            feasible = res["_ranked_families"]
            if not feasible:
                continue
            practice = [f for f in c.get("practice", []) if f in feasible]
            if practice:
                r = rng.random()
                label = practice[1] if (len(practice) > 1 and r < 0.25) else practice[0]
            else:
                label = feasible[0]
            p = build_profile(inp)
            f = features_from_profile(p)
            req = res["requirements"]
            best = res["recommendations"][0] if res["recommendations"] else None
            f.update(
                label=label, commodity=c["id"], weight=1.0,
                y_otr=math.log10(req["otr_max_spec"]) if req.get("otr_max_spec") else np.nan,
                y_wvtr=math.log10(req["wvtr_max_spec"]) if req.get("wvtr_max_spec") else np.nan,
                y_life=math.log10(max(best["shelf_life"]["predicted_days"], 0.5)) if best else np.nan,
            )
            rows.append(f)
        if progress:
            print(f"  [{i+1}/{len(COMMODITIES)}] {c['id']:<18} {len(rows)} rows  {time.time()-t0:.0f}s", flush=True)
    return pd.DataFrame(rows)


# ============================================================================ model
class PackagingModel:
    def __init__(self):
        self.clf = None
        self.reg = {}
        self.knn = None
        self.knn_scaler = None
        self.knn_ids = []
        self.meta = {}
        self.classes_ = []

    # ------------------------------------------------------------------ training
    def train(self, df: pd.DataFrame, extra: pd.DataFrame | None = None, seed: int = 42) -> dict:
        t0 = time.time()
        data = df.copy()
        if extra is not None and len(extra):
            data = pd.concat([data, extra], ignore_index=True)
        for k in FEATURES:
            if k not in data:
                data[k] = 0.0
        X = data[FEATURES].fillna(0).to_numpy(float)
        y = data["label"].to_numpy()
        w = data["weight"].fillna(1.0).to_numpy(float) if "weight" in data else np.ones(len(data))
        groups = data["commodity"].fillna("user").to_numpy()

        params = dict(n_estimators=150, min_samples_leaf=3, max_depth=22, class_weight="balanced_subsample", n_jobs=-1,
                      random_state=seed)
        # --- validation 1: stratified random hold-out
        Xtr, Xte, ytr, yte, wtr, _ = train_test_split(X, y, w, test_size=0.2, random_state=seed)
        m = RandomForestClassifier(**params).fit(Xtr, ytr, sample_weight=wtr)
        pred = m.predict(Xte)
        proba = m.predict_proba(Xte)
        top3 = np.mean([yt in m.classes_[np.argsort(pr)[-3:]] for yt, pr in zip(yte, proba)])
        holdout = dict(accuracy=round(accuracy_score(yte, pred), 4), macro_f1=round(f1_score(yte, pred, average="macro"), 4),
                       top3_accuracy=round(float(top3), 4), n_test=int(len(yte)))
        # --- validation 2: leave-commodity-out (generalisation to unseen commodities)
        gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=seed)
        tr_idx, te_idx = next(gss.split(X, y, groups))
        m2 = RandomForestClassifier(**params).fit(X[tr_idx], y[tr_idx], sample_weight=w[tr_idx])
        pred2 = m2.predict(X[te_idx])
        proba2 = m2.predict_proba(X[te_idx])
        top3b = np.mean([yt in m2.classes_[np.argsort(pr)[-3:]] for yt, pr in zip(y[te_idx], proba2)])
        unseen = dict(accuracy=round(accuracy_score(y[te_idx], pred2), 4),
                      macro_f1=round(f1_score(y[te_idx], pred2, average="macro"), 4),
                      top3_accuracy=round(float(top3b), 4), n_test=int(len(te_idx)),
                      held_out_commodities=sorted(set(groups[te_idx]))[:40])
        # --- final model on all data
        self.clf = RandomForestClassifier(**params).fit(X, y, sample_weight=w)
        self.classes_ = list(self.clf.classes_)
        importances = sorted(zip(FEATURES, self.clf.feature_importances_), key=lambda t: -t[1])

        # --- regressors (surrogates of the physics engine)
        reg_metrics = {}
        for target in ("y_otr", "y_wvtr", "y_life"):
            if target not in data:
                continue
            mask = data[target].notna().to_numpy()
            if mask.sum() < 50:
                continue
            Xr, yr = X[mask], data.loc[mask, target].to_numpy(float)
            a, b, c_, d = train_test_split(Xr, yr, test_size=0.2, random_state=seed)
            r = RandomForestRegressor(n_estimators=120, min_samples_leaf=3, max_depth=20, n_jobs=-1, random_state=seed).fit(a, c_)
            pr = r.predict(b)
            reg_metrics[target] = dict(r2=round(r2_score(d, pr), 4), mae_log10=round(mean_absolute_error(d, pr), 4),
                                       n=int(mask.sum()))
            self.reg[target] = RandomForestRegressor(n_estimators=120, min_samples_leaf=3, max_depth=20, n_jobs=-1,
                                                     random_state=seed).fit(Xr, yr)
        self._fit_knn()
        label_counts = pd.Series(y).value_counts().to_dict()
        self.meta = dict(
            version=time.strftime("%Y%m%d-%H%M%S"), trained_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            n_samples=int(len(data)), n_features=len(FEATURES), n_classes=len(self.classes_),
            n_user_samples=int(len(extra)) if extra is not None else 0,
            classifier=dict(algorithm="RandomForestClassifier", **{k: v for k, v in params.items() if k != "n_jobs"}),
            holdout=holdout, leave_commodity_out=unseen, regressors=reg_metrics,
            feature_importance=[dict(feature=f, importance=round(float(i), 4)) for f, i in importances[:20]],
            class_distribution={k: int(v) for k, v in label_counts.items()},
            train_seconds=round(time.time() - t0, 1),
        )
        return self.meta

    def _fit_knn(self):
        rows, ids = [], []
        for c in COMMODITIES:
            p = build_profile({"commodity_id": c["id"]})
            f = features_from_profile(p)
            rows.append([f[k] for k in ("moisture", "fat", "protein", "ph", "aw", "log_rr", "log_o2_tol", "light",
                                         "aw_c", "map_benefit", "temp")])
            ids.append(c["id"])
        X = np.array(rows, float)
        self.knn_scaler = StandardScaler().fit(X)
        self.knn = NearestNeighbors(n_neighbors=6).fit(self.knn_scaler.transform(X))
        self.knn_ids = ids

    # ------------------------------------------------------------------ inference
    def predict(self, p: Profile) -> dict:
        f = features_from_profile(p)
        x = _vec(f)
        proba = self.clf.predict_proba(x)[0]
        fam = {c: float(v) for c, v in zip(self.classes_, proba)}
        top = sorted(fam.items(), key=lambda t: -t[1])[:5]
        out = dict(
            model_version=self.meta.get("version"),
            family_proba=fam,
            top_families=[dict(family=k, label=MATERIAL_FAMILIES.get(k, k), probability=round(v, 3)) for k, v in top],
            predicted_family=top[0][0],
            predicted_family_label=MATERIAL_FAMILIES.get(top[0][0], top[0][0]),
        )
        if "y_otr" in self.reg:
            out["predicted_otr_max_spec"] = round(10 ** float(self.reg["y_otr"].predict(x)[0]), 3)
        if "y_wvtr" in self.reg:
            out["predicted_wvtr_max_spec"] = round(10 ** float(self.reg["y_wvtr"].predict(x)[0]), 3)
        if "y_life" in self.reg:
            out["predicted_best_shelf_life_days"] = round(10 ** float(self.reg["y_life"].predict(x)[0]), 1)
        # similar commodities
        q = [[f[k] for k in ("moisture", "fat", "protein", "ph", "aw", "log_rr", "log_o2_tol", "light", "aw_c",
                             "map_benefit", "temp")]]
        dist, idx = self.knn.kneighbors(self.knn_scaler.transform(np.array(q, float)))
        sims = []
        for d, i in zip(dist[0], idx[0]):
            cid = self.knn_ids[i]
            if cid == p.commodity_id:
                continue
            c = COMMODITY_INDEX[cid]
            sims.append(dict(id=cid, name=c["name"], similarity=round(float(1 / (1 + d)), 3),
                             typical_packaging=[MATERIAL_FAMILIES.get(x, x) for x in c.get("practice", [])[:2]]))
        out["similar_commodities"] = sims[:5]
        out["top_features"] = self.meta.get("feature_importance", [])[:8]
        return out

    # ------------------------------------------------------------------ persistence
    def save(self, path: Path = MODEL_DIR):
        path.mkdir(parents=True, exist_ok=True)
        joblib.dump(dict(clf=self.clf, reg=self.reg, meta=self.meta, classes=self.classes_), path / "model.joblib",
                    compress=3)
        (path / "model_meta.json").write_text(json.dumps(self.meta, indent=2))

    @classmethod
    def load(cls, path: Path = MODEL_DIR) -> "PackagingModel | None":
        f = path / "model.joblib"
        if not f.exists():
            return None
        d = joblib.load(f)
        m = cls()
        m.clf, m.reg, m.meta, m.classes_ = d["clf"], d["reg"], d["meta"], d["classes"]
        m._fit_knn()
        return m


def load_user_data() -> pd.DataFrame | None:
    if USER_DATA.exists():
        df = pd.read_csv(USER_DATA)
        return df if len(df) else None
    return None


def append_user_rows(rows: list[dict]):
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(rows)
    header = not USER_DATA.exists()
    df.to_csv(USER_DATA, mode="a", header=header, index=False)


def train_and_save(samples_per_commodity: int = 50, progress: bool = True) -> PackagingModel:
    base_csv = MODEL_DIR / "training_data.csv"
    if base_csv.exists():
        df = pd.read_csv(base_csv)
    else:
        df = generate_dataset(samples_per_commodity, progress=progress)
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        df.to_csv(base_csv, index=False)
    m = PackagingModel()
    m.train(df, load_user_data())
    m.save()
    return m
