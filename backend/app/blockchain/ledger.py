"""
PackChain — a permissioned, tamper-evident ledger for packaging traceability.

Design
  * Every stakeholder (farmer, packer, packaging supplier, transporter, warehouse, retailer, lab,
    regulator) is an *actor* with an Ed25519 key-pair.  Private keys are stored encrypted (Fernet,
    key derived from the server secret) — custodial wallets so that farmers need no crypto knowledge.
  * A transaction = canonical-JSON body + Ed25519 signature; tx_id = SHA-256(body).
  * Blocks hold a Merkle root of their transactions, link to the previous block hash and carry a
    light proof-of-work (configurable difficulty) — rewriting history requires re-mining every
    subsequent block AND re-signing with every actor's key.
  * validate_chain() re-verifies hashes, Merkle roots, PoW, links and every signature.
  * Merkle inclusion proofs let a consumer verify one record without the whole chain.
  * Block hashes can optionally be anchored to a public EVM chain (see anchor.py + PackChainAnchor.sol)
    for trust beyond the operator.
"""
from __future__ import annotations

import base64
import hashlib
import json
import secrets
import time

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives import serialization
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import POW_DIFFICULTY, SECRET_KEY
from ..models import Actor, BlockRow, TxIndex

GENESIS_PREV = "0" * 64
SYSTEM_ACTOR = "SYSTEM"
ROLES = ["authority", "farmer", "processor", "packer", "packaging_supplier", "transporter", "warehouse", "retailer",
         "lab", "regulator", "consumer"]
TX_TYPES = ["ACTOR_REGISTERED", "RECOMMENDATION_CERTIFIED", "BATCH_CREATED", "CUSTODY_EVENT", "MATERIAL_CERTIFIED",
            "QUALITY_CHECK", "ANCHORED"]


# ---------------------------------------------------------------------------- primitives
def canonical(obj) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str).encode()


def sha256(data: bytes | str) -> str:
    if isinstance(data, str):
        data = data.encode()
    return hashlib.sha256(data).hexdigest()


def _fernet() -> Fernet:
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(SECRET_KEY.encode()).digest()))


def new_keypair() -> tuple[str, str]:
    sk = Ed25519PrivateKey.generate()
    pk = sk.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw).hex()
    raw = sk.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption())
    return pk, _fernet().encrypt(raw).decode()


def sign(enc_private_key: str, message: bytes) -> str:
    raw = _fernet().decrypt(enc_private_key.encode())
    return Ed25519PrivateKey.from_private_bytes(raw).sign(message).hex()


def verify_sig(public_key_hex: str, message: bytes, sig_hex: str) -> bool:
    try:
        Ed25519PublicKey.from_public_bytes(bytes.fromhex(public_key_hex)).verify(bytes.fromhex(sig_hex), message)
        return True
    except Exception:
        return False


def merkle_root(hashes: list[str]) -> str:
    if not hashes:
        return sha256(b"")
    level = list(hashes)
    while len(level) > 1:
        if len(level) % 2:
            level.append(level[-1])
        level = [sha256(level[i] + level[i + 1]) for i in range(0, len(level), 2)]
    return level[0]


def merkle_proof(hashes: list[str], index: int) -> list[dict]:
    proof, level, idx = [], list(hashes), index
    while len(level) > 1:
        if len(level) % 2:
            level.append(level[-1])
        sib = idx ^ 1
        proof.append({"position": "left" if sib < idx else "right", "hash": level[sib]})
        level = [sha256(level[i] + level[i + 1]) for i in range(0, len(level), 2)]
        idx //= 2
    return proof


def verify_merkle_proof(leaf: str, proof: list[dict], root: str) -> bool:
    h = leaf
    for step in proof:
        h = sha256(step["hash"] + h) if step["position"] == "left" else sha256(h + step["hash"])
    return h == root


def block_header(idx: int, ts: float, prev: str, root: str, nonce: int, diff: int) -> bytes:
    return canonical({"index": idx, "timestamp": round(ts, 6), "prev_hash": prev, "merkle_root": root,
                      "nonce": nonce, "difficulty": diff})


def mine(idx: int, ts: float, prev: str, root: str, diff: int) -> tuple[int, str]:
    target = "0" * diff
    nonce = 0
    while True:
        h = sha256(block_header(idx, ts, prev, root, nonce, diff))
        if h.startswith(target):
            return nonce, h
        nonce += 1


