import asyncio
import json
import shutil
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator

import ezdxf
from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from utils.color_utils import get_default_aci
from utils.dwg_converter import (
    is_converter_available,
    modify_dwg,
    list_dwg_layers,
    dwg_to_dxf_preview,
)
from utils.layer_mapper import LayerMapper

router = APIRouter(prefix="/api")

SESSIONS_DIR = Path("/tmp/layeron")
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
PARSE_TIMEOUT = 60  # seconds

mapper = LayerMapper()


def _sse_event(event: str, data: dict) -> str:
    """Format a single SSE event string."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# ── Layer parsing ────────────────────────────────


def _sync_read_dxf_layers(file_path: str) -> list[dict]:
    """Read DXF and extract raw layer data (name + ACI color)."""
    doc = ezdxf.readfile(file_path)
    return [{"name": layer.dxf.name, "aci_color": layer.color} for layer in doc.layers]


def _map_layers(raw_layers: list[dict]) -> list[dict]:
    """Map raw layers to standard layer info via LayerMapper."""
    layers = []
    for raw in raw_layers:
        info = mapper.get_layer_info(raw["name"])
        default_aci = get_default_aci(info)
        layers.append({
            "original_name": raw["name"],
            **info,
            "current_aci_color": raw["aci_color"],
            "default_aci_color": default_aci,
            "original_aci_color": raw["aci_color"],
        })
    return layers


def _sync_parse_dxf(file_path: str) -> list[dict]:
    """Synchronous ezdxf parsing — runs in thread pool."""
    return _map_layers(_sync_read_dxf_layers(file_path))


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


# ── Upload endpoints ─────────────────────────────


async def _parse_and_build_state(
    session_id: str,
    session_dir: Path,
    file_name: str,
    file_size: int,
    original_format: str,
) -> dict:
    """Parse layers from DXF or DWG and build session state."""
    if original_format == "dwg":
        dwg_path = str(session_dir / "input.dwg")
        try:
            raw_data = await asyncio.wait_for(
                list_dwg_layers(dwg_path),
                timeout=PARSE_TIMEOUT,
            )
        except asyncio.TimeoutError:
            raise HTTPException(status_code=408, detail="파일 파싱 시간이 초과되었습니다.")
        except Exception:
            raise HTTPException(status_code=422, detail="DWG 파일을 읽을 수 없습니다.")

        raw_layers = raw_data.get("layers", [])
        layers = _map_layers(raw_layers)
    else:
        dxf_path = str(session_dir / "input.dxf")
        try:
            layers = await asyncio.wait_for(
                asyncio.to_thread(_sync_parse_dxf, dxf_path),
                timeout=PARSE_TIMEOUT,
            )
        except asyncio.TimeoutError:
            raise HTTPException(status_code=408, detail="파일 파싱 시간이 초과되었습니다.")
        except ezdxf.DXFError:
            raise HTTPException(status_code=422, detail="DXF 파일을 읽을 수 없습니다.")
        except Exception:
            raise HTTPException(status_code=422, detail="DXF 파일을 읽을 수 없습니다.")

    state = _build_session_state(session_id, file_name, file_size, layers, original_format)

    # Generate preview DXF for geometry extraction (DWG only, async background)
    if original_format == "dwg":
        asyncio.create_task(_generate_preview(session_dir))

    return state


async def _generate_preview(session_dir: Path) -> None:
    """Generate preview.dxf from input.dwg for geometry extraction."""
    try:
        await dwg_to_dxf_preview(
            str(session_dir / "input.dwg"),
            str(session_dir / "preview.dxf"),
        )
    except Exception:
        pass  # Preview failure is non-critical


@router.post("/upload")
async def upload_file(file: UploadFile):
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

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="파일 크기는 50MB 이하만 지원합니다")

    session_id = str(uuid.uuid4())
    session_dir = SESSIONS_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    original_format = "dwg" if ext == ".dwg" else "dxf"
    input_file = session_dir / f"input.{original_format}"
    input_file.write_bytes(content)

    state = await _parse_and_build_state(
        session_id, session_dir, file.filename, len(content), original_format
    )
    return state


@router.post("/upload-stream")
async def upload_file_stream(file: UploadFile):
    """Same as /upload but returns SSE progress events."""
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
            yield _sse_event("progress", {
                "step": "uploading", "message": "파일 업로드 중...", "percent": 10,
            })

            session_id = str(uuid.uuid4())
            session_dir = SESSIONS_DIR / session_id
            session_dir.mkdir(parents=True, exist_ok=True)
            original_format = "dwg" if ext == ".dwg" else "dxf"

            input_file = session_dir / f"input.{original_format}"
            input_file.write_bytes(content)

            # Step: parsing
            yield _sse_event("progress", {
                "step": "parsing", "message": "레이어 분석 중...", "percent": 50,
            })

            if original_format == "dwg":
                try:
                    raw_data = await asyncio.wait_for(
                        list_dwg_layers(str(input_file)),
                        timeout=PARSE_TIMEOUT,
                    )
                except Exception:
                    yield _sse_event("error", {"message": "DWG 파일을 읽을 수 없습니다."})
                    return
                raw_layers = raw_data.get("layers", [])
            else:
                try:
                    raw_layers = await asyncio.wait_for(
                        asyncio.to_thread(_sync_read_dxf_layers, str(input_file)),
                        timeout=PARSE_TIMEOUT,
                    )
                except Exception:
                    yield _sse_event("error", {"message": "DXF 파일을 읽을 수 없습니다."})
                    return

            # Step: mapping
            yield _sse_event("progress", {
                "step": "mapping", "message": "표준코드 매핑 중...", "percent": 75,
            })
            layers = await asyncio.to_thread(_map_layers, raw_layers)

            # Step: finalizing
            yield _sse_event("progress", {
                "step": "finalizing", "message": "마무리 중...", "percent": 90,
            })
            state = _build_session_state(
                session_id, filename, len(content), layers, original_format,
            )

            # Generate preview for DWG (background)
            if original_format == "dwg":
                asyncio.create_task(_generate_preview(session_dir))

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


# ── Session ──────────────────────────────────────


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    state_path = SESSIONS_DIR / session_id / "state.json"
    if not state_path.exists():
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    state = json.loads(state_path.read_text(encoding="utf-8"))
    state["converter_available"] = is_converter_available()
    return state


# ── Apply colors ─────────────────────────────────


class LayerOverride(BaseModel):
    aci_color: int | None = None


class ApplyRequest(BaseModel):
    layer_overrides: dict[str, LayerOverride] = {}
    hidden_layers: list[str] = []


def _sync_apply_dxf(
    session_dir: Path,
    overrides: dict[str, dict],
    hidden_layers: set[str],
) -> None:
    """Apply ACI colors + descriptions to DXF file."""
    doc = ezdxf.readfile(str(session_dir / "input.dxf"))

    # Upgrade to R2010 for UTF-8 description encoding
    if doc.dxfversion < "AC1024":
        doc._dxfversion = "AC1024"
        doc.header["$ACADVER"] = "AC1024"

    for layer in doc.layers:
        layer_name = layer.dxf.name
        layer_info = mapper.get_layer_info(layer_name)
        default_aci = get_default_aci(layer_info)

        # Determine ACI color
        if layer_name in overrides:
            aci = overrides[layer_name].get("aci_color", default_aci)
        else:
            aci = default_aci

        # Apply ACI color (remove any true_color)
        layer.color = aci
        if layer.dxf.hasattr("true_color"):
            del layer.dxf.true_color

        # Set description (DXF only)
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

        # Set linetype
        linetype = layer_info.get("linetype", "Continuous")
        if linetype != "Continuous":
            try:
                doc.linetypes.get(linetype)
                layer.dxf.linetype = linetype
            except ezdxf.DXFTableEntryError:
                pass

    # Delete entities on hidden layers
    if hidden_layers:
        msp = doc.modelspace()
        to_delete = [e for e in msp if e.dxf.layer in hidden_layers]
        for e in to_delete:
            msp.delete_entity(e)
        for layer in doc.layers:
            if layer.dxf.name in hidden_layers:
                layer.off()

    doc.saveas(str(session_dir / "output.dxf"))


async def _apply_dwg(
    session_dir: Path,
    overrides: dict[str, dict],
    hidden_layers: list[str],
) -> None:
    """Apply ACI colors to DWG file via ACadSharp CLI."""
    # Build config.json
    config = {"layers": {}, "hidden_layers": hidden_layers}

    # Get all layers from state
    state = json.loads((session_dir / "state.json").read_text(encoding="utf-8"))
    all_layers = []
    for cat in state.get("categories", []):
        all_layers.extend(cat.get("layers", []))
    all_layers.extend(state.get("unmapped_layers", []))

    for layer_data in all_layers:
        name = layer_data["original_name"]
        if name in overrides and "aci_color" in overrides[name]:
            aci = overrides[name]["aci_color"]
        else:
            aci = layer_data.get("default_aci_color", 7)
        config["layers"][name] = {"aci_color": aci}

    config_path = session_dir / "config.json"
    config_path.write_text(json.dumps(config, ensure_ascii=False), encoding="utf-8")

    await modify_dwg(
        str(session_dir / "input.dwg"),
        str(session_dir / "output.dwg"),
        str(config_path),
    )


@router.post("/session/{session_id}/apply")
async def apply_colors(session_id: str, body: ApplyRequest):
    session_dir = SESSIONS_DIR / session_id
    if not (session_dir / "state.json").exists():
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

    state = json.loads((session_dir / "state.json").read_text(encoding="utf-8"))
    original_format = state.get("original_format", "dxf")

    overrides = {k: v.model_dump(exclude_none=True) for k, v in body.layer_overrides.items()}

    try:
        if original_format == "dwg":
            await asyncio.wait_for(
                _apply_dwg(session_dir, overrides, body.hidden_layers),
                timeout=PARSE_TIMEOUT,
            )
        else:
            await asyncio.wait_for(
                asyncio.to_thread(
                    _sync_apply_dxf, session_dir, overrides, set(body.hidden_layers),
                ),
                timeout=PARSE_TIMEOUT,
            )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="파일 처리 시간이 초과되었습니다.")
    except ezdxf.DXFError:
        raise HTTPException(status_code=422, detail="파일 처리 중 오류가 발생했습니다.")
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Update state
    state["has_output"] = True
    stem = Path(state["file_name"]).stem
    state["output_filename"] = f"layeron_{stem}.{original_format}"
    (session_dir / "state.json").write_text(
        json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    return {"status": "ok", "output_filename": state["output_filename"]}


# ── Download ─────────────────────────────────────


@router.get("/session/{session_id}/download")
async def download_file(session_id: str):
    session_dir = SESSIONS_DIR / session_id
    if not (session_dir / "state.json").exists():
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

    state = json.loads((session_dir / "state.json").read_text(encoding="utf-8"))
    original_format = state.get("original_format", "dxf")
    output_path = session_dir / f"output.{original_format}"

    if not output_path.exists():
        raise HTTPException(
            status_code=404,
            detail="아직 색상이 적용되지 않았습니다. 먼저 '적용' 버튼을 눌러주세요.",
        )

    filename = state.get("output_filename", f"layeron_{state['file_name']}")
    media_type = "application/dwg" if original_format == "dwg" else "application/dxf"

    return FileResponse(path=str(output_path), filename=filename, media_type=media_type)


# ── Cleanup ──────────────────────────────────────


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
