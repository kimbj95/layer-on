import asyncio
import json
import shutil
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import ezdxf
from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from utils.color_utils import hex_to_rgb
from utils.layer_mapper import LayerMapper

router = APIRouter(prefix="/api")

SESSIONS_DIR = Path("/tmp/layeron")
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
PARSE_TIMEOUT = 60  # seconds

mapper = LayerMapper()


def _sync_parse_dxf(file_path: str) -> list[dict]:
    """Synchronous ezdxf parsing — runs in thread pool."""
    doc = ezdxf.readfile(file_path)
    layers = []
    for layer in doc.layers:
        layer_info = mapper.get_layer_info(layer.dxf.name)
        layers.append({
            "original_name": layer.dxf.name,
            **layer_info,
            "current_color": layer_info["default_color"],
            "original_aci_color": layer.color,
        })
    return layers


async def parse_dxf(session_id: str, file_path: str, file_name: str, file_size: int):
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
    }

    state_path = SESSIONS_DIR / session_id / "state.json"
    state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")

    return state


@router.post("/upload")
async def upload_dxf(file: UploadFile):
    # Validate extension
    if not file.filename or not file.filename.lower().endswith(".dxf"):
        raise HTTPException(
            status_code=400,
            detail="DXF 파일만 지원합니다. DWG 파일은 AutoCAD에서 DXF로 내보내기 후 업로드해주세요.",
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

    file_path = session_dir / "input.dxf"
    file_path.write_bytes(content)

    # Parse and return state
    state = await parse_dxf(session_id, str(file_path), file.filename, len(content))
    return state


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    state_path = SESSIONS_DIR / session_id / "state.json"
    if not state_path.exists():
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    return json.loads(state_path.read_text(encoding="utf-8"))


class LayerOverride(BaseModel):
    color: str | None = None
    linetype: str | None = None


class ApplyRequest(BaseModel):
    layer_overrides: dict[str, LayerOverride] = {}


def _sync_apply_colors(session_dir: Path, overrides: dict[str, dict]) -> dict:
    """Synchronous color application — runs in thread pool."""
    state = json.loads((session_dir / "state.json").read_text(encoding="utf-8"))
    doc = ezdxf.readfile(str(session_dir / "input.dxf"))

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

        # Apply true color (RGB) to layer
        r, g, b = hex_to_rgb(color_hex)
        layer.set_color(1)
        layer.rgb = (r, g, b)

        # Set description to Korean name
        korean_label = layer_info["name"]
        mid_category = layer_info.get("category_mid", "")
        if mid_category:
            layer.description = f"{korean_label} [{mid_category}]"
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

    state["has_output"] = True
    state["output_filename"] = f"layeron_{state['file_name']}"
    (session_dir / "state.json").write_text(
        json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    return {"status": "ok", "output_filename": state["output_filename"]}


@router.post("/session/{session_id}/apply")
async def apply_colors(session_id: str, body: ApplyRequest):
    session_dir = SESSIONS_DIR / session_id
    if not (session_dir / "state.json").exists():
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

    overrides = {k: v.model_dump(exclude_none=True) for k, v in body.layer_overrides.items()}

    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(_sync_apply_colors, session_dir, overrides),
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

    return result


@router.get("/session/{session_id}/download")
async def download_dxf(session_id: str):
    session_dir = SESSIONS_DIR / session_id
    if not (session_dir / "state.json").exists():
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

    output_path = session_dir / "output.dxf"
    if not output_path.exists():
        raise HTTPException(
            status_code=404,
            detail="아직 색상이 적용되지 않았습니다. 먼저 '적용' 버튼을 눌러주세요.",
        )

    state = json.loads((session_dir / "state.json").read_text(encoding="utf-8"))
    filename = state.get("output_filename", f"layeron_{state['file_name']}")

    return FileResponse(
        path=str(output_path),
        filename=filename,
        media_type="application/dxf",
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
                # Corrupt session — remove it
                shutil.rmtree(session_dir, ignore_errors=True)
        else:
            # No state file — leftover directory, check mtime
            if now - session_dir.stat().st_mtime > max_age_hours * 3600:
                shutil.rmtree(session_dir, ignore_errors=True)
