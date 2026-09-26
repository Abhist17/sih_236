import json
import secrets
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..blockchain import anchor as anchor_mod
from ..blockchain.ledger import ROLES, SYSTEM_ACTOR, Ledger, canonical, sha256
from ..config import PUBLIC_BASE_URL
from ..data.materials import SOLUTION_INDEX
from ..database import get_db
from ..engine.profile import build_profile
from ..engine.recommender import analyse_solution, shelf_life_at
from ..models import Actor, Batch, BlockRow, RecommendationRecord
from ..reports.pdf import batch_label_pdf, qr_png
from ..schemas import ActorIn, BatchIn, EventIn, MaterialCertIn

router = APIRouter(prefix="/api/chain", tags=["blockchain"])


def ledger(db: Session = Depends(get_db)) -> Ledger:
    led = Ledger(db)
    led.ensure_genesis()
    return led


def auth(x_actor_id: str = Header(...), x_api_key: str = Header(...), db: Session = Depends(get_db)) -> Actor:
    a = Ledger(db).authenticate(x_actor_id, x_api_key)
    if not a:
        raise HTTPException(401, "invalid actor credentials (X-Actor-Id / X-Api-Key)")
    return a


# ---------------------------------------------------------------- actors
@router.get("/roles")
def roles():
    return [r for r in ROLES if r not in ("authority",)]


@router.post("/actors")
def register_actor(body: ActorIn, led: Ledger = Depends(ledger)):
    if body.role not in ROLES or body.role == "authority":
        raise HTTPException(422, f"role must be one of {[r for r in ROLES if r != 'authority']}")
    actor, api_key, block = led.register_actor(body.name, body.role, body.org, body.location)
    return dict(actor_id=actor.id, api_key=api_key, public_key=actor.public_key, block_index=block["index"],
                message="Store the API key safely — it is shown only once.")


@router.get("/actors")
def list_actors(db: Session = Depends(get_db), led: Ledger = Depends(ledger)):
    rows = db.scalars(select(Actor).order_by(Actor.created_at.desc())).all()
    return [dict(id=a.id, name=a.name, role=a.role, org=a.org, location=a.location, public_key=a.public_key,
                 created_at=a.created_at.isoformat()) for a in rows]


@router.get("/me")
def me(actor: Actor = Depends(auth)):
    return dict(id=actor.id, name=actor.name, role=actor.role, org=actor.org, location=actor.location)


# ---------------------------------------------------------------- batches
def _batch_out(b: Batch) -> dict:
    spec = json.loads(b.spec_json)
    return dict(id=b.id, rec_id=b.rec_id, commodity=b.commodity, commodity_id=b.commodity_id, solution_id=b.solution_id,
                solution_name=b.solution_name, quantity=b.quantity, unit=b.unit, pack_date=b.pack_date,
                best_before=b.best_before, created_by=b.created_by, created_at=b.created_at.isoformat(),
                status=b.status, spec=spec, spec_hash=b.spec_hash, genesis_tx=b.genesis_tx,
                verify_url=f"{PUBLIC_BASE_URL}/verify/{b.id}", structure=spec.get("structure"),
                storage=spec.get("storage"))


