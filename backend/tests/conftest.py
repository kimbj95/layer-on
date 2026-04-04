import shutil

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.upload import SESSIONS_DIR


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def cleanup_sessions():
    yield
    if SESSIONS_DIR.exists():
        shutil.rmtree(SESSIONS_DIR, ignore_errors=True)
