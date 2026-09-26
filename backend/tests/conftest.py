import os
import sys
import tempfile
from pathlib import Path

_tmp = tempfile.mkdtemp(prefix="packai-test-")
os.environ["PACKAI_DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["PACKAI_SECRET_KEY"] = "test-secret"
os.environ["PACKAI_POW_DIFFICULTY"] = "2"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.ml.model as _m  # noqa: E402

_m.USER_DATA = Path(_tmp) / "user_data.csv"   # keep feedback rows from tests out of the real training set
