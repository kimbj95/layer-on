"use client";

import { useState } from "react";
import type { LayerInfo, SessionState } from "@/types";
import UploadZone from "./UploadZone";
import FileInfo from "./FileInfo";
import ColorEditor from "./ColorEditor";
import SecurityModal from "./SecurityModal";
import UsageGuideModal from "./UsageGuideModal";

interface SidebarProps {
  session: SessionState | null;
  selectedLayerInfo: LayerInfo | null;
  onUploadComplete: (data: SessionState) => void;
  onError: (message: string) => void;
  onReset: () => void;
  onColorChange: (layerName: string, aciColor: number) => void;
  onApplyToCategory: (categoryMajor: string, aciColor: number) => void;
  onResetToDefault: (layerName: string) => void;
}

export default function Sidebar({
  session,
  selectedLayerInfo,
  onUploadComplete,
  onError,
  onReset,
  onColorChange,
  onApplyToCategory,
  onResetToDefault,
}: SidebarProps) {
  const totalLayers = session?.total_layers ?? 0;
  const totalCategories = session
    ? new Set(
        session.categories
          .map((c) => c.category_major)
          .filter((c) => c !== "")
      ).size
    : 0;

  const [showSecurity, setShowSecurity] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  return (
    <div
      className="flex flex-col shrink-0 overflow-y-auto"
      style={{
        width: 240,
        background: "var(--bg-panel)",
        borderRight: "0.5px solid var(--border)",
      }}
    >
      <UploadZone onUploadComplete={onUploadComplete} onError={onError} onOpenGuide={() => setShowGuide(true)} />

      {session && (
        <>
          <FileInfo session={session} onReset={onReset} />

          <div
            className="uppercase font-medium"
            style={{
              padding: "8px 12px 4px",
              fontSize: 10,
              color: "var(--text-dim)",
              letterSpacing: "0.8px",
            }}
          >
            파일 요약
          </div>
          <div className="flex gap-1.5" style={{ padding: "0 12px 12px" }}>
            <div
              className="flex-1"
              style={{
                background: "var(--bg-card)",
                borderRadius: 6,
                padding: "6px 8px",
              }}
            >
              <div
                className="font-medium"
                style={{ fontSize: 16, color: "#fff" }}
              >
                {totalLayers}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 1 }}>
                총 레이어
              </div>
            </div>
            <div
              className="flex-1"
              style={{
                background: "var(--bg-card)",
                borderRadius: 6,
                padding: "6px 8px",
              }}
            >
              <div
                className="font-medium"
                style={{ fontSize: 16, color: "#fff" }}
              >
                {totalCategories}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 1 }}>
                대분류
              </div>
            </div>
          </div>

          {selectedLayerInfo && (
            <ColorEditor
              layer={selectedLayerInfo}
              onColorChange={onColorChange}
              onApplyToCategory={onApplyToCategory}
              onResetToDefault={onResetToDefault}
            />
          )}
        </>
      )}

      <div
        className="mt-auto flex"
        style={{
          padding: "10px 10px",
          fontSize: 10,
          lineHeight: 1.5,
          gap: 6,
        }}
      >
        <a
          href="https://www.law.go.kr/LSW/admRulLsInfoP.do?admRulSeq=2100000214069"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex flex-col items-center justify-center"
          style={{
            color: "var(--text-dim)",
            textDecoration: "none",
            textAlign: "center",
            padding: "6px 4px",
            borderRadius: 6,
            border: "0.5px solid var(--border)",
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-hover)";
            e.currentTarget.style.borderColor = "var(--border-interactive)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        >
          <div style={{ color: "var(--text-code)" }}>적용 기준</div>
          <div>국토지리정보원</div>
          <div>고시 제2022-3600호</div>
        </a>
        <button
          onClick={() => setShowSecurity(true)}
          className="flex-1 flex flex-col items-center justify-center"
          style={{
            background: "none",
            padding: "6px 4px",
            color: "var(--text-dim)",
            cursor: "pointer",
            borderRadius: 6,
            border: "0.5px solid var(--border)",
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-hover)";
            e.currentTarget.style.borderColor = "var(--border-interactive)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: 1 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          보안안내
        </button>
      </div>

      <SecurityModal open={showSecurity} onClose={() => setShowSecurity(false)} />
      <UsageGuideModal open={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
}
