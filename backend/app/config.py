"""Runtime configuration (environment variables with sensible defaults)."""
import os
import secrets
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("PACKAI_DATA_DIR", ROOT / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_URL = os.environ.get("PACKAI_DATABASE_URL", f"sqlite:///{DATA_DIR / 'packai.db'}")
FRONTEND_DIR = Path(os.environ.get("PACKAI_FRONTEND_DIR", ROOT / "frontend"))
# Render injects RENDER_EXTERNAL_URL; QR codes and report links must point at the public address.
PUBLIC_BASE_URL = (os.environ.get("PACKAI_PUBLIC_URL") or os.environ.get("RENDER_EXTERNAL_URL")
                   or "http://localhost:8000").rstrip("/")
POW_DIFFICULTY = int(os.environ.get("PACKAI_POW_DIFFICULTY", "3"))  # leading hex zeros

# Optional public-chain anchoring (Polygon / any EVM).  Leave empty to run fully offline.
EVM_RPC_URL = os.environ.get("PACKAI_EVM_RPC_URL", "")
EVM_PRIVATE_KEY = os.environ.get("PACKAI_EVM_PRIVATE_KEY", "")
EVM_CONTRACT = os.environ.get("PACKAI_EVM_CONTRACT", "")
EVM_CHAIN_ID = int(os.environ.get("PACKAI_EVM_CHAIN_ID", "80002"))  # Polygon Amoy testnet


def _secret() -> str:
    env = os.environ.get("PACKAI_SECRET_KEY")
    if env:
        return env
    f = DATA_DIR / ".secret_key"
    if not f.exists():
        f.write_text(secrets.token_urlsafe(48))
        f.chmod(0o600)
    return f.read_text().strip()


SECRET_KEY = _secret()
