import asyncio
import json
import shutil
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator, Literal

import ezdxf
from ezdxf.colors import rgb2int
from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from utils.color_utils import hex_to_rgb
from utils.dwg_converter import is_converter_available, dwg_to_dxf, dxf_to_dwg
from utils.layer_mapper import LayerMapper

router = APIRouter(prefix="/api")

SESSIONS_DIR = Path("/tmp/layeron")
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
PARSE_TIMEOUT = 60  # seconds

mapper = LayerMapper()


def _sse_event(event: str, data: dict) -> str:
    """Format a single SSE event string."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _sync_read_dxf(file_path: str) -> list[dict]:
    """Read DXF and extract raw layer data (name + ACI color)."""
    doc = ezdxf.readfile(file_path)
    return [{"name": layer.dxf.name, "aci_color": layer.color} for layer in doc.layers]


def _aci_to_hex(aci: int) -> str:
    """Convert ACI color index to hex string."""
    from ezdxf.colors import DXF_DEFAULT_COLORS, int2rgb
    if aci < 0 or aci >= len(DXF_DEFAULT_COLORS):
        return "#ffffff"
    r, g, b = int2rgb(DXF_DEFAULT_COLORS[aci])
    return f"#{r:02x}{g:02x}{b:02x}"


def _sync_map_layers(raw_layers: list[dict]) -> list[dict]:
    """Map raw layers to standard layer info via LayerMapper."""
    layers = []
    for raw in raw_layers:
        info = mapper.get_layer_info(raw["name"])
        layers.append({
            "original_name": raw["name"],
            **info,
            "current_color": _aci_to_hex(raw["aci_color"]),
            "original_aci_color": raw["aci_color"],
        })
    return layers


def _sync_parse_dxf(file_path: str) -> list[dict]:
    """Synchronous ezdxf parsing — runs in thread pool."""
    return _sync_map_layers(_sync_read_dxf(file_path))


def _build_session_state(
    session_id: str,
    file_name: str,
    file_size: int,
    layers: list[dict],
    original_format: str = "dxf",
) -> dict:
    """Build session state from parsed layers and persist to disk."""
    mapped = [l for l in layers if l["is_mapped"]]
    unmapped = [l for l in layers if not l["is_mapped"]]

    by_category = defaultdict(list)
    for l in layers:
        key = l.get("category_major") or ""
        by_category[key].append(l)

    categories = []
    for cat_letter in sorted(by_category.keys()):
        cat_layers = by_category[cat_letter]
        cat_name = cat_layers[0].get("category_major_name", "미분류") if cat_layers else "미분류"
        categories.append({
            "category_major": cat_letter,
            "category_major_name": cat_name,
            "count": len(cat_layers),
            "layers": cat_layers,
        })

    state = {
        "session_id": session_id,
        "file_name": file_name,
        "file_size_mb": round(file_size / (1024 * 1024), 2),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "total_layers": len(layers),
        "mapped_count": len(mapped),
        "categories": categories,
        "unmapped_layers": unmapped,
        "original_format": original_format,
        "converter_available": is_converter_available(),
    }

    state_path = SESSIONS_DIR / session_id / "state.json"
    state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")

    return state


async def parse_dxf(
    session_id: str,
    file_path: str,
    file_name: str,
    file_size: int,
    original_format: str = "dxf",
):
    """Parse DXF and save session state as JSON."""
    try:
        layers = await asyncio.wait_for(
            asyncio.to_thread(_sync_parse_dxf, file_path),
            timeout=PARSE_TIMEOUT,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=408,
            detail="파일 파싱 시간이 초과되었습니다. 더 작은 파일로 시도해주세요.",
        )
    except ezdxf.DXFError:
        raise HTTPException(
            status_code=422,
            detail="DXF 파일을 읽을 수 없습니다. 파일이 손상되었거나 지원하지 않는 버전일 수 있습니다.",
        )
    except Exception:
        raise HTTPException(
            status_code=422,
            detail="DXF 파일을 읽을 수 없습니다. 파일이 손상되었거나 지원하지 않는 버전일 수 있습니다.",
        )

    return _build_session_state(session_id, file_name, file_size, layers, original_format)


@router.post("/upload")
async def upload_file(file: UploadFile):
    # Validate extension
    if not file.filename:
        raise HTTPException(status_code=400, detail="DXF 또는 DWG 파일만 지원합니다.")

    ext = Path(file.filename).suffix.lower()
    if ext not in (".dxf", ".dwg"):
        raise HTTPException(status_code=400, detail="DXF 또는 DWG 파일만 지원합니다.")

    if ext == ".dwg" and not is_converter_available():
        raise HTTPException(
            status_code=400,
            detail="DWG 변환기를 사용할 수 없습니다. DXF 파일로 업로드해주세요.",
        )

    # Read content and validate size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="파일 크기는 50MB 이하만 지원합니다",
        )

    # Create session directory and save file
    session_id = str(uuid.uuid4())
    session_dir = SESSIONS_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    original_format = "dwg" if ext == ".dwg" else "dxf"

    if ext == ".dwg":
        # Save DWG, convert to DXF
        dwg_path = session_dir / "input.dwg"
        dwg_path.write_bytes(content)
        dxf_path = session_dir / "input.dxf"
        try:
            await dwg_to_dxf(str(dwg_path), str(dxf_path))
        except Exception:
            raise HTTPException(
                status_code=422,
                detail="DWG 파일을 변환할 수 없습니다. 파일이 손상되었거나 지원하지 않는 버전일 수 있습니다.",
            )
    else:
        dxf_path = session_dir / "input.dxf"
        dxf_path.write_bytes(content)

    # Parse and return state
    state = await parse_dxf(
        session_id, str(dxf_path), file.filename, len(content), original_format
    )
    return state


@router.post("/upload-stream")
async def upload_file_stream(file: UploadFile):
    """Same as /upload but returns SSE progress events."""

    # --- Validation (before entering stream) ---
    if not file.filename:
        return StreamingResponse(
            _error_stream("DXF 또는 DWG 파일만 지원합니다."),
            media_type="text/event-stream",
        )

    ext = Path(file.filename).suffix.lower()
    if ext not in (".dxf", ".dwg"):
        return StreamingResponse(
            _error_stream("DXF 또는 DWG 파일만 지원합니다."),
            media_type="text/event-stream",
        )

    if ext == ".dwg" and not is_converter_available():
        return StreamingResponse(
            _error_stream("DWG 변환기를 사용할 수 없습니다. DXF 파일로 업로드해주세요."),
            media_type="text/event-stream",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        return StreamingResponse(
            _error_stream("파일 크기는 50MB 이하만 지원합니다"),
            media_type="text/event-stream",
        )

    filename = file.filename

    async def generate() -> AsyncGenerator[str, None]:
        try:
            # Step 1: uploading
            yield _sse_event("progress", {
                "step": "uploading", "message": "파일 업로드 중...", "percent": 10,
            })

            session_id = str(uuid.uuid4())
            session_dir = SESSIONS_DIR / session_id
            session_dir.mkdir(parents=True, exist_ok=True)
            original_format = "dwg" if ext == ".dwg" else "dxf"

            if ext == ".dwg":
                dwg_path = session_dir / "input.dwg"
                dwg_path.write_bytes(content)
                dxf_path = session_dir / "input.dxf"

                # Step 2: converting (DWG only)
                yield _sse_event("progress", {
                    "step": "converting", "message": "DWG → DXF 변환 중...", "percent": 30,
                })
                try:
                    await dwg_to_dxf(str(dwg_path), str(dxf_path))
                except Exception:
                    yield _sse_event("error", {
                        "message": "DWG 파일을 변환할 수 없습니다. 파일이 손상되었거나 지원하지 않는 버전일 수 있습니다.",
                    })
                    return
            else:
                dxf_path = session_dir / "input.dxf"
                dxf_path.write_bytes(content)

            # Step 3: parsing
            yield _sse_event("progress", {
                "step": "parsing", "message": "레이어 분석 중...", "percent": 50,
            })
            try:
                raw_layers = await asyncio.wait_for(
                    asyncio.to_thread(_sync_read_dxf, str(dxf_path)),
                    timeout=PARSE_TIMEOUT,
                )
            except asyncio.TimeoutError:
                yield _sse_event("error", {
                    "message": "파일 파싱 시간이 초과되었습니다.",
                })
                return
            except Exception:
                yield _sse_event("error", {
                    "message": "DXF 파일을 읽을 수 없습니다. 파일이 손상되었거나 지원하지 않는 버전일 수 있습니다.",
                })
                return

            # Step 4: mapping
            yield _sse_event("progress", {
                "step": "mapping", "message": "표준코드 매핑 중...", "percent": 75,
            })
            layers = await asyncio.to_thread(_sync_map_layers, raw_layers)

            # Step 5: finalizing
            yield _sse_event("progress", {
                "step": "finalizing", "message": "마무리 중...", "percent": 90,
            })
            state = _build_session_state(
                session_id, filename, len(content), layers, original_format,
            )

            # Done
            yield _sse_event("complete", state)

        except Exception:
            yield _sse_event("error", {"message": "파일 처리 중 오류가 발생했습니다."})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _error_stream(message: str) -> AsyncGenerator[str, None]:
    """Yield a single SSE error event for early validation failures."""
    yield _sse_event("error", {"message": message})


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    state_path = SESSIONS_DIR / session_id / "state.json"
    if not state_path.exists():
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    state = json.loads(state_path.read_text(encoding="utf-8"))
    state["converter_available"] = is_converter_available()
    return state


class LayerOverride(BaseModel):
    color: str | None = None
    linetype: str | None = None


class ApplyRequest(BaseModel):
    layer_overrides: dict[str, LayerOverride] = {}
    output_format: Literal["dxf", "dwg"] = "dxf"


def _sync_apply_colors(
    session_dir: Path, overrides: dict[str, dict], output_format: str = "dxf"
) -> dict:
    """Synchronous color application — runs in thread pool."""
    state = json.loads((session_dir / "state.json").read_text(encoding="utf-8"))
    doc = ezdxf.readfile(str(session_dir / "input.dxf"))

    # Upgrade to R2010 (AC1024) for two reasons:
    # 1. true_color (group code 420) requires AC1018+ (R2004)
    # 2. R2007+ saves strings as UTF-8, which prevents ACadSharp from
    #    misreading cp949 Korean text as cp1252 during DXF→DWG conversion
    # R2007 (AC1021) is not supported by ACadSharp, so we use R2010.
    if doc.dxfversion < "AC1024":
        doc._dxfversion = "AC1024"
        doc.header["$ACADVER"] = "AC1024"

    for layer in doc.layers:
        layer_name = layer.dxf.name
        layer_info = mapper.get_layer_info(layer_name)

        if layer_name in overrides:
            override = overrides[layer_name]
            color_hex = override.get("color") or layer_info["default_color"]
            linetype = override.get("linetype") or layer_info["linetype"]
        else:
            color_hex = layer_info["default_color"]
            linetype = layer_info.get("linetype", "Continuous")

        # Apply true color (RGB) without overriding ACI
        r, g, b = hex_to_rgb(color_hex)
        # ACadSharp has a byte-swap bug: DXF→DWG conversion reverses RGB to BGR.
        # Pre-swap so ACadSharp's swap produces correct colors in the final DWG.
        if output_format == "dwg":
            layer.dxf.true_color = rgb2int((b, g, r))
        else:
            layer.dxf.true_color = rgb2int((r, g, b))

        # Set description — prefixed by category for AutoCAD sorting
        korean_label = layer_info["name"]
        cat_major = layer_info.get("category_major", "")
        cat_major_name = layer_info.get("category_major_name", "")
        mid_category = layer_info.get("category_mid", "")
        if cat_major and mid_category:
            layer.description = f"[{cat_major} {cat_major_name} > {mid_category}] {korean_label}"
        elif cat_major:
            layer.description = f"[{cat_major} {cat_major_name}] {korean_label}"
        else:
            layer.description = korean_label

        # Set linetype if defined in doc
        if linetype != "Continuous":
            try:
                doc.linetypes.get(linetype)
                layer.dxf.linetype = linetype
            except ezdxf.DXFTableEntryError:
                pass

    output_path = session_dir / "output.dxf"
    doc.saveas(str(output_path))


@router.post("/session/{session_id}/apply")
async def apply_colors(session_id: str, body: ApplyRequest):
    session_dir = SESSIONS_DIR / session_id
    if not (session_dir / "state.json").exists():
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

    overrides = {k: v.model_dump(exclude_none=True) for k, v in body.layer_overrides.items()}

    try:
        await asyncio.wait_for(
            asyncio.to_thread(_sync_apply_colors, session_dir, overrides, body.output_format),
            timeout=PARSE_TIMEOUT,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=408,
            detail="파일 처리 시간이 초과되었습니다. 더 작은 파일로 시도해주세요.",
        )
    except ezdxf.DXFError:
        raise HTTPException(
            status_code=422,
            detail="DXF 파일 처리 중 오류가 발생했습니다.",
        )

    # Convert to DWG if requested
    if body.output_format == "dwg":
        if not is_converter_available():
            raise HTTPException(
                status_code=400,
                detail="DWG 변환기를 사용할 수 없습니다. DXF로 저장해주세요.",
            )
        try:
            await dxf_to_dwg(
                str(session_dir / "output.dxf"),
                str(session_dir / "output.dwg"),
            )
        except Exception:
            raise HTTPException(
                status_code=422,
                detail="DWG 변환에 실패했습니다.",
            )

    # Update state with output info
    state = json.loads((session_dir / "state.json").read_text(encoding="utf-8"))
    state["has_output"] = True
    state["output_format"] = body.output_format
    stem = Path(state["file_name"]).stem
    state["output_filename"] = f"layeron_{stem}.{body.output_format}"
    (session_dir / "state.json").write_text(
        json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    return {"status": "ok", "output_filename": state["output_filename"]}


@router.get("/session/{session_id}/download")
async def download_file(session_id: str):
    session_dir = SESSIONS_DIR / session_id
    if not (session_dir / "state.json").exists():
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

    state = json.loads((session_dir / "state.json").read_text(encoding="utf-8"))
    output_format = state.get("output_format", "dxf")
    output_path = session_dir / f"output.{output_format}"

    if not output_path.exists():
        # Fallback to DXF
        output_path = session_dir / "output.dxf"
        if not output_path.exists():
            raise HTTPException(
                status_code=404,
                detail="아직 색상이 적용되지 않았습니다. 먼저 '적용' 버튼을 눌러주세요.",
            )

    filename = state.get("output_filename", f"layeron_{state['file_name']}")
    media_type = "application/dwg" if output_format == "dwg" else "application/dxf"

    return FileResponse(
        path=str(output_path),
        filename=filename,
        media_type=media_type,
    )


def cleanup_old_sessions(max_age_hours: int = 24):
    """Delete sessions older than max_age_hours from /tmp/layeron/."""
    if not SESSIONS_DIR.exists():
        return
    now = datetime.now(timezone.utc).timestamp()
    for session_dir in SESSIONS_DIR.iterdir():
        if not session_dir.is_dir():
            continue
        state_file = session_dir / "state.json"
        if state_file.exists():
            try:
                state = json.loads(state_file.read_text(encoding="utf-8"))
                created = datetime.fromisoformat(state["created_at"]).timestamp()
                if now - created > max_age_hours * 3600:
                    shutil.rmtree(session_dir)
            except (json.JSONDecodeError, KeyError, OSError):
                shutil.rmtree(session_dir, ignore_errors=True)
        else:
            if now - session_dir.stat().st_mtime > max_age_hours * 3600:
                shutil.rmtree(session_dir, ignore_errors=True)
