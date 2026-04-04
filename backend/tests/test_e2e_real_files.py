"""
End-to-end pipeline test using real test-files/sample.dxf and sample.dwg.

Validates:
1. No data loss (entities, layers, blocks preserved)
2. Color overrides applied correctly
3. Korean descriptions set correctly
4. Non-overridden layers get mapper defaults
5. Original ACI colors preserved (not overwritten by true_color)
6. Entities remain intact after processing
7. DWG upload → convert → apply → DWG download round-trip
"""

import json
from collections import Counter
from pathlib import Path

import ezdxf
import pytest

from app.routers.upload import SESSIONS_DIR

SAMPLE_DXF = Path(__file__).resolve().parent.parent.parent / "test-files" / "sample.dxf"
SAMPLE_DWG = Path(__file__).resolve().parent.parent.parent / "test-files" / "sample.dwg"


@pytest.fixture
def original_doc():
    """Load the original sample.dxf for comparison."""
    return ezdxf.readfile(str(SAMPLE_DXF))


class TestSampleDxfFullPipeline:
    """Full pipeline test with real sample.dxf."""

    def _upload(self, client) -> dict:
        with open(SAMPLE_DXF, "rb") as f:
            resp = client.post(
                "/api/upload",
                files={"file": ("sample.dxf", f, "application/octet-stream")},
            )
        assert resp.status_code == 200, f"Upload failed: {resp.text}"
        return resp.json()

    # ------------------------------------------------------------------ #
    # 1. Upload & Parse — no data loss
    # ------------------------------------------------------------------ #

    def test_upload_parses_all_layers(self, client, original_doc):
        """All layers from original file must appear in session state."""
        session = self._upload(client)

        original_layer_names = {l.dxf.name for l in original_doc.layers}
        parsed_layer_names = set()
        for cat in session["categories"]:
            for layer in cat["layers"]:
                parsed_layer_names.add(layer["original_name"])
        for layer in session.get("unmapped_layers", []):
            parsed_layer_names.add(layer["original_name"])

        assert original_layer_names == parsed_layer_names, (
            f"Missing layers: {original_layer_names - parsed_layer_names}, "
            f"Extra layers: {parsed_layer_names - original_layer_names}"
        )

    def test_upload_preserves_entity_count(self, client, original_doc):
        """Entity count in input.dxf must match the original."""
        session = self._upload(client)
        sid = session["session_id"]

        saved_doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "input.dxf"))

        orig_entities = list(original_doc.modelspace())
        saved_entities = list(saved_doc.modelspace())
        assert len(saved_entities) == len(orig_entities), (
            f"Entity count mismatch: original={len(orig_entities)}, saved={len(saved_entities)}"
        )

    # ------------------------------------------------------------------ #
    # 2. Apply colors — overrides + defaults
    # ------------------------------------------------------------------ #

    def test_apply_color_overrides(self, client):
        """Overridden layers must have exact RGB, others get mapper defaults."""
        session = self._upload(client)
        sid = session["session_id"]

        overrides = {
            "A0013111": {"color": "#FF0000"},  # red
            "B0014111": {"color": "#00FF00"},  # green
            "E0032111": {"color": "#0000FF"},  # blue
        }
        resp = client.post(
            f"/api/session/{sid}/apply",
            json={"layer_overrides": overrides},
        )
        assert resp.status_code == 200

        doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))

        assert doc.layers.get("A0013111").rgb == (0xFF, 0x00, 0x00)
        assert doc.layers.get("B0014111").rgb == (0x00, 0xFF, 0x00)
        assert doc.layers.get("E0032111").rgb == (0x00, 0x00, 0xFF)

    def test_non_overridden_layers_get_mapper_color(self, client):
        """Layers without overrides should get their mapper default color."""
        session = self._upload(client)
        sid = session["session_id"]

        resp = client.post(
            f"/api/session/{sid}/apply",
            json={"layer_overrides": {}},
        )
        assert resp.status_code == 200

        doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))

        # Every layer must have true_color set (rgb not None)
        for layer in doc.layers:
            assert layer.rgb is not None, (
                f"Layer '{layer.dxf.name}' has no true_color after apply"
            )

    # ------------------------------------------------------------------ #
    # 3. Descriptions — Korean labels
    # ------------------------------------------------------------------ #

    def test_descriptions_set_correctly(self, client):
        """Mapped layers must have Korean descriptions with category prefix."""
        session = self._upload(client)
        sid = session["session_id"]

        client.post(f"/api/session/{sid}/apply", json={"layer_overrides": {}})
        doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))

        # A0013111 = 고속국도 (교통 category)
        highway = doc.layers.get("A0013111")
        assert highway.description, "A0013111 description should not be empty"
        assert "고속국도" in highway.description
        assert "[A" in highway.description  # category prefix

        # B0014111 = 건물 category
        building = doc.layers.get("B0014111")
        assert building.description, "B0014111 description should not be empty"
        assert "[B" in building.description

    def test_all_layers_have_descriptions(self, client):
        """Every layer should have some description after apply."""
        session = self._upload(client)
        sid = session["session_id"]

        client.post(f"/api/session/{sid}/apply", json={"layer_overrides": {}})
        doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))

        for layer in doc.layers:
            assert layer.description, (
                f"Layer '{layer.dxf.name}' has empty description after apply"
            )

    # ------------------------------------------------------------------ #
    # 4. Data integrity — entities preserved after apply
    # ------------------------------------------------------------------ #

    def test_entity_types_preserved_after_apply(self, client, original_doc):
        """Entity type distribution must be identical."""
        session = self._upload(client)
        sid = session["session_id"]

        client.post(f"/api/session/{sid}/apply", json={"layer_overrides": {}})
        output_doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))

        orig_types = Counter(e.dxftype() for e in original_doc.modelspace())
        output_types = Counter(e.dxftype() for e in output_doc.modelspace())
        assert output_types == orig_types, (
            f"Entity type mismatch:\n  original={dict(orig_types)}\n  output={dict(output_types)}"
        )

    def test_entity_layer_assignments_preserved(self, client, original_doc):
        """Each entity's layer assignment must not change."""
        session = self._upload(client)
        sid = session["session_id"]

        client.post(f"/api/session/{sid}/apply", json={"layer_overrides": {}})
        output_doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))

        orig_layer_counts = Counter(
            e.dxf.layer for e in original_doc.modelspace()
        )
        output_layer_counts = Counter(
            e.dxf.layer for e in output_doc.modelspace()
        )
        assert output_layer_counts == orig_layer_counts, (
            "Entity-to-layer assignment changed after apply"
        )

    def test_aci_color_not_overwritten(self, client, original_doc):
        """ACI color index should remain unchanged — only true_color is set."""
        session = self._upload(client)
        sid = session["session_id"]

        client.post(
            f"/api/session/{sid}/apply",
            json={"layer_overrides": {"A0013111": {"color": "#FF0000"}}},
        )
        output_doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))

        for orig_layer in original_doc.layers:
            out_layer = output_doc.layers.get(orig_layer.dxf.name)
            assert out_layer.color == orig_layer.color, (
                f"ACI color changed for '{orig_layer.dxf.name}': "
                f"original={orig_layer.color}, output={out_layer.color}"
            )

    # ------------------------------------------------------------------ #
    # 5. Block definitions preserved
    # ------------------------------------------------------------------ #

    def test_block_definitions_preserved(self, client, original_doc):
        """Block definitions must not be lost."""
        session = self._upload(client)
        sid = session["session_id"]

        client.post(f"/api/session/{sid}/apply", json={"layer_overrides": {}})
        output_doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))

        orig_blocks = {b.name for b in original_doc.blocks if not b.name.startswith("*")}
        output_blocks = {b.name for b in output_doc.blocks if not b.name.startswith("*")}
        assert orig_blocks == output_blocks, (
            f"Missing blocks: {orig_blocks - output_blocks}, "
            f"Extra blocks: {output_blocks - orig_blocks}"
        )

    # ------------------------------------------------------------------ #
    # 6. Download — full round-trip
    # ------------------------------------------------------------------ #

    def test_download_round_trip(self, client, original_doc):
        """Download the output and verify it's a valid DXF with all data."""
        session = self._upload(client)
        sid = session["session_id"]

        overrides = {"A0013111": {"color": "#112233"}}
        client.post(
            f"/api/session/{sid}/apply",
            json={"layer_overrides": overrides},
        )

        resp = client.get(f"/api/session/{sid}/download")
        assert resp.status_code == 200
        assert "application/dxf" in resp.headers["content-type"]

        # Save to temp file and re-read (sample.dxf uses ANSI_949 encoding)
        tmp_dl = Path(SESSIONS_DIR / sid / "downloaded.dxf")
        tmp_dl.write_bytes(resp.content)
        downloaded_doc = ezdxf.readfile(str(tmp_dl))

        # Verify override applied
        assert downloaded_doc.layers.get("A0013111").rgb == (0x11, 0x22, 0x33)

        # Verify entity count matches
        orig_count = len(list(original_doc.modelspace()))
        dl_count = len(list(downloaded_doc.modelspace()))
        assert dl_count == orig_count

        # Verify all layers present
        orig_layer_names = {l.dxf.name for l in original_doc.layers}
        dl_layer_names = {l.dxf.name for l in downloaded_doc.layers}
        assert orig_layer_names == dl_layer_names

    # ------------------------------------------------------------------ #
    # 7. Session state consistency
    # ------------------------------------------------------------------ #

    def test_session_state_after_apply(self, client):
        """Session state should reflect output info after apply."""
        session = self._upload(client)
        sid = session["session_id"]

        client.post(f"/api/session/{sid}/apply", json={"layer_overrides": {}})

        resp = client.get(f"/api/session/{sid}")
        assert resp.status_code == 200
        state = resp.json()
        assert state["has_output"] is True
        assert state["output_filename"] == "layeron_sample.dxf"
        assert state["total_layers"] == 92

    # ------------------------------------------------------------------ #
    # 8. Multiple applies — last wins, no corruption
    # ------------------------------------------------------------------ #

    def test_multiple_applies_no_corruption(self, client, original_doc):
        """Applying colors multiple times should not corrupt or lose data."""
        session = self._upload(client)
        sid = session["session_id"]

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

        output_doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))

        # Last color wins
        assert output_doc.layers.get("A0013111").rgb == (0, 0, 255)

        # Entity count still intact
        orig_count = len(list(original_doc.modelspace()))
        output_count = len(list(output_doc.modelspace()))
        assert output_count == orig_count

        # All layers still present
        orig_names = {l.dxf.name for l in original_doc.layers}
        output_names = {l.dxf.name for l in output_doc.layers}
        assert orig_names == output_names


