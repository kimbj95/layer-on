"use client";

import { useState, useRef, useEffect } from "react";

interface TopBarProps {
  dirty: boolean;
  saving: boolean;
  hasSession: boolean;
  onSave: (format: "dxf" | "dwg") => void;
  onResetAll: () => void;
}

export default function TopBar({
  dirty,
  saving,
  hasSession,
  onSave,
  onResetAll,
}: TopBarProps) {
  const saveEnabled = hasSession && !saving;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <div
      className="flex items-center justify-between shrink-0"
      style={{
        padding: "10px 16px",
        background: "var(--bg-panel)",
        borderBottom: "0.5px solid var(--border)",
      }}
    >
      <div
        className="font-medium"
        style={{ fontSize: 15, color: "#fff", letterSpacing: "0.3px" }}
      >
        Layer<span style={{ color: "var(--accent-blue)" }}>On</span>
      </div>
      <div className="flex gap-2">
        {hasSession && (
          <button
            onClick={onResetAll}
            className="cursor-pointer"
            style={{
              fontSize: 12,
              padding: "5px 12px",
              borderRadius: 6,
              border: "0.5px solid var(--border-interactive)",
              background: "transparent",
              color: "var(--text-label)",
            }}
          >
            기본값 초기화
          </button>
        )}
        <div style={{ position: "relative" }} ref={menuRef}>
          <div className="flex">
            {/* Main save button */}
            <button
              disabled={!saveEnabled}
              onClick={() => setMenuOpen((v) => !v)}
              className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                fontSize: 12,
                padding: "5px 12px",
                borderRadius: 6,
                border: `0.5px solid ${saveEnabled ? "var(--accent-blue)" : "var(--border-interactive)"}`,
                background: saveEnabled ? "var(--accent-blue)" : "var(--btn-bg)",
                color: saveEnabled ? "#fff" : "var(--text-label)",
                position: "relative",
              }}
            >
              {saving ? "적용 중..." : "저장"}
              {dirty && !saving && (
                <span
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#FFD32A",
                    border: "1.5px solid var(--bg-panel)",
                  }}
                />
              )}
            </button>
          </div>
          {/* Dropdown menu */}
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                right: 0,
                background: "var(--bg-panel)",
                border: "0.5px solid var(--border)",
                borderRadius: 6,
                overflow: "hidden",
                zIndex: 50,
                minWidth: 120,
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
            >
              {(["dxf", "dwg"] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => {
                    setMenuOpen(false);
                    onSave(fmt);
                  }}
                  className="cursor-pointer"
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    fontSize: 12,
                    padding: "7px 12px",
                    border: "none",
                    background: "transparent",
                    color: "var(--text-primary)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(96,165,250,0.25)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  {fmt.toUpperCase()} 저장
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