@router.post("/batches")
def create_batch(body: BatchIn, actor: Actor = Depends(auth), db: Session = Depends(get_db),
                 led: Ledger = Depends(ledger)):
    if actor.role not in ("farmer", "processor", "packer"):
        raise HTTPException(403, "only farmer / processor / packer actors can create packed batches")
    rec_hash = None
    if body.rec_id:
        rec = db.get(RecommendationRecord, body.rec_id)
        if not rec:
            raise HTTPException(404, "recommendation not found")
        scenario = json.loads(rec.input_json)
        solution_id = body.solution_id or rec.top_solution
        rec_hash = rec.result_hash
    else:
        if not body.scenario or not body.solution_id:
            raise HTTPException(422, "provide rec_id, or scenario + solution_id")
        scenario = body.scenario.model_dump(exclude_none=True)
        scenario.pop("top_n", None)
        solution_id = body.solution_id
    if solution_id not in SOLUTION_INDEX:
        raise HTTPException(404, "unknown solution")
    a = analyse_solution(scenario, solution_id)
    pack_date = body.pack_date or date.today().isoformat()
    days = int(a["shelf_life"]["predicted_days"])
    best_before = (datetime.fromisoformat(pack_date) + timedelta(days=max(days, 0))).date().isoformat()
    s = a["specs"]
    spec = dict(solution_id=solution_id, name=a["name"], structure=s["structure"], thickness_um=s["total_thickness_um"],
                otr_spec=s["otr_spec"], wvtr_spec=s["wvtr_spec"], map=dict(technique=s["map"]["technique"],
                gas=s["map"].get("gas"), perforations=s["map"].get("perforations"), eq_o2=s["map"].get("eq_o2"),
                eq_co2=s["map"].get("eq_co2")), seal=s["seal"]["method"], predicted_shelf_life_days=a["shelf_life"]["predicted_days"],
                storage=f"{a['storage_temp']} °C", commodity=scenario.get("commodity_id") or scenario.get("name"))
    spec_hash = sha256(canonical(spec))
    bid = "PB-" + secrets.token_hex(4).upper()
    commodity_name = build_profile(scenario).name
    tx = led.make_tx(actor, "BATCH_CREATED", dict(
        batch_id=bid, commodity=commodity_name, solution_id=solution_id, solution_name=a["name"], spec_hash=spec_hash,
        quantity=body.quantity, unit=body.unit, pack_date=pack_date, best_before=best_before, origin=body.origin,
        rec_id=body.rec_id, rec_hash=rec_hash, notes=body.notes))
    block = led.submit([tx])
    b = Batch(id=bid, rec_id=body.rec_id, commodity=commodity_name, commodity_id=scenario.get("commodity_id"),
              solution_id=solution_id, solution_name=a["name"], quantity=body.quantity, unit=body.unit,
              pack_date=pack_date, best_before=best_before, created_by=actor.id, scenario_json=json.dumps(scenario),
              spec_json=json.dumps(spec, ensure_ascii=False), spec_hash=spec_hash, status="packed", genesis_tx=tx["tx_id"])
    db.add(b)
    db.commit()
    out = _batch_out(b)
    out.update(tx_id=tx["tx_id"], block_index=block["index"])
    return out


@router.get("/batches")
def list_batches(db: Session = Depends(get_db)):
    rows = db.scalars(select(Batch).order_by(Batch.created_at.desc()).limit(200)).all()
    return [_batch_out(b) for b in rows]


def _get_batch(db, bid) -> Batch:
    b = db.get(Batch, bid)
    if not b:
        raise HTTPException(404, "batch not found")
    return b


@router.post("/batches/{bid}/events")
def add_event(bid: str, ev: EventIn, actor: Actor = Depends(auth), db: Session = Depends(get_db),
              led: Ledger = Depends(ledger)):
    b = _get_batch(db, bid)
    if b.status in ("sold", "recalled") and ev.event not in ("quality_check",):
        raise HTTPException(409, f"batch is {b.status}")
    if ev.event == "recalled" and actor.role not in ("regulator", "processor", "packer", "lab"):
        raise HTTPException(403, "only regulator / processor / packer / lab can recall")
    payload = dict(batch_id=bid, event=ev.event, location=ev.location, temperature_c=ev.temperature_c, rh=ev.rh,
                   duration_h=ev.duration_h, notes=ev.notes, quality=ev.quality)
    tx = led.make_tx(actor, "QUALITY_CHECK" if ev.event == "quality_check" else "CUSTODY_EVENT", payload)
    block = led.submit([tx])
    if ev.event not in ("temperature_log", "quality_check"):
        b.status = ev.event
    db.commit()
    return dict(tx_id=tx["tx_id"], block_index=block["index"], block_hash=block["hash"], status=b.status)


@router.post("/material-certificates")
def material_certificate(body: MaterialCertIn, actor: Actor = Depends(auth), led: Ledger = Depends(ledger),
                         db: Session = Depends(get_db)):
    if actor.role not in ("packaging_supplier", "lab", "regulator"):
        raise HTTPException(403, "only packaging suppliers, labs or regulators can certify materials")
    sol = SOLUTION_INDEX.get(body.material_id)
    if not sol:
        raise HTTPException(404, "unknown material")
    conform = {}
    if body.batch_id:
        spec = json.loads(_get_batch(db, body.batch_id).spec_json)
        if body.measured_otr is not None and spec.get("otr_spec") is not None:
            conform["otr"] = body.measured_otr <= spec["otr_spec"] * 1.2
        if body.measured_wvtr is not None and spec.get("wvtr_spec") is not None:
            conform["wvtr"] = body.measured_wvtr <= spec["wvtr_spec"] * 1.2
    if body.migration_test_pass is not None:
        conform["migration_IS9845"] = body.migration_test_pass
    payload = body.model_dump()
    payload.update(material_name=sol.get("name"), conformity=conform, conforms=all(conform.values()) if conform else None)
    tx = led.make_tx(actor, "MATERIAL_CERTIFIED", payload)
    block = led.submit([tx])
    return dict(tx_id=tx["tx_id"], block_index=block["index"], conformity=conform)


