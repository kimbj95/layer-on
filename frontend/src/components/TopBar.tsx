"use client";

import { useState, useRef, useEffect } from "react";

interface TopBarProps {
  dirty: boolean;
  saving: boolean;
  hasSession: boolean;
  originalFormat: "dxf" | "dwg" | undefined;
  renameLayers: boolean;
  onRenameLayersChange: (value: boolean) => void;
  onSave: (format?: "dwg" | "dxf") => void;
  onResetAll: () => void;
}

export default function TopBar({
  dirty,
  saving,
  hasSession,
  originalFormat,
  renameLayers,
  onRenameLayersChange,
  onSave,
  onResetAll,
}: TopBarProps) {
  const enabled = hasSession && !saving;
  const isDwg = originalFormat === "dwg";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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

        {/* DWG: dropdown with format + rename option / DXF: dropdown with rename option */}
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            disabled={!enabled}
            onClick={() => setMenuOpen((v) => !v)}
            className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              fontSize: 12,
              padding: "5px 12px",
              borderRadius: 6,
              border: `0.5px solid ${enabled ? "var(--accent-blue)" : "var(--border-interactive)"}`,
              background: enabled ? "var(--accent-blue)" : "var(--btn-bg)",
              color: enabled ? "#fff" : "var(--text-label)",
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {saving ? "적용 중..." : "다운로드"}
            {!saving && (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
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

          {menuOpen && enabled && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                right: 0,
                minWidth: 240,
                background: "var(--bg-panel)",
                border: "0.5px solid var(--border)",
                borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                zIndex: 100,
                overflow: "hidden",
              }}
            >
              {/* Rename toggle */}
              <label
                className="flex items-center gap-2.5 cursor-pointer select-none"
                onClick={(e) => e.stopPropagation()}
                style={{
                  padding: "10px 14px",
                  margin: "8px 8px 4px",
                  borderRadius: 6,
                  background: renameLayers ? "rgba(77,159,255,0.08)" : "var(--bg-card)",
                  border: `0.5px solid ${renameLayers ? "rgba(77,159,255,0.25)" : "var(--border)"}`,
                  transition: "background 0.15s, border-color 0.15s",
                }}
              >
                <input
                  type="checkbox"
                  checked={renameLayers}
                  onChange={(e) => onRenameLayersChange(e.target.checked)}
                  style={{ accentColor: "var(--accent-blue)", width: 13, height: 13, flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-label)" }}>
                    레이어명 영문 변환
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                    예) A0013111 → A0013111_Traffic_RoadBoundary
                  </div>
                </div>
              </label>

              {isDwg ? (
                <>
                  <button
                    onClick={() => { setMenuOpen(false); onSave("dwg"); }}
                    className="cursor-pointer"
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "10px 14px",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      borderBottom: "0.5px solid var(--border)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
                      DWG 다운로드
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      색상만 변경 · 원본 구조 보존
                    </div>
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); onSave("dxf"); }}
                    className="cursor-pointer"
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "10px 14px",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
                        DXF 다운로드
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "1px 5px",
                          borderRadius: 4,
                          background: "var(--accent-blue)",
                          color: "#fff",
                          fontWeight: 600,
                        }}
                      >
                        추천
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      색상 + 레이어 설명 포함
                    </div>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setMenuOpen(false); onSave(); }}
                  className="cursor-pointer"
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px 14px",
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
                    DXF 다운로드
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
