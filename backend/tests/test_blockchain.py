import json

from sqlalchemy import select

from app.blockchain.ledger import Ledger, merkle_proof, merkle_root, sha256, verify_merkle_proof
from app.database import SessionLocal, init_db
from app.models import Actor, BlockRow


def test_merkle_proofs_all_leaves():
    leaves = [sha256(str(i)) for i in range(7)]
    root = merkle_root(leaves)
    for i, leaf in enumerate(leaves):
        assert verify_merkle_proof(leaf, merkle_proof(leaves, i), root)
    assert not verify_merkle_proof(sha256("x"), merkle_proof(leaves, 0), root)


def test_chain_valid_then_tamper_detected():
    init_db()
    with SessionLocal() as db:
        led = Ledger(db)
        led.ensure_genesis()
        actor, key, _ = led.register_actor("Test Packer", "packer", "Org", "Pune")
        assert led.authenticate(actor.id, key)
        assert not led.authenticate(actor.id, "wrong")
        tx = led.make_tx(actor, "CUSTODY_EVENT", {"batch_id": "PB-T", "event": "packed"})
        led.submit([tx])
        assert led.validate_chain()["valid"]
        proof = led.proof(tx["tx_id"])
        assert proof["signature_valid"] and proof["merkle_valid"]

        # tamper with the stored payload
        b = db.scalar(select(BlockRow).order_by(BlockRow.idx.desc()))
        txs = json.loads(b.tx_json)
        txs[0]["body"]["payload"]["event"] = "sold"
        b.tx_json = json.dumps(txs)
        db.commit()
        v = led.validate_chain()
        assert not v["valid"]
        assert any("signature" in e["error"] for e in v["errors"])


def test_forged_signature_rejected():
    init_db()
    with SessionLocal() as db:
        led = Ledger(db)
        led.ensure_genesis()
        a = db.get(Actor, "SYSTEM")
        tx = led.make_tx(a, "CUSTODY_EVENT", {"batch_id": "X"})
        tx["body"]["payload"]["batch_id"] = "Y"
        try:
            led.submit([tx])
            assert False, "forged tx accepted"
        except ValueError:
            pass
