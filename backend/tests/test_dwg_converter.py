from pathlib import Path

import ezdxf
import pytest

from utils.dwg_converter import is_converter_available, _sync_convert


converter_available = is_converter_available()
skip_no_converter = pytest.mark.skipif(
    not converter_available, reason="DwgConverter not installed"
)


class TestConverterDiscovery:
    def test_is_converter_available_returns_bool(self):
        result = is_converter_available()
        assert isinstance(result, bool)


class TestConversionNotAvailable:
    def test_sync_convert_raises_without_converter(self):
        from unittest.mock import patch

        with patch("utils.dwg_converter.CONVERTER_PATH", None):
            with pytest.raises(RuntimeError, match="변환기"):
                _sync_convert("to-dxf", "fake.dwg", "fake.dxf")


@skip_no_converter
class TestRoundTrip:
    def test_dxf_to_dwg_roundtrip(self):
        """Use real sample DXF → DWG → DXF round-trip."""
        import tempfile

        sample = Path(__file__).resolve().parent.parent.parent / "test-files" / "sample.dxf"
        if not sample.exists():
            pytest.skip("test-files/sample.dxf not found")

        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            dwg_path = tmp / "test.dwg"
            _sync_convert("to-dwg", str(sample), str(dwg_path))
            assert dwg_path.exists()
            assert dwg_path.stat().st_size > 0

            roundtrip_path = tmp / "roundtrip.dxf"
            _sync_convert("to-dxf", str(dwg_path), str(roundtrip_path))
            assert roundtrip_path.exists()

            doc = ezdxf.readfile(str(roundtrip_path))
            layer_count = len(list(doc.layers))
            assert layer_count > 0

    def test_convert_invalid_file(self, tmp_path):
        """Converting garbage data should fail."""
        bad_file = tmp_path / "bad.dwg"
        bad_file.write_text("not a dwg file")
        out_file = tmp_path / "out.dxf"
        with pytest.raises(RuntimeError):
            _sync_convert("to-dxf", str(bad_file), str(out_file))