@pytest.mark.skipif(not SAMPLE_DWG.exists(), reason="sample.dwg not found")
class TestCrossFormatDownload:
    """Upload one format, download as the other."""

    def test_dxf_upload_download_as_dwg(self, client, original_doc):
        """Upload DXF → apply → download as DWG → convert back → verify."""
        with open(SAMPLE_DXF, "rb") as f:
            resp = client.post(
                "/api/upload",
                files={"file": ("sample.dxf", f, "application/octet-stream")},
            )
        assert resp.status_code == 200
        session = resp.json()
        sid = session["session_id"]
        assert session["original_format"] == "dxf"

        overrides = {"A0013111": {"color": "#FF0000"}}
        resp = client.post(
            f"/api/session/{sid}/apply",
            json={"layer_overrides": overrides, "output_format": "dwg"},
        )
        assert resp.status_code == 200

        # Download should return DWG
        resp = client.get(f"/api/session/{sid}/download")
        assert resp.status_code == 200
        assert "application/dwg" in resp.headers["content-type"]

        # Convert DWG back to DXF and verify full round-trip
        dwg_path = SESSIONS_DIR / sid / "cross_dl.dwg"
        dwg_path.write_bytes(resp.content)
        dxf_path = SESSIONS_DIR / sid / "cross_dl.dxf"

        from utils.dwg_converter import _sync_convert
        _sync_convert("to-dxf", str(dwg_path), str(dxf_path))

        rt_doc = ezdxf.readfile(str(dxf_path))

        # Color preserved (pre-swap workaround cancels ACadSharp byte-swap)
        assert rt_doc.layers.get("A0013111").rgb == (0xFF, 0x00, 0x00)

        # Korean description preserved
        assert "고속국도" in rt_doc.layers.get("A0013111").description

        # Entity count preserved
        orig_count = len(list(original_doc.modelspace()))
        rt_count = len(list(rt_doc.modelspace()))
        assert rt_count == orig_count

        # All layers preserved
        orig_names = {l.dxf.name for l in original_doc.layers}
        rt_names = {l.dxf.name for l in rt_doc.layers}
        assert orig_names == rt_names

    def test_dwg_upload_download_as_dxf(self, client, original_doc):
        """Upload DWG → apply → download as DXF → verify."""
        with open(SAMPLE_DWG, "rb") as f:
            resp = client.post(
                "/api/upload",
                files={"file": ("sample.dwg", f, "application/octet-stream")},
            )
        assert resp.status_code == 200
        session = resp.json()
        sid = session["session_id"]
        assert session["original_format"] == "dwg"

        overrides = {"A0013111": {"color": "#00FF00"}}
        resp = client.post(
            f"/api/session/{sid}/apply",
            json={"layer_overrides": overrides, "output_format": "dxf"},
        )
        assert resp.status_code == 200

        # Download should return DXF
        resp = client.get(f"/api/session/{sid}/download")
        assert resp.status_code == 200
        assert "application/dxf" in resp.headers["content-type"]

        # Save and re-read
        dl_path = SESSIONS_DIR / sid / "cross_dl.dxf"
        dl_path.write_bytes(resp.content)
        dl_doc = ezdxf.readfile(str(dl_path))

        # Color preserved
        assert dl_doc.layers.get("A0013111").rgb == (0x00, 0xFF, 0x00)

        # Korean description preserved
        assert "고속국도" in dl_doc.layers.get("A0013111").description

        # Entity count preserved
        orig_count = len(list(original_doc.modelspace()))
        dl_count = len(list(dl_doc.modelspace()))
        assert dl_count == orig_count

        # All layers preserved
        orig_names = {l.dxf.name for l in original_doc.layers}
        dl_names = {l.dxf.name for l in dl_doc.layers}
        assert orig_names == dl_names


