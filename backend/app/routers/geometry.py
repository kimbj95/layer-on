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
    min_x = min_y = float("inf")
    max_x = max_y = float("-inf")

    def _update_bounds(x: float, y: float) -> None:
        nonlocal min_x, min_y, max_x, max_y
        if x < min_x: min_x = x
        if x > max_x: max_x = x
        if y < min_y: min_y = y
        if y > max_y: max_y = y

    for e in msp:
        etype = e.dxftype()
        layer = e.dxf.layer
        total += 1

        if etype == "LINE":
            p0 = [e.dxf.start.x, e.dxf.start.y]
            p1 = [e.dxf.end.x, e.dxf.end.y]
            entities.append({"type": "line", "layer": layer, "points": [p0, p1]})
            _update_bounds(p0[0], p0[1])
            _update_bounds(p1[0], p1[1])
        elif etype in ("LWPOLYLINE", "POLYLINE"):
            try:
                pts = [[p[0], p[1]] for p in e.get_points(format="xy")]
            except Exception:
                continue
            if pts:
                entities.append({
                    "type": "polyline", "layer": layer,
                    "points": pts, "closed": bool(getattr(e, "closed", False)),
                })
                for p in pts:
                    _update_bounds(p[0], p[1])
        elif etype == "CIRCLE":
            cx, cy = e.dxf.center.x, e.dxf.center.y
            entities.append({
                "type": "circle", "layer": layer,
                "center": [cx, cy], "radius": e.dxf.radius,
            })
            _update_bounds(cx, cy)
        elif etype == "ARC":
            cx, cy = e.dxf.center.x, e.dxf.center.y
            entities.append({
                "type": "arc", "layer": layer,
                "center": [cx, cy], "radius": e.dxf.radius,
                "start_angle": e.dxf.start_angle, "end_angle": e.dxf.end_angle,
            })
            _update_bounds(cx, cy)
        elif etype == "POINT":
            px, py = e.dxf.location.x, e.dxf.location.y
            entities.append({"type": "point", "layer": layer, "position": [px, py]})
            _update_bounds(px, py)
        else:
            continue

        if len(entities) >= MAX_ENTITIES:
            truncated = True
            break

    bounds = {
        "min_x": min_x if min_x != float("inf") else 0,
        "min_y": min_y if min_y != float("inf") else 0,
        "max_x": max_x if max_x != float("-inf") else 1,
        "max_y": max_y if max_y != float("-inf") else 1,
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
