"use client";

import { useState } from "react";
import type { LayerInfo } from "@/types";
import { COLOR_PRESETS } from "@/lib/constants";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

interface ColorEditorProps {
  layer: LayerInfo;
  onColorChange: (layerName: string, color: string) => void;
  onApplyToCategory: (categoryMajor: string, color: string) => void;
  onResetToDefault: (layerName: string) => void;
}

export default function ColorEditor({
  layer,
  onColorChange,
  onApplyToCategory,
  onResetToDefault,
}: ColorEditorProps) {
  const [hexInput, setHexInput] = useState("");

  const applyHex = () => {
    const val = hexInput.startsWith("#") ? hexInput : `#${hexInput}`;
    if (HEX_RE.test(val)) {
      onColorChange(layer.original_name, val);
      setHexInput("");
    }
  };

  const handleCategoryApply = () => {
    if (!layer.category_major) return;
    const categoryName = layer.category_major_name;
    const confirmed = window.confirm(
      `${layer.category_major} ${categoryName} 카테고리의 모든 레이어에 현재 색상(${layer.current_color})을 적용하시겠습니까?`
    );
    if (confirmed) {
      onApplyToCategory(layer.category_major, layer.current_color);
    }
  };

  return (
    <div
      style={{
        margin: "0 12px 12px",
        background: "var(--bg-card)",
        border: "0.5px solid var(--border)",
        borderRadius: 8,
        padding: "10px 12px",
      }}
    >
      {/* Section label */}
      <div
        className="uppercase font-medium"
        style={{
          fontSize: 10,
          color: "var(--text-dim)",
          letterSpacing: "0.8px",
          marginBottom: 8,
        }}
      >
        색상 편집
      </div>

      {/* Layer info */}
      <div
        className="font-mono"
        style={{ fontSize: 10, color: "var(--text-code)", marginBottom: 2 }}
      >
        {layer.original_name}
      </div>
      <div
        className="font-medium"
        style={{ fontSize: 12, color: "var(--accent-blue)", marginBottom: 4 }}
      >
        {layer.name}
      </div>
      {layer.category_major && (
        <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 10 }}>
          {layer.category_major} {layer.category_major_name}
          {layer.category_mid ? ` > ${layer.category_mid}` : ""}
        </div>
      )}

      {/* Color preset grid */}
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: "repeat(5, 1fr)", marginBottom: 8 }}
      >
        {COLOR_PRESETS.map((color) => (
          <button
            key={color}
            onClick={() => onColorChange(layer.original_name, color)}
            className="cursor-pointer"
            style={{
              width: 28,
              height: 28,
              borderRadius: 5,
              background: color,
              border:
                layer.current_color.toLowerCase() === color.toLowerCase()
                  ? "2px solid #fff"
                  : "0.5px solid rgba(255,255,255,0.1)",
            }}
          />
        ))}
      </div>

      {/* Custom hex input */}
      <div className="flex items-center gap-1.5" style={{ marginBottom: 10 }}>
        <div
          className="shrink-0"
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            background:
              HEX_RE.test(hexInput.startsWith("#") ? hexInput : `#${hexInput}`)
                ? hexInput.startsWith("#") ? hexInput : `#${hexInput}`
                : layer.current_color,
            border: "0.5px solid rgba(255,255,255,0.1)",
          }}
        />
        <input
          value={hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyHex()}
          onBlur={() => hexInput && applyHex()}
          placeholder="#RRGGBB"
          className="flex-1 outline-none"
          style={{
            background: "var(--bg-app)",
            border: "0.5px solid var(--border)",
            borderRadius: 5,
            padding: "3px 6px",
            fontSize: 11,
            color: "var(--text-label)",
            fontFamily: "monospace",
          }}
        />
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-1.5">
        {layer.category_major && (
          <button
            onClick={handleCategoryApply}
            className="cursor-pointer"
            style={{
              width: "100%",
              fontSize: 11,
              padding: "5px 0",
              borderRadius: 5,
              border: "0.5px solid var(--border-interactive)",
              background: "var(--btn-bg)",
              color: "var(--text-muted)",
              textAlign: "center",
            }}
          >
            같은 대분류 전체 적용
          </button>
        )}
        <button
          onClick={() => onResetToDefault(layer.original_name)}
          className="cursor-pointer"
          style={{
            width: "100%",
            fontSize: 11,
            padding: "5px 0",
            borderRadius: 5,
            border: "0.5px solid var(--border)",
            background: "transparent",
            color: "var(--text-dim)",
            textAlign: "center",
          }}
        >
          기본값으로
        </button>
      </div>
    </div>
  );
}
