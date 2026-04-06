"use client";

import type { LayerInfo } from "@/types";
import { ACI_PALETTE, aciToHex } from "@/lib/constants";

interface ColorEditorProps {
  layer: LayerInfo;
  onColorChange: (layerName: string, aciColor: number) => void;
  onApplyToCategory: (categoryMajor: string, aciColor: number) => void;
  onResetToDefault: (layerName: string) => void;
}

export default function ColorEditor({
  layer,
  onColorChange,
  onApplyToCategory,
  onResetToDefault,
}: ColorEditorProps) {
  const handleCategoryApply = () => {
    if (!layer.category_major) return;
    const categoryName = layer.category_major_name;
    const confirmed = window.confirm(
      `${layer.category_major} ${categoryName} 카테고리의 모든 레이어에 ACI ${layer.current_aci_color} 색상을 적용하시겠습니까?`,
    );
    if (confirmed) {
      onApplyToCategory(layer.category_major, layer.current_aci_color);
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
        <div
          style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 10 }}
        >
          {layer.category_major} {layer.category_major_name}
          {layer.category_mid ? ` > ${layer.category_mid}` : ""}
        </div>
      )}

      {/* ACI color palette */}
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: "repeat(5, 1fr)", marginBottom: 10 }}
      >
        {ACI_PALETTE.map((aci) => (
          <button
            key={aci}
            onClick={() => onColorChange(layer.original_name, aci)}
            className="cursor-pointer"
            title={`ACI ${aci}`}
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              background: aciToHex(aci),
              border:
                layer.current_aci_color === aci
                  ? "2px solid #fff"
                  : "0.5px solid rgba(255,255,255,0.15)",
            }}
          />
        ))}
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