# ---------------------------------------------------------------- public verification
def _segments(b: Batch, history: list[dict], storage_temp: float) -> list[tuple[float, float]]:
    segs = []
    logged_h = 0.0
    for h in history:
        p = h["payload"]
        if p.get("temperature_c") is not None and p.get("duration_h"):
            segs.append((float(p["temperature_c"]), float(p["duration_h"]) / 24))
            logged_h += float(p["duration_h"])
    elapsed_h = max(0.0, (datetime.now() - datetime.fromisoformat(b.pack_date)).total_seconds() / 3600)
    if elapsed_h > logged_h:
        segs.append((storage_temp, (elapsed_h - logged_h) / 24))
    return segs


@router.get("/verify/{bid}")
def verify_batch(bid: str, db: Session = Depends(get_db), led: Ledger = Depends(ledger)):
    b = _get_batch(db, bid)
    history = led.batch_history(bid)
    genesis = next((h for h in history if h["type"] == "BATCH_CREATED"), None)
    spec_hash_now = sha256(canonical(json.loads(b.spec_json)))
    on_chain_hash = genesis["payload"]["spec_hash"] if genesis else None
    proofs = [led.proof(h["tx_id"]) for h in history]
    scenario = json.loads(b.scenario_json)
    storage_temp = build_profile(scenario).temp
    try:
        remaining = shelf_life_at(scenario, b.solution_id, _segments(b, history, storage_temp))
    except Exception as ex:  # pragma: no cover
        remaining = dict(error=str(ex))
    excursions = [h for h in history if h["payload"].get("temperature_c") is not None
                  and abs(h["payload"]["temperature_c"] - storage_temp) > 5]
    all_sigs = all(h["signature_valid"] for h in history)
    all_merkle = all(p and p["merkle_valid"] for p in proofs)
    authentic = bool(genesis) and on_chain_hash == spec_hash_now and all_sigs and all_merkle
    certs = []
    for blk in db.scalars(select(BlockRow).order_by(BlockRow.idx)).all():
        for t in json.loads(blk.tx_json):
            if t["body"]["type"] == "MATERIAL_CERTIFIED" and t["body"]["payload"].get("batch_id") == bid:
                a = db.get(Actor, t["body"]["actor_id"])
                certs.append(dict(tx_id=t["tx_id"], supplier=a.name if a else None, **t["body"]["payload"]))
    return dict(
        batch=_batch_out(b), verdict="AUTHENTIC" if authentic else "TAMPERED / UNVERIFIED",
        checks=dict(genesis_on_chain=bool(genesis), spec_hash_matches_chain=on_chain_hash == spec_hash_now,
                    all_signatures_valid=all_sigs, all_merkle_proofs_valid=all_merkle),
        history=history, proofs=proofs, remaining_shelf_life=remaining, temperature_excursions=len(excursions),
        material_certificates=certs, chain_height=led.height())


@router.get("/batches/{bid}/qr.png")
def batch_qr(bid: str, db: Session = Depends(get_db)):
    _get_batch(db, bid)
    return Response(qr_png(f"{PUBLIC_BASE_URL}/verify/{bid}"), media_type="image/png")


@router.get("/batches/{bid}/label.pdf")
def batch_label(bid: str, db: Session = Depends(get_db)):
    b = _get_batch(db, bid)
    return Response(batch_label_pdf(_batch_out(b), f"{PUBLIC_BASE_URL}/verify/{bid}"), media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="label_{bid}.pdf"'})


# ---------------------------------------------------------------- explorer
@router.get("/blocks")
def blocks(limit: int = 30, offset: int = 0, led: Ledger = Depends(ledger)):
    return dict(height=led.height(), blocks=led.blocks(limit, offset))


@router.get("/validate")
def validate(led: Ledger = Depends(ledger)):
    return led.validate_chain()


@router.get("/tx/{tx_id}")
def tx(tx_id: str, led: Ledger = Depends(ledger)):
    t, b = led.get_tx(tx_id)
    if not t:
        raise HTTPException(404, "transaction not found")
    return dict(tx=t, proof=led.proof(tx_id))


@router.get("/anchor/status")
def anchor_status():
    return anchor_mod.status()


@router.post("/anchor")
def anchor_head(db: Session = Depends(get_db), led: Ledger = Depends(ledger)):
    head = db.scalar(select(BlockRow).order_by(BlockRow.idx.desc()).limit(1))
    res = anchor_mod.anchor_block(head.idx, head.hash, head.merkle_root)
    if res.get("ok"):
        head.anchor_tx = res["tx_hash"]
        db.commit()
        sysact = db.get(Actor, SYSTEM_ACTOR)
        led.submit([led.make_tx(sysact, "ANCHORED", dict(block_index=head.idx, block_hash=head.hash,
                                                        evm_tx=res["tx_hash"], chain_id=res["chain_id"]))])
    return res
