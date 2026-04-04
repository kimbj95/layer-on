import asyncio
import json
from pathlib import Path

import ezdxf
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api")

SESSIONS_DIR = Path("/tmp/layeron")
MAX_ENTITIES = 50_000
GEOMETRY_TIMEOUT = 60


def _sync_extract_geometry(dxf_path: Path) -> dict:
    """Extract drawable geometry from DXF modelspace."""
    doc = ezdxf.readfile(str(dxf_path))
    msp = doc.modelspace()

    entities: list[dict] = []
    total = 0
    truncated = False

    for e in msp:
        etype = e.dxftype()
        layer = e.dxf.layer
        total += 1

        if etype == "LINE":
            entities.append({
                "type": "line",
                "layer": layer,
                "points": [
                    [e.dxf.start.x, e.dxf.start.y],
                    [e.dxf.end.x, e.dxf.end.y],
                ],
            })
        elif etype in ("LWPOLYLINE", "POLYLINE"):
            try:
                pts = [[p[0], p[1]] for p in e.get_points(format="xy")]
            except Exception:
                continue
            if pts:
                entities.append({
                    "type": "polyline",
                    "layer": layer,
                    "points": pts,
                    "closed": bool(getattr(e, "closed", False)),
                })
        elif etype == "CIRCLE":
            entities.append({
                "type": "circle",
                "layer": layer,
                "center": [e.dxf.center.x, e.dxf.center.y],
                "radius": e.dxf.radius,
            })
        elif etype == "ARC":
            entities.append({
                "type": "arc",
                "layer": layer,
                "center": [e.dxf.center.x, e.dxf.center.y],
                "radius": e.dxf.radius,
                "start_angle": e.dxf.start_angle,
                "end_angle": e.dxf.end_angle,
            })
        elif etype == "POINT":
            entities.append({
                "type": "point",
                "layer": layer,
                "position": [e.dxf.location.x, e.dxf.location.y],
            })
        else:
            continue

        if len(entities) >= MAX_ENTITIES:
            truncated = True
            break

    # Calculate bounds
    all_x: list[float] = []
    all_y: list[float] = []
    for ent in entities:
        if "points" in ent:
            for p in ent["points"]:
                all_x.append(p[0])
                all_y.append(p[1])
        elif "center" in ent:
            all_x.append(ent["center"][0])
            all_y.append(ent["center"][1])
        elif "position" in ent:
            all_x.append(ent["position"][0])
            all_y.append(ent["position"][1])

    bounds = {
        "min_x": min(all_x) if all_x else 0,
        "min_y": min(all_y) if all_y else 0,
        "max_x": max(all_x) if all_x else 1,
        "max_y": max(all_y) if all_y else 1,
    }

    return {
        "bounds": bounds,
        "entities": entities,
        "truncated": truncated,
        "total_entities": total,
    }


@router.get("/session/{session_id}/geometry")
async def get_geometry(session_id: str):
    session_dir = SESSIONS_DIR / session_id
    if not (session_dir / "state.json").exists():
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

    # Return cached geometry if available
    cache_path = session_dir / "geometry.json"
    if cache_path.exists():
        return json.loads(cache_path.read_text(encoding="utf-8"))

    dxf_path = session_dir / "input.dxf"
    if not dxf_path.exists():
        raise HTTPException(status_code=404, detail="DXF 파일을 찾을 수 없습니다")

    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(_sync_extract_geometry, dxf_path),
            timeout=GEOMETRY_TIMEOUT,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="지오메트리 추출 시간 초과")
    except Exception:
        raise HTTPException(status_code=422, detail="지오메트리 추출 실패")

    # Cache for subsequent requests
    cache_path.write_text(
        json.dumps(result, ensure_ascii=False), encoding="utf-8"
    )

    return result
