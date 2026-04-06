"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GeometryData } from "@/types";

interface MapPreviewProps {
  geometry: GeometryData | null;
  layerColors: Map<string, string>;
  hiddenLayers?: Set<string>;
  loading: boolean;
  error?: string | null;
  isDwg?: boolean;
}

interface Transform {
  offsetX: number;
  offsetY: number;
  scale: number;
}

export default function MapPreview({
  geometry,
  layerColors,
  hiddenLayers,
  loading,
  error,
  isDwg,
}: MapPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<Transform>({ offsetX: 0, offsetY: 0, scale: 1 });
  const [panning, setPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const rafRef = useRef<number>(0);

  // Store props in refs so draw functions never depend on them
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;
  const colorsRef = useRef(layerColors);
  colorsRef.current = layerColors;
  const hiddenRef = useRef(hiddenLayers);
  hiddenRef.current = hiddenLayers;

  // Calculate fit-all transform
  const calcFitTransform = useCallback(
    (width: number, height: number): Transform => {
      const geo = geometryRef.current;
      if (!geo) return { offsetX: 0, offsetY: 0, scale: 1 };
      const { min_x, min_y, max_x, max_y } = geo.bounds;
      const dw = max_x - min_x || 1;
      const dh = max_y - min_y || 1;
      const pad = 20;
      const scale = Math.min(
        (width - pad * 2) / dw,
        (height - pad * 2) / dh,
      );
      const offsetX = (width - dw * scale) / 2 - min_x * scale;
      const offsetY = (height + dh * scale) / 2 + min_y * scale;
      return { offsetX, offsetY, scale };
    },
    [],
  );

  // Draw everything to the visible canvas — reads from refs, no deps on props
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const geo = geometryRef.current;
    const colors = colorsRef.current;
    if (!canvas || !container || !geo) return;

    const w = container.offsetWidth;
    const h = container.offsetHeight;
    const dpr = 2;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear with dark background
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#1a1d21";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const t = transformRef.current;

    // White background for drawing bounds
    ctx.save();
    ctx.setTransform(t.scale * dpr, 0, 0, -t.scale * dpr, t.offsetX * dpr, t.offsetY * dpr);
    const { min_x, min_y, max_x, max_y } = geo.bounds;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(min_x, min_y, max_x - min_x, max_y - min_y);
    ctx.restore();

    // Draw entities
    ctx.save();
    ctx.setTransform(t.scale * dpr, 0, 0, -t.scale * dpr, t.offsetX * dpr, t.offsetY * dpr);
    ctx.lineWidth = 1 / t.scale;

    const hidden = hiddenRef.current;
    for (const entity of geo.entities) {
      if (hidden?.has(entity.layer)) continue;
      const color = colors.get(entity.layer) || "#888888";
      ctx.strokeStyle = color;

      switch (entity.type) {
        case "line":
          ctx.beginPath();
          ctx.moveTo(entity.points[0][0], entity.points[0][1]);
          ctx.lineTo(entity.points[1][0], entity.points[1][1]);
          ctx.stroke();
          break;

        case "polyline":
          if (entity.points.length < 2) break;
          ctx.beginPath();
          ctx.moveTo(entity.points[0][0], entity.points[0][1]);
          for (let i = 1; i < entity.points.length; i++) {
            ctx.lineTo(entity.points[i][0], entity.points[i][1]);
          }
          if (entity.closed) ctx.closePath();
          ctx.stroke();
          break;

        case "circle":
          ctx.beginPath();
          ctx.arc(entity.center[0], entity.center[1], entity.radius, 0, Math.PI * 2);
          ctx.stroke();
          break;

        case "arc":
          ctx.beginPath();
          ctx.arc(
            entity.center[0],
            entity.center[1],
            entity.radius,
            (entity.start_angle * Math.PI) / 180,
            (entity.end_angle * Math.PI) / 180,
          );
          ctx.stroke();
          break;

        case "point":
          ctx.fillStyle = color;
          ctx.fillRect(
            entity.position[0] - 0.5 / t.scale,
            entity.position[1] - 0.5 / t.scale,
            1 / t.scale,
            1 / t.scale,
          );
          break;
      }
    }

    ctx.restore();
  }, []);

  // Initialize transform when geometry loads
  const prevGeometryRef = useRef<GeometryData | null>(null);
  useEffect(() => {
    if (!geometry || !containerRef.current) return;
    if (prevGeometryRef.current === geometry) return;
    prevGeometryRef.current = geometry;
    const w = containerRef.current.offsetWidth;
    const h = containerRef.current.offsetHeight;
    transformRef.current = calcFitTransform(w, h);
    draw();
  }, [geometry, calcFitTransform, draw]);

  // Redraw when colors change (transform stays)
  useEffect(() => {
    if (!geometry) return;
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerColors, hiddenLayers]);

  // Resize observer — only re-registers when geometry identity changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !geometry) return;
    const observer = new ResizeObserver(() => {
      const w = container.offsetWidth;
      const h = container.offsetHeight;
      transformRef.current = calcFitTransform(w, h);
      draw();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [geometry, calcFitTransform, draw]);

  // Zoom (wheel)
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (!geometryRef.current) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const t = transformRef.current;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;

      transformRef.current = {
        scale: t.scale * factor,
        offsetX: mx - (mx - t.offsetX) * factor,
        offsetY: my - (my - t.offsetY) * factor,
      };

      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw);
    },
    [draw],
  );

  // Pan (drag)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!geometryRef.current || e.button !== 0) return;
      setPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        ox: transformRef.current.offsetX,
        oy: transformRef.current.offsetY,
      };
    },
    [],
  );

  useEffect(() => {
    if (!panning) return;

    const handleMouseMove = (e: MouseEvent) => {
      transformRef.current = {
        ...transformRef.current,
        offsetX: panStartRef.current.ox + (e.clientX - panStartRef.current.x),
        offsetY: panStartRef.current.oy + (e.clientY - panStartRef.current.y),
      };
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw);
    };

    const handleMouseUp = () => setPanning(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [panning, draw]);

  // Double-click: fit all
  const handleDoubleClick = useCallback(() => {
    if (!geometryRef.current || !containerRef.current) return;
    const w = containerRef.current.offsetWidth;
    const h = containerRef.current.offsetHeight;
    transformRef.current = calcFitTransform(w, h);
    draw();
  }, [calcFitTransform, draw]);

  // Empty / loading / error states
  if (!geometry && !loading && !error) {
    return (
      <div
        className="flex items-center justify-center flex-1"
        style={{ background: "#1a1d21", color: "var(--text-dim)", fontSize: 12 }}
      >
        파일을 업로드하면 도면 미리보기가 표시됩니다
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center flex-1 gap-2"
        style={{ background: "#1a1d21", color: "var(--text-muted)", fontSize: 12 }}
      >
        <svg
          className="animate-spin"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent-blue)"
          strokeWidth="2"
        >
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </svg>
        도면 로딩 중...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-center flex-1"
        style={{ background: "#1a1d21", color: "var(--text-dim)", fontSize: 12 }}
      >
        미리보기를 불러올 수 없습니다
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1"
      style={{
        background: "#1a1d21",
        cursor: panning ? "grabbing" : "grab",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
      {isDwg && (
        <div
          style={{
            position: "absolute",
            bottom: 6,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 10,
            color: "var(--text-dim)",
            pointerEvents: "none",
          }}
        >
          DWG 미리보기는 일부 요소가 표시되지 않을 수 있습니다 (다운로드 파일에는 영향 없음)
        </div>
      )}
    </div>
  );
}