class TestInputVersionCompat:
    """Verify pipeline works with different input DXF versions."""

    INPUT_VERSIONS = {
        "AC1015": "R2000",
        "AC1018": "R2004",
        "AC1021": "R2007",
        "AC1024": "R2010",
        "AC1027": "R2013",
        "AC1032": "R2018",
    }

    @pytest.fixture
    def version_dxf_files(self, tmp_path):
        """Create sample.dxf variants in each DXF version."""
        paths = {}
        for acver, name in self.INPUT_VERSIONS.items():
            doc = ezdxf.readfile(str(SAMPLE_DXF))
            doc._dxfversion = acver
            doc.header["$ACADVER"] = acver
            path = tmp_path / f"sample_{name}.dxf"
            doc.saveas(str(path))
            paths[acver] = path
        return paths

    @pytest.mark.parametrize(
        "acver,name", list(INPUT_VERSIONS.items()),
    )
    def test_version_upload_apply_verify(
        self, client, original_doc, version_dxf_files, acver, name
    ):
        """Upload DXF of each version → apply color → verify output."""
        path = version_dxf_files[acver]

        # Upload
        with open(path, "rb") as f:
            resp = client.post(
                "/api/upload",
                files={"file": (f"sample_{name}.dxf", f, "application/octet-stream")},
            )
        assert resp.status_code == 200, f"{name} upload failed: {resp.text}"
        session = resp.json()
        sid = session["session_id"]
        assert session["total_layers"] == 92

        # Apply with override
        overrides = {"A0013111": {"color": "#FF0000"}}
        resp = client.post(
            f"/api/session/{sid}/apply",
            json={"layer_overrides": overrides},
        )
        assert resp.status_code == 200

        # Verify output
        output_doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))

        # Color applied
        assert output_doc.layers.get("A0013111").rgb == (0xFF, 0x00, 0x00), (
            f"{name}: color override not applied"
        )

        # All layers have true_color
        for layer in output_doc.layers:
            assert layer.rgb is not None, (
                f"{name}: layer '{layer.dxf.name}' missing true_color"
            )

        # Description set
        assert "고속국도" in output_doc.layers.get("A0013111").description

        # Entity count preserved
        orig_count = len(list(original_doc.modelspace()))
        output_count = len(list(output_doc.modelspace()))
        assert output_count == orig_count, (
            f"{name}: entity count {output_count} != {orig_count}"
        )


