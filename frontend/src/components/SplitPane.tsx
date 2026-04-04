"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  minLeft?: number;
  minRight?: number;
}

export default function SplitPane({
  left,
  right,
  minLeft = 300,
  minRight = 300,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [narrow, setNarrow] = useState(false);

  // Check window width for responsive behavior
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Initialize leftWidth to 50%
  useEffect(() => {
    if (containerRef.current && leftWidth === null) {
      setLeftWidth(Math.floor(containerRef.current.offsetWidth / 2));
    }
  }, [leftWidth]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const maxLeft = rect.width - minRight;
      setLeftWidth(Math.max(minLeft, Math.min(x, maxLeft)));
    };

    const handleMouseUp = () => setDragging(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, minLeft, minRight]);

  // Narrow: show only left panel
  if (narrow) {
    return (
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">{left}</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-1 overflow-hidden"
      style={{ cursor: dragging ? "col-resize" : undefined }}
    >
      {/* Left panel */}
      <div
        className="flex flex-col overflow-hidden"
        style={{
          width: leftWidth ?? "50%",
          flexShrink: 0,
        }}
      >
        {left}
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          width: 4,
          flexShrink: 0,
          cursor: "col-resize",
          background: dragging ? "var(--accent-blue)" : "var(--border)",
          transition: dragging ? "none" : "background 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!dragging)
            e.currentTarget.style.background = "var(--accent-blue)";
        }}
        onMouseLeave={(e) => {
          if (!dragging) e.currentTarget.style.background = "var(--border)";
        }}
      />

      {/* Right panel */}
      <div className="flex-1 flex flex-col overflow-hidden">{right}</div>
    </div>
  );
}
