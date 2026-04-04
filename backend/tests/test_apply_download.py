import json

import ezdxf
import pytest

from app.routers.upload import SESSIONS_DIR


@pytest.fixture
def sample_dxf(tmp_path):
    """Create a DXF with known layers."""
    doc = ezdxf.new("R2018")
    doc.layers.add("A0013111", color=1)
    doc.layers.add("B0014110", color=2)
    doc.layers.add("E0022110", color=5)
    doc.layers.add("XYZLAYER", color=7)
    path = tmp_path / "test.dxf"
    doc.saveas(str(path))
    return path


@pytest.fixture
def uploaded_session(client, sample_dxf):
    """Upload a DXF and return the session data."""
    with open(sample_dxf, "rb") as f:
        resp = client.post(
            "/api/upload",
            files={"file": ("test.dxf", f, "application/octet-stream")},
        )
    assert resp.status_code == 200
    return resp.json()


class TestApplyDefaults:
    def test_apply_no_overrides(self, client, uploaded_session):
        sid = uploaded_session["session_id"]
        resp = client.post(f"/api/session/{sid}/apply", json={"layer_overrides": {}})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["output_filename"] == "layeron_test.dxf"

    def test_output_file_created(self, client, uploaded_session):
        sid = uploaded_session["session_id"]
        client.post(f"/api/session/{sid}/apply", json={"layer_overrides": {}})
        assert (SESSIONS_DIR / sid / "output.dxf").exists()

    def test_state_updated_with_has_output(self, client, uploaded_session):
        sid = uploaded_session["session_id"]
        client.post(f"/api/session/{sid}/apply", json={"layer_overrides": {}})
        state = json.loads((SESSIONS_DIR / sid / "state.json").read_text())
        assert state["has_output"] is True

    def test_rgb_applied_to_layers(self, client, uploaded_session):
        sid = uploaded_session["session_id"]
        client.post(f"/api/session/{sid}/apply", json={"layer_overrides": {}})
        doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))
        highway = doc.layers.get("A0013111")
        assert highway.rgb is not None

    def test_description_set(self, client, uploaded_session):
        sid = uploaded_session["session_id"]
        client.post(f"/api/session/{sid}/apply", json={"layer_overrides": {}})
        doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))
        highway = doc.layers.get("A0013111")
        assert highway.description != ""


class TestApplyOverrides:
    def test_override_color(self, client, uploaded_session):
        sid = uploaded_session["session_id"]
        resp = client.post(
            f"/api/session/{sid}/apply",
            json={
                "layer_overrides": {
                    "A0013111": {"color": "#00FF00"}
                }
            },
        )
        assert resp.status_code == 200
        doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))
        highway = doc.layers.get("A0013111")
        assert highway.rgb == (0, 255, 0)

    def test_override_partial(self, client, uploaded_session):
        """Override only color, linetype should use mapper default."""
        sid = uploaded_session["session_id"]
        resp = client.post(
            f"/api/session/{sid}/apply",
            json={
                "layer_overrides": {
                    "B0014110": {"color": "#AABBCC"}
                }
            },
        )
        assert resp.status_code == 200
        doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))
        building = doc.layers.get("B0014110")
        assert building.rgb == (170, 187, 204)

    def test_non_overridden_layers_get_defaults(self, client, uploaded_session):
        sid = uploaded_session["session_id"]
        client.post(
            f"/api/session/{sid}/apply",
            json={"layer_overrides": {"A0013111": {"color": "#00FF00"}}},
        )
        doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))
        # B0014110 should still get its default color (#FFD32A)
        building = doc.layers.get("B0014110")
        assert building.rgb == (255, 211, 42)


class TestApplyErrors:
    def test_apply_nonexistent_session(self, client):
        resp = client.post(
            "/api/session/nonexistent/apply",
            json={"layer_overrides": {}},
        )
        assert resp.status_code == 404

    def test_apply_twice_overwrites(self, client, uploaded_session):
        """Applying twice should work — second apply starts from input.dxf."""
        sid = uploaded_session["session_id"]
        client.post(
            f"/api/session/{sid}/apply",
            json={"layer_overrides": {"A0013111": {"color": "#FF0000"}}},
        )
        client.post(
            f"/api/session/{sid}/apply",
            json={"layer_overrides": {"A0013111": {"color": "#0000FF"}}},
        )
        doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))
        highway = doc.layers.get("A0013111")
        assert highway.rgb == (0, 0, 255)


class TestDownload:
    def test_download_after_apply(self, client, uploaded_session):
        sid = uploaded_session["session_id"]
        client.post(f"/api/session/{sid}/apply", json={"layer_overrides": {}})
        resp = client.get(f"/api/session/{sid}/download")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/dxf"
        assert "layeron_test.dxf" in resp.headers["content-disposition"]
        assert len(resp.content) > 0

    def test_download_before_apply(self, client, uploaded_session):
        sid = uploaded_session["session_id"]
        resp = client.get(f"/api/session/{sid}/download")
        assert resp.status_code == 404
        assert "적용" in resp.json()["detail"]

    def test_download_nonexistent_session(self, client):
        resp = client.get("/api/session/nonexistent/download")
        assert resp.status_code == 404

    def test_download_defaults_to_dxf(self, client, uploaded_session):
        """Apply without output_format should default to DXF."""
        sid = uploaded_session["session_id"]
        client.post(f"/api/session/{sid}/apply", json={"layer_overrides": {}})
        resp = client.get(f"/api/session/{sid}/download")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/dxf"


class TestDwgOutput:
    def test_apply_dwg_without_converter(self, client, uploaded_session):
        from unittest.mock import patch

        sid = uploaded_session["session_id"]
        with patch("app.routers.upload.is_converter_available", return_value=False):
            resp = client.post(
                f"/api/session/{sid}/apply",
                json={"layer_overrides": {}, "output_format": "dwg"},
            )
        assert resp.status_code == 400
        assert "변환기" in resp.json()["detail"]


class TestHiddenLayers:
    def test_hidden_layers_removed_from_output(self, client, uploaded_session):
        """Hidden layers should have their entities removed from output."""
        sid = uploaded_session["session_id"]
        resp = client.post(
            f"/api/session/{sid}/apply",
            json={"layer_overrides": {}, "hidden_layers": ["A0013111"]},
        )
        assert resp.status_code == 200

        doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))

        # Hidden layer should be turned off
        layer = doc.layers.get("A0013111")
        assert layer.is_off()

        # No entities should be on the hidden layer
        msp = doc.modelspace()
        hidden_entities = [e for e in msp if e.dxf.layer == "A0013111"]
        assert len(hidden_entities) == 0

    def test_non_hidden_layers_preserved(self, client, uploaded_session):
        """Non-hidden layers should be unaffected."""
        sid = uploaded_session["session_id"]
        resp = client.post(
            f"/api/session/{sid}/apply",
            json={"layer_overrides": {}, "hidden_layers": ["A0013111"]},
        )
        assert resp.status_code == 200

        doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))

        # Non-hidden layer should still be on
        layer = doc.layers.get("B0014110")
        assert layer.is_on()

    def test_empty_hidden_layers(self, client, uploaded_session):
        """Empty hidden_layers list should not affect anything."""
        sid = uploaded_session["session_id"]
        resp = client.post(
            f"/api/session/{sid}/apply",
            json={"layer_overrides": {}, "hidden_layers": []},
        )
        assert resp.status_code == 200

        doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))
        for layer in doc.layers:
            assert layer.is_on()
