"""
Optional anchoring of PackChain block hashes to a public EVM chain (Polygon Amoy by default)
through the PackChainAnchor smart contract (blockchain/contracts/PackChainAnchor.sol).

Enabled only when PACKAI_EVM_RPC_URL, PACKAI_EVM_PRIVATE_KEY and PACKAI_EVM_CONTRACT are set and
`web3` is installed (pip install web3).  Otherwise the platform works fully offline and anchoring
reports `configured: false`.
"""
from __future__ import annotations

import json
from pathlib import Path

from ..config import EVM_CHAIN_ID, EVM_CONTRACT, EVM_PRIVATE_KEY, EVM_RPC_URL, ROOT

ABI_FILE = ROOT / "blockchain" / "build" / "PackChainAnchor.abi.json"


def status() -> dict:
    try:
        import web3  # noqa: F401
        has_web3 = True
    except ImportError:
        has_web3 = False
    return dict(configured=bool(EVM_RPC_URL and EVM_PRIVATE_KEY and EVM_CONTRACT and has_web3), web3_installed=has_web3,
                rpc=EVM_RPC_URL or None, contract=EVM_CONTRACT or None, chain_id=EVM_CHAIN_ID,
                abi_available=ABI_FILE.exists())


def anchor_block(block_index: int, block_hash: str, merkle_root: str) -> dict:
    st = status()
    if not st["configured"]:
        return dict(ok=False, reason="Public-chain anchoring not configured (set PACKAI_EVM_* env vars and install web3).",
                    **st)
    from web3 import Web3
    w3 = Web3(Web3.HTTPProvider(EVM_RPC_URL))
    acct = w3.eth.account.from_key(EVM_PRIVATE_KEY)
    contract = w3.eth.contract(address=Web3.to_checksum_address(EVM_CONTRACT), abi=json.loads(ABI_FILE.read_text()))
    tx = contract.functions.anchor(block_index, bytes.fromhex(block_hash), bytes.fromhex(merkle_root)).build_transaction({
        "from": acct.address, "nonce": w3.eth.get_transaction_count(acct.address), "chainId": EVM_CHAIN_ID,
    })
    signed = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    return dict(ok=receipt.status == 1, tx_hash=tx_hash.hex(), block_number=receipt.blockNumber, **st)
