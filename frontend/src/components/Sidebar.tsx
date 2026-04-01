"use client";

import type { LayerInfo, SessionState } from "@/types";
import UploadZone from "./UploadZone";
import DxfGuide from "./DxfGuide";
import FileInfo from "./FileInfo";
import ColorEditor from "./ColorEditor";

interface SidebarProps {
  session: SessionState | null;
  selectedLayerInfo: LayerInfo | null;
  onUploadComplete: (data: SessionState) => void;
  onError: (message: string) => void;
  onReset: () => void;
  onColorChange: (layerName: string, color: string) => void;
  onApplyToCategory: (categoryMajor: string, color: string) => void;
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

  return (
    <div
      className="flex flex-col shrink-0 overflow-y-auto"
      style={{
        width: 240,
        background: "var(--bg-panel)",
        borderRight: "0.5px solid var(--border)",
      }}
    >
      <UploadZone onUploadComplete={onUploadComplete} onError={onError} />
      <DxfGuide />

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
    </div>
  );
}