# ---------------------------------------------------------------------------- ledger
class Ledger:
    def __init__(self, db: Session):
        self.db = db

    # ---- actors ------------------------------------------------------------
    def ensure_genesis(self):
        if self.db.get(Actor, SYSTEM_ACTOR) is None:
            pk, enc = new_keypair()
            self.db.add(Actor(id=SYSTEM_ACTOR, name="PackChain Authority", role="authority", org="PackAI platform",
                              location="-", public_key=pk, enc_private_key=enc, api_key_hash=sha256(secrets.token_hex(32))))
            self.db.commit()
        if self.db.scalar(select(BlockRow).where(BlockRow.idx == 0)) is None:
            sysact = self.db.get(Actor, SYSTEM_ACTOR)
            tx = self._make_tx(sysact, "ACTOR_REGISTERED", {"actor_id": SYSTEM_ACTOR, "name": sysact.name,
                                                            "role": "authority", "public_key": sysact.public_key,
                                                            "genesis": True})
            self._commit_block([tx], index=0, prev=GENESIS_PREV)

    def register_actor(self, name: str, role: str, org: str | None, location: str | None) -> tuple[Actor, str, dict]:
        if role not in ROLES:
            raise ValueError(f"role must be one of {ROLES}")
        pk, enc = new_keypair()
        api_key = "pk_" + secrets.token_urlsafe(24)
        aid = "ACT-" + secrets.token_hex(4).upper()
        actor = Actor(id=aid, name=name, role=role, org=org, location=location, public_key=pk, enc_private_key=enc,
                      api_key_hash=sha256(api_key))
        self.db.add(actor)
        self.db.commit()
        sysact = self.db.get(Actor, SYSTEM_ACTOR)
        tx = self._make_tx(sysact, "ACTOR_REGISTERED", {"actor_id": aid, "name": name, "role": role, "org": org,
                                                        "location": location, "public_key": pk})
        block = self.submit([tx])
        return actor, api_key, block

    def authenticate(self, actor_id: str, api_key: str) -> Actor | None:
        a = self.db.get(Actor, actor_id)
        if a and secrets.compare_digest(a.api_key_hash, sha256(api_key or "")):
            return a
        return None

    # ---- transactions --------------------------------------------------------
    def _make_tx(self, actor: Actor, tx_type: str, payload: dict) -> dict:
        body = {"type": tx_type, "actor_id": actor.id, "actor_pub": actor.public_key, "timestamp": round(time.time(), 3),
                "payload": payload, "salt": secrets.token_hex(8)}
        msg = canonical(body)
        return {"tx_id": sha256(msg), "body": body, "signature": sign(actor.enc_private_key, msg)}

    def make_tx(self, actor: Actor, tx_type: str, payload: dict) -> dict:
        if tx_type not in TX_TYPES:
            raise ValueError("unknown transaction type")
        return self._make_tx(actor, tx_type, payload)

    @staticmethod
    def verify_tx(tx: dict) -> bool:
        msg = canonical(tx["body"])
        return sha256(msg) == tx["tx_id"] and verify_sig(tx["body"]["actor_pub"], msg, tx["signature"])

    def submit(self, txs: list[dict]) -> dict:
        for tx in txs:
            if not self.verify_tx(tx):
                raise ValueError(f"invalid signature for tx {tx.get('tx_id')}")
        last = self.db.scalar(select(BlockRow).order_by(BlockRow.idx.desc()).limit(1))
        return self._commit_block(txs, index=last.idx + 1, prev=last.hash)

    def _commit_block(self, txs: list[dict], index: int, prev: str) -> dict:
        ts = time.time()
        root = merkle_root([t["tx_id"] for t in txs])
        nonce, h = mine(index, ts, prev, root, POW_DIFFICULTY)
        row = BlockRow(idx=index, hash=h, prev_hash=prev, merkle_root=root, nonce=nonce, difficulty=POW_DIFFICULTY,
                       timestamp=ts, tx_json=json.dumps(txs, ensure_ascii=False))
        self.db.add(row)
        for t in txs:
            p = t["body"]["payload"]
            self.db.add(TxIndex(tx_id=t["tx_id"], block_idx=index, type=t["body"]["type"], actor_id=t["body"]["actor_id"],
                                batch_id=p.get("batch_id"), timestamp=t["body"]["timestamp"]))
        self.db.commit()
        return self.block_dict(row)

    # ---- queries -------------------------------------------------------------
    @staticmethod
    def block_dict(b: BlockRow, with_tx: bool = True) -> dict:
        d = dict(index=b.idx, hash=b.hash, prev_hash=b.prev_hash, merkle_root=b.merkle_root, nonce=b.nonce,
                 difficulty=b.difficulty, timestamp=b.timestamp, anchor_tx=b.anchor_tx)
        txs = json.loads(b.tx_json)
        d["tx_count"] = len(txs)
        if with_tx:
            d["transactions"] = txs
        return d

    def blocks(self, limit: int = 50, offset: int = 0) -> list[dict]:
        rows = self.db.scalars(select(BlockRow).order_by(BlockRow.idx.desc()).offset(offset).limit(limit)).all()
        return [self.block_dict(r, with_tx=True) for r in rows]

    def height(self) -> int:
        last = self.db.scalar(select(BlockRow).order_by(BlockRow.idx.desc()).limit(1))
        return last.idx if last else -1

    def get_tx(self, tx_id: str) -> tuple[dict, BlockRow] | tuple[None, None]:
        ix = self.db.get(TxIndex, tx_id)
        if not ix:
            return None, None
        b = self.db.get(BlockRow, ix.block_idx)
        for t in json.loads(b.tx_json):
            if t["tx_id"] == tx_id:
                return t, b
        return None, None

    def proof(self, tx_id: str) -> dict | None:
        tx, b = self.get_tx(tx_id)
        if not tx:
            return None
        ids = [t["tx_id"] for t in json.loads(b.tx_json)]
        pr = merkle_proof(ids, ids.index(tx_id))
        return dict(tx_id=tx_id, block_index=b.idx, block_hash=b.hash, merkle_root=b.merkle_root, proof=pr,
                    signature_valid=self.verify_tx(tx), merkle_valid=verify_merkle_proof(tx_id, pr, b.merkle_root),
                    anchor_tx=b.anchor_tx)

    def batch_history(self, batch_id: str) -> list[dict]:
        ixs = self.db.scalars(select(TxIndex).where(TxIndex.batch_id == batch_id).order_by(TxIndex.timestamp)).all()
        out = []
        for ix in ixs:
            tx, b = self.get_tx(ix.tx_id)
            a = self.db.get(Actor, ix.actor_id)
            out.append(dict(tx_id=ix.tx_id, type=ix.type, block_index=b.idx, block_hash=b.hash,
                            timestamp=tx["body"]["timestamp"], actor=dict(id=a.id, name=a.name, role=a.role, org=a.org)
                            if a else {"id": ix.actor_id}, payload=tx["body"]["payload"],
                            signature_valid=self.verify_tx(tx)))
        return out

    # ---- validation -------------------------------------------------------------
    def validate_chain(self) -> dict:
        rows = self.db.scalars(select(BlockRow).order_by(BlockRow.idx)).all()
        errors = []
        prev = GENESIS_PREV
        n_tx = 0
        for b in rows:
            txs = json.loads(b.tx_json)
            n_tx += len(txs)
            if b.prev_hash != prev:
                errors.append(dict(block=b.idx, error="broken link to previous block"))
            root = merkle_root([t["tx_id"] for t in txs])
            if root != b.merkle_root:
                errors.append(dict(block=b.idx, error="merkle root mismatch (transactions altered)"))
            h = sha256(block_header(b.idx, b.timestamp, b.prev_hash, b.merkle_root, b.nonce, b.difficulty))
            if h != b.hash:
                errors.append(dict(block=b.idx, error="block hash mismatch (header altered)"))
            if not h.startswith("0" * b.difficulty):
                errors.append(dict(block=b.idx, error="proof-of-work not satisfied"))
            for t in txs:
                if not self.verify_tx(t):
                    errors.append(dict(block=b.idx, tx=t.get("tx_id"), error="invalid transaction hash or signature"))
            prev = b.hash
        return dict(valid=not errors, blocks=len(rows), transactions=n_tx, errors=errors,
                    head=rows[-1].hash if rows else None, checked_at=time.strftime("%Y-%m-%d %H:%M:%S"))
