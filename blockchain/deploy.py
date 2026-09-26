"""
Deploy PackChainAnchor to an EVM network.

    pip install web3
    export PACKAI_EVM_RPC_URL=https://rpc-amoy.polygon.technology
    export PACKAI_EVM_PRIVATE_KEY=0x...        # funded test account
    python blockchain/deploy.py

Prints the contract address — set it as PACKAI_EVM_CONTRACT for the backend.
"""
import json
import os
from pathlib import Path

from web3 import Web3

HERE = Path(__file__).parent
rpc = os.environ["PACKAI_EVM_RPC_URL"]
key = os.environ["PACKAI_EVM_PRIVATE_KEY"]
chain_id = int(os.environ.get("PACKAI_EVM_CHAIN_ID", "80002"))

w3 = Web3(Web3.HTTPProvider(rpc))
acct = w3.eth.account.from_key(key)
abi = json.loads((HERE / "build" / "PackChainAnchor.abi.json").read_text())
bytecode = "0x" + (HERE / "build" / "PackChainAnchor.bin").read_text().strip()
Contract = w3.eth.contract(abi=abi, bytecode=bytecode)
tx = Contract.constructor().build_transaction({"from": acct.address, "nonce": w3.eth.get_transaction_count(acct.address),
                                               "chainId": chain_id})
signed = acct.sign_transaction(tx)
h = w3.eth.send_raw_transaction(signed.raw_transaction)
r = w3.eth.wait_for_transaction_receipt(h, timeout=300)
print("PackChainAnchor deployed at", r.contractAddress, "tx", h.hex())
