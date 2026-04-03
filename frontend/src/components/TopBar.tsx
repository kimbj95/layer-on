"use client";

import { useState, useRef, useEffect } from "react";

interface TopBarProps {
  dirty: boolean;
  saving: boolean;
  hasSession: boolean;
  originalFormat: "dxf" | "dwg" | null;
  converterAvailable: boolean;
  onSave: (format: "dxf" | "dwg") => void;
  onResetAll: () => void;
}

export default function TopBar({
  dirty,
  saving,
  hasSession,
  originalFormat,
  converterAvailable,
  onSave,
  onResetAll,
}: TopBarProps) {
  const saveEnabled = hasSession && !saving;
  const defaultFormat = originalFormat ?? "dxf";
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
              onClick={() => onSave(defaultFormat)}
              className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                fontSize: 12,
                padding: "5px 12px",
                borderRadius: converterAvailable ? "6px 0 0 6px" : 6,
                border: `0.5px solid ${saveEnabled ? "var(--accent-blue)" : "var(--border-interactive)"}`,
                borderRight: converterAvailable ? "none" : undefined,
                background: saveEnabled ? "var(--accent-blue)" : "var(--btn-bg)",
                color: saveEnabled ? "#fff" : "var(--text-label)",
                position: "relative",
              }}
            >
              {saving
                ? "적용 중..."
                : hasSession
                  ? `${defaultFormat.toUpperCase()} 저장`
                  : "저장"}
              {dirty && !saving && (
                <span
                  style={{
                    position: "absolute",
                    top: -2,
                    right: converterAvailable ? -1 : -2,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#FFD32A",
                    border: "1.5px solid var(--bg-panel)",
                  }}
                />
              )}
            </button>
            {/* Dropdown toggle */}
            {converterAvailable && hasSession && (
              <button
                disabled={!saveEnabled}
                onClick={() => setMenuOpen((v) => !v)}
                className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  fontSize: 10,
                  padding: "5px 6px",
                  borderRadius: "0 6px 6px 0",
                  border: `0.5px solid ${saveEnabled ? "var(--accent-blue)" : "var(--border-interactive)"}`,
                  background: saveEnabled ? "var(--accent-blue)" : "var(--btn-bg)",
                  color: saveEnabled ? "#fff" : "var(--text-label)",
                }}
              >
                ▾
              </button>
            )}
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
                    background:
                      fmt === defaultFormat
                        ? "rgba(96,165,250,0.15)"
                        : "transparent",
                    color: "var(--text-primary)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(96,165,250,0.25)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      fmt === defaultFormat
                        ? "rgba(96,165,250,0.15)"
                        : "transparent")
                  }
                >
                  {fmt.toUpperCase()} 저장
                  {fmt === defaultFormat && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 10,
                        color: "var(--text-dim)",
                      }}
                    >
                      (원본)
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
