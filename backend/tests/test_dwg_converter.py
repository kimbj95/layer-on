"""Tests for DWG converter utilities."""

import json
from pathlib import Path

import pytest

from utils.dwg_converter import (
    is_converter_available,
    _sync_modify_dwg,
    _sync_list_layers,
    _sync_dwg_to_dxf_preview,
    _sync_run,
)


converter_available = is_converter_available()
skip_no_converter = pytest.mark.skipif(
    not converter_available, reason="DwgConverter not installed",
)

SAMPLE_DWG = Path(__file__).resolve().parent.parent.parent / "test-files" / "sample.dwg"


class TestConverterDiscovery:
    def test_is_converter_available_returns_bool(self):
        assert isinstance(is_converter_available(), bool)


class TestRunNotAvailable:
    def test_raises_without_converter(self):
        from unittest.mock import patch

        with patch("utils.dwg_converter.CONVERTER_PATH", None):
            with pytest.raises(RuntimeError, match="변환기"):
                _sync_run(["list-layers", "fake.dwg"])


@skip_no_converter
class TestListLayers:
    @pytest.mark.skipif(not SAMPLE_DWG.exists(), reason="sample.dwg not found")
    def test_list_layers_returns_json(self):
        result = _sync_list_layers(str(SAMPLE_DWG))
        assert "layers" in result
        assert "entity_count" in result
        assert len(result["layers"]) > 0
        # Each layer has name and aci_color
        layer = result["layers"][0]
        assert "name" in layer
        assert "aci_color" in layer

    def test_list_layers_invalid_file(self, tmp_path):
        bad_file = tmp_path / "bad.dwg"
        bad_file.write_text("not a dwg")
        with pytest.raises(RuntimeError):
            _sync_list_layers(str(bad_file))


@skip_no_converter
class TestModifyDwg:
    @pytest.mark.skipif(not SAMPLE_DWG.exists(), reason="sample.dwg not found")
    def test_modify_aci_colors(self, tmp_path):
        config = {
            "layers": {"A0013111": {"aci_color": 3}},
            "hidden_layers": [],
        }
        config_path = tmp_path / "config.json"
        config_path.write_text(json.dumps(config))

        output = tmp_path / "output.dwg"
        _sync_modify_dwg(str(SAMPLE_DWG), str(output), str(config_path))
        assert output.exists()
        assert output.stat().st_size > 0

    @pytest.mark.skipif(not SAMPLE_DWG.exists(), reason="sample.dwg not found")
    def test_modify_with_hidden_layers(self, tmp_path):
        config = {
            "layers": {},
            "hidden_layers": ["A0013111"],
        }
        config_path = tmp_path / "config.json"
        config_path.write_text(json.dumps(config))

        output = tmp_path / "output.dwg"
        _sync_modify_dwg(str(SAMPLE_DWG), str(output), str(config_path))
        assert output.exists()

    @pytest.mark.skipif(not SAMPLE_DWG.exists(), reason="sample.dwg not found")
    def test_modify_entity_preservation(self, tmp_path):
        """Modified DWG should have same entity count as original."""
        # Get original entity count
        orig = _sync_list_layers(str(SAMPLE_DWG))
        orig_count = orig["entity_count"]

        # Modify
        config = {"layers": {"A0013111": {"aci_color": 5}}, "hidden_layers": []}
        config_path = tmp_path / "config.json"
        config_path.write_text(json.dumps(config))
        output = tmp_path / "output.dwg"
        _sync_modify_dwg(str(SAMPLE_DWG), str(output), str(config_path))

        # Check entity count
        modified = _sync_list_layers(str(output))
        assert modified["entity_count"] == orig_count


@skip_no_converter
class TestPreview:
    @pytest.mark.skipif(not SAMPLE_DWG.exists(), reason="sample.dwg not found")
    def test_dwg_to_dxf_preview(self, tmp_path):
        output = tmp_path / "preview.dxf"
        _sync_dwg_to_dxf_preview(str(SAMPLE_DWG), str(output))
        assert output.exists()
        assert output.stat().st_size > 0
