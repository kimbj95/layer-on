"""End-to-end test: upload → apply → download → verify output DXF."""

import io
import shutil

import ezdxf
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.upload import SESSIONS_DIR


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sample_dxf(tmp_path):
    doc = ezdxf.new("R2018")
    doc.layers.add("A0013111", color=1)   # 고속국도
    doc.layers.add("B0014110", color=2)   # 건물
    doc.layers.add("E0022110", color=5)   # 수계
    doc.layers.add("XYZLAYER", color=7)   # unknown
    path = tmp_path / "pipeline_test.dxf"
    doc.saveas(str(path))
    return path


@pytest.fixture(autouse=True)
def cleanup():
    yield
    if SESSIONS_DIR.exists():
        shutil.rmtree(SESSIONS_DIR, ignore_errors=True)


class TestFullPipeline:
    def test_upload_apply_download_reread(self, client, sample_dxf):
        """Complete cycle: upload, apply overrides, download, verify."""

        # 1. Upload
        with open(sample_dxf, "rb") as f:
            resp = client.post(
                "/api/upload",
                files={"file": ("test.dxf", f, "application/octet-stream")},
            )
        assert resp.status_code == 200
        session = resp.json()
        sid = session["session_id"]
        assert session["total_layers"] > 0

        # 2. Apply with overrides
        overrides = {
            "A0013111": {"color": "#112233"},
            "B0014110": {"color": "#AABBCC"},
        }
        resp = client.post(
            f"/api/session/{sid}/apply",
            json={"layer_overrides": overrides},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

        # 3. Download
        resp = client.get(f"/api/session/{sid}/download")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/dxf"
        dxf_bytes = resp.content
        assert len(dxf_bytes) > 100

        # 4. Re-read with ezdxf and verify
        doc = ezdxf.read(io.StringIO(dxf_bytes.decode("utf-8")))

        # Overridden layers
        highway = doc.layers.get("A0013111")
        assert highway.rgb == (0x11, 0x22, 0x33)

        building = doc.layers.get("B0014110")
        assert building.rgb == (0xAA, 0xBB, 0xCC)

        # Non-overridden layer gets mapper default
        water = doc.layers.get("E0022110")
        assert water.rgb is not None
        assert water.rgb == (0x85, 0xC1, 0xFF)  # #85C1FF

        # Unknown layer gets fallback color
        unknown = doc.layers.get("XYZLAYER")
        assert unknown.rgb is not None

    def test_descriptions_contain_korean(self, client, sample_dxf):
        """Verify Korean names are set in layer descriptions."""
        with open(sample_dxf, "rb") as f:
            resp = client.post(
                "/api/upload",
                files={"file": ("test.dxf", f, "application/octet-stream")},
            )
        sid = resp.json()["session_id"]
        client.post(f"/api/session/{sid}/apply", json={"layer_overrides": {}})

        doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))

        highway = doc.layers.get("A0013111")
        assert "고속국도" in highway.description

        building = doc.layers.get("B0014110")
        assert "건물" in building.description

    def test_session_state_reflects_output(self, client, sample_dxf):
        """After apply, session state should show has_output."""
        with open(sample_dxf, "rb") as f:
            resp = client.post(
                "/api/upload",
                files={"file": ("test.dxf", f, "application/octet-stream")},
            )
        sid = resp.json()["session_id"]
        client.post(f"/api/session/{sid}/apply", json={"layer_overrides": {}})

        resp = client.get(f"/api/session/{sid}")
        assert resp.status_code == 200
        state = resp.json()
        assert state["has_output"] is True
        assert state["output_filename"] == "layeron_test.dxf"

    def test_multiple_applies_last_wins(self, client, sample_dxf):
        """Multiple applies should overwrite — last color wins."""
        with open(sample_dxf, "rb") as f:
            resp = client.post(
                "/api/upload",
                files={"file": ("test.dxf", f, "application/octet-stream")},
            )
        sid = resp.json()["session_id"]

        # First apply: red
        client.post(
            f"/api/session/{sid}/apply",
            json={"layer_overrides": {"A0013111": {"color": "#FF0000"}}},
        )
        # Second apply: blue
        client.post(
            f"/api/session/{sid}/apply",
            json={"layer_overrides": {"A0013111": {"color": "#0000FF"}}},
        )

        resp = client.get(f"/api/session/{sid}/download")
        doc = ezdxf.read(io.StringIO(resp.content.decode("utf-8")))
        assert doc.layers.get("A0013111").rgb == (0, 0, 255)
