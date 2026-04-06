import asyncio
import json
import shutil
import subprocess
from pathlib import Path


_SEARCH_PATHS = [
    Path(__file__).resolve().parent.parent / "bin" / "DwgConverter",
    Path("/app/bin/DwgConverter"),
    Path(__file__).resolve().parent.parent.parent / "dwg-converter" / "publish" / "DwgConverter",
]


def _find_converter() -> str | None:
    for p in _SEARCH_PATHS:
        if p.exists() and p.is_file():
            return str(p)
    found = shutil.which("DwgConverter")
    return found


CONVERTER_PATH = _find_converter()


def is_converter_available() -> bool:
    return CONVERTER_PATH is not None


def _sync_run(args: list[str], timeout: int = 120) -> subprocess.CompletedProcess:
    """Run DwgConverter CLI — synchronous, for use in thread pool."""
    if not CONVERTER_PATH:
        raise RuntimeError("DWG 변환기를 사용할 수 없습니다")
    result = subprocess.run(
        [CONVERTER_PATH] + args,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "DwgConverter 실행 실패")
    return result


# ── Production commands ──────────────────────────


def _sync_modify_dwg(input_path: str, output_path: str, config_path: str) -> None:
    """Modify DWG layers (ACI colors + hidden) directly via ACadSharp."""
    _sync_run(["modify", input_path, output_path, config_path])


def _sync_list_layers(dwg_path: str) -> dict:
    """Extract layer list from DWG file. Returns parsed JSON."""
    result = _sync_run(["list-layers", dwg_path], timeout=60)
    return json.loads(result.stdout)


async def modify_dwg(input_path: str, output_path: str, config_path: str) -> None:
    await asyncio.to_thread(_sync_modify_dwg, input_path, output_path, config_path)


async def list_dwg_layers(dwg_path: str) -> dict:
    return await asyncio.to_thread(_sync_list_layers, dwg_path)


# ── Preview utility (DWG→DXF for geometry extraction only) ───


def _sync_dwg_to_dxf_preview(input_path: str, output_path: str) -> None:
    """Convert DWG to DXF for preview purposes only. May lose some entities."""
    _sync_run(["to-dxf", input_path, output_path])


async def dwg_to_dxf_preview(input_path: str, output_path: str) -> None:
    await asyncio.to_thread(_sync_dwg_to_dxf_preview, input_path, output_path)
