import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch

import ezdxf
import pytest

from app.routers.upload import SESSIONS_DIR


@pytest.fixture
def sample_dxf(tmp_path):
    """Create a minimal valid DXF file using ezdxf."""
    doc = ezdxf.new("R2010")
    doc.layers.add("A0013111", color=1)
    doc.layers.add("B0014110", color=2)
    doc.layers.add("E0022110", color=5)
    doc.layers.add("XYZLAYER", color=7)
    path = tmp_path / "test.dxf"
    doc.saveas(str(path))
    return path


class TestUploadValidation:
    def test_reject_unsupported_format(self, client):
        resp = client.post(
            "/api/upload",
            files={"file": ("drawing.pdf", b"fake content", "application/octet-stream")},
        )
        assert resp.status_code == 400
        assert "DXF 또는 DWG" in resp.json()["detail"]

    def test_reject_no_extension(self, client):
        resp = client.post(
            "/api/upload",
            files={"file": ("drawing", b"fake", "application/octet-stream")},
        )
        assert resp.status_code == 400

    def test_reject_oversized(self, client):
        # 51MB of zeros
        big_content = b"\x00" * (51 * 1024 * 1024)
        resp = client.post(
            "/api/upload",
            files={"file": ("big.dxf", big_content, "application/octet-stream")},
        )
        assert resp.status_code == 413
        assert "50MB" in resp.json()["detail"]


class TestDwgUploadValidation:
    def test_dwg_upload_without_converter(self, client):
        from unittest.mock import patch

        with patch("app.routers.upload.is_converter_available", return_value=False):
            resp = client.post(
                "/api/upload",
                files={"file": ("test.dwg", b"fake", "application/octet-stream")},
            )
        assert resp.status_code == 400
        assert "변환기" in resp.json()["detail"]


class TestUploadSuccess:
    def test_upload_valid_dxf(self, client, sample_dxf):
        with open(sample_dxf, "rb") as f:
            resp = client.post(
                "/api/upload",
                files={"file": ("sample.dxf", f, "application/octet-stream")},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "session_id" in data
        assert data["file_name"] == "sample.dxf"
        assert data["total_layers"] > 0
        assert data["original_format"] == "dxf"
        assert "converter_available" in data
        assert isinstance(data["mapped_count"], int)
        assert isinstance(data["categories"], list)
        assert "created_at" in data

    def test_session_state_saved(self, client, sample_dxf):
        with open(sample_dxf, "rb") as f:
            resp = client.post(
                "/api/upload",
                files={"file": ("test.dxf", f, "application/octet-stream")},
            )
        session_id = resp.json()["session_id"]
        state_path = SESSIONS_DIR / session_id / "state.json"
        assert state_path.exists()
        state = json.loads(state_path.read_text())
        assert state["session_id"] == session_id

    def test_input_dxf_saved(self, client, sample_dxf):
        with open(sample_dxf, "rb") as f:
            resp = client.post(
                "/api/upload",
                files={"file": ("test.dxf", f, "application/octet-stream")},
            )
        session_id = resp.json()["session_id"]
        assert (SESSIONS_DIR / session_id / "input.dxf").exists()

    def test_layer_mapping(self, client, sample_dxf):
        with open(sample_dxf, "rb") as f:
            resp = client.post(
                "/api/upload",
                files={"file": ("test.dxf", f, "application/octet-stream")},
            )
        data = resp.json()
        all_layers = []
        for cat in data["categories"]:
            all_layers.extend(cat["layers"])

        names = {l["original_name"] for l in all_layers}
        assert "A0013111" in names
        assert "B0014110" in names

        highway = next(l for l in all_layers if l["original_name"] == "A0013111")
        assert highway["is_mapped"] is True
        assert "고속국도" in highway["name"]
        assert highway["current_aci_color"] == 1
        assert highway["original_aci_color"] == 1

    def test_unmapped_layers_listed(self, client, sample_dxf):
        with open(sample_dxf, "rb") as f:
            resp = client.post(
                "/api/upload",
                files={"file": ("test.dxf", f, "application/octet-stream")},
            )
        data = resp.json()
        unmapped_names = [l["original_name"] for l in data["unmapped_layers"]]
        assert "XYZLAYER" in unmapped_names


class TestUploadErrors:
    def test_corrupt_dxf(self, client, tmp_path):
        bad_file = tmp_path / "corrupt.dxf"
        bad_file.write_text("this is not a real dxf file")
        with open(bad_file, "rb") as f:
            resp = client.post(
                "/api/upload",
                files={"file": ("corrupt.dxf", f, "application/octet-stream")},
            )
        assert resp.status_code == 422
        assert "DXF 파일을 읽을 수 없습니다" in resp.json()["detail"]


class TestGetSession:
    def test_get_existing_session(self, client, sample_dxf):
        with open(sample_dxf, "rb") as f:
            resp = client.post(
                "/api/upload",
                files={"file": ("test.dxf", f, "application/octet-stream")},
            )
        session_id = resp.json()["session_id"]

        resp2 = client.get(f"/api/session/{session_id}")
        assert resp2.status_code == 200
        assert resp2.json()["session_id"] == session_id
        assert resp2.json()["file_name"] == "test.dxf"

    def test_get_nonexistent_session(self, client):
        resp = client.get("/api/session/does-not-exist")
        assert resp.status_code == 404


class TestCleanup:
    def test_cleanup_old_sessions(self):
        from app.routers.upload import cleanup_old_sessions

        # Create a fake old session
        old_id = "old-session-id"
        old_dir = SESSIONS_DIR / old_id
        old_dir.mkdir(parents=True, exist_ok=True)
        old_time = (datetime.now(timezone.utc) - timedelta(hours=25)).isoformat()
        state = {"session_id": old_id, "created_at": old_time}
        (old_dir / "state.json").write_text(json.dumps(state))

        # Create a recent session
        new_id = "new-session-id"
        new_dir = SESSIONS_DIR / new_id
        new_dir.mkdir(parents=True, exist_ok=True)
        new_time = datetime.now(timezone.utc).isoformat()
        state2 = {"session_id": new_id, "created_at": new_time}
        (new_dir / "state.json").write_text(json.dumps(state2))

        cleanup_old_sessions(max_age_hours=24)

        assert not old_dir.exists()
        assert new_dir.exists()
