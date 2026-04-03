import asyncio
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


def _sync_convert(command: str, input_path: str, output_path: str) -> None:
    """Run DwgConverter CLI — synchronous, for use in thread pool."""
    if not CONVERTER_PATH:
        raise RuntimeError("DWG 변환기를 사용할 수 없습니다")
    result = subprocess.run(
        [CONVERTER_PATH, command, input_path, output_path],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "변환 실패")
    if not Path(output_path).exists():
        raise RuntimeError("변환 출력 파일이 생성되지 않았습니다")


async def dwg_to_dxf(input_path: str, output_path: str) -> None:
    await asyncio.to_thread(_sync_convert, "to-dxf", input_path, output_path)


async def dxf_to_dwg(input_path: str, output_path: str) -> None:
    await asyncio.to_thread(_sync_convert, "to-dwg", input_path, output_path)