@pytest.mark.skipif(not SAMPLE_DWG.exists(), reason="sample.dwg not found")
class TestSampleDwgFullPipeline:
    """Full pipeline test with real sample.dwg (DWG upload → convert → apply → download)."""

    def _upload(self, client) -> dict:
        with open(SAMPLE_DWG, "rb") as f:
            resp = client.post(
                "/api/upload",
                files={"file": ("sample.dwg", f, "application/octet-stream")},
            )
        assert resp.status_code == 200, f"DWG Upload failed: {resp.text}"
        return resp.json()

    def test_dwg_upload_converts_to_dxf(self, client, original_doc):
        """DWG upload should produce input.dwg + converted input.dxf with all layers."""
        session = self._upload(client)
        sid = session["session_id"]

        assert session["original_format"] == "dwg"
        assert (SESSIONS_DIR / sid / "input.dwg").exists()
        assert (SESSIONS_DIR / sid / "input.dxf").exists()

        # All layers from original should be present
        original_layer_names = {l.dxf.name for l in original_doc.layers}
        parsed_layer_names = set()
        for cat in session["categories"]:
            for layer in cat["layers"]:
                parsed_layer_names.add(layer["original_name"])
        for layer in session.get("unmapped_layers", []):
            parsed_layer_names.add(layer["original_name"])

        assert original_layer_names == parsed_layer_names

    def test_dwg_apply_and_download_as_dxf(self, client, original_doc):
        """Apply colors to DWG-uploaded file and download as DXF."""
        session = self._upload(client)
        sid = session["session_id"]

        overrides = {"A0013111": {"color": "#FF0000"}}
        resp = client.post(
            f"/api/session/{sid}/apply",
            json={"layer_overrides": overrides, "output_format": "dxf"},
        )
        assert resp.status_code == 200

        output_doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))
        assert output_doc.layers.get("A0013111").rgb == (0xFF, 0x00, 0x00)

        # Entity count should match original
        orig_count = len(list(original_doc.modelspace()))
        output_count = len(list(output_doc.modelspace()))
        assert output_count == orig_count

    def test_dwg_apply_and_download_as_dwg(self, client):
        """Apply colors and download as DWG — verify round-trip produces valid file."""
        session = self._upload(client)
        sid = session["session_id"]

        overrides = {"A0013111": {"color": "#00FF00"}}
        resp = client.post(
            f"/api/session/{sid}/apply",
            json={"layer_overrides": overrides, "output_format": "dwg"},
        )
        assert resp.status_code == 200

        # output.dwg should exist
        assert (SESSIONS_DIR / sid / "output.dwg").exists()

        # Download should return DWG
        resp = client.get(f"/api/session/{sid}/download")
        assert resp.status_code == 200
        assert "application/dwg" in resp.headers["content-type"]
        assert len(resp.content) > 100

    def test_dwg_korean_description_survives_roundtrip(self, client):
        """Korean descriptions must survive DWG upload → apply → DWG download.
        output.dxf is saved as R2010+ (UTF-8), so ACadSharp reads Korean correctly."""
        session = self._upload(client)
        sid = session["session_id"]

        client.post(
            f"/api/session/{sid}/apply",
            json={"layer_overrides": {}, "output_format": "dwg"},
        )

        # Verify intermediate DXF has Korean description
        doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "output.dxf"))
        highway = doc.layers.get("A0013111")
        assert highway.description
        assert "고속국도" in highway.description

        # Verify DWG → DXF roundtrip preserves Korean
        from utils.dwg_converter import _sync_convert
        _sync_convert(
            "to-dxf",
            str(SESSIONS_DIR / sid / "output.dwg"),
            str(SESSIONS_DIR / sid / "roundtrip.dxf"),
        )
        rt_doc = ezdxf.readfile(str(SESSIONS_DIR / sid / "roundtrip.dxf"))
        rt_highway = rt_doc.layers.get("A0013111")
        assert "고속국도" in rt_highway.description
