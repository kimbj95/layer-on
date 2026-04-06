"use client";

import { useMemo, useState } from "react";
import type { CategoryGroup, LayerInfo, SessionState } from "@/types";
import { ACI_PALETTE, CATEGORY_ACI_MAP, aciToHex } from "@/lib/constants";
import LinetypePreview from "./LinetypePreview";

interface LayerListProps {
  session: SessionState;
  query: string;
  activeCategories: Set<string>;
  selectedLayer: string | null;
  onSelectLayer: (layerName: string) => void;
  onApplyToCategory: (categoryMajor: string, aciColor: number) => void;
  hiddenLayers: Set<string>;
  onToggleLayerVisibility: (layerName: string) => void;
  onToggleCategoryVisibility: (categoryMajor: string) => void;
}

function matchesQuery(layer: LayerInfo, q: string): boolean {
  const lower = q.toLowerCase();
  return (
    layer.original_name.toLowerCase().includes(lower) ||
    layer.name.toLowerCase().includes(lower) ||
    layer.code.toLowerCase().includes(lower) ||
    layer.category_mid.toLowerCase().includes(lower)
  );
}

export default function LayerList({
  session,
  query,
  activeCategories,
  selectedLayer,
  onSelectLayer,
  onApplyToCategory,
  hiddenLayers,
  onToggleLayerVisibility,
  onToggleCategoryVisibility,
}: LayerListProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Filter categories and layers
  const { filteredCategories, filteredUnmapped } = useMemo(() => {
    const cats: CategoryGroup[] = [];
    for (const group of session.categories) {
      // Skip empty-key groups (unmapped go to separate section)
      if (group.category_major === "") continue;
      // Category filter
      if (
        activeCategories.size > 0 &&
        !activeCategories.has(group.category_major)
      ) {
        continue;
      }
      const layers = query
        ? group.layers.filter((l) => matchesQuery(l, query))
        : group.layers;
      if (layers.length > 0) {
        cats.push({ ...group, layers, count: layers.length });
      }
    }

    let unmapped = session.unmapped_layers;
    if (query) {
      unmapped = unmapped.filter((l) => matchesQuery(l, query));
    }
    // If category filters active and none include "", hide unmapped
    if (activeCategories.size > 0) {
      unmapped = [];
    }

    return { filteredCategories: cats, filteredUnmapped: unmapped };
  }, [session, query, activeCategories]);

  const hasResults =
    filteredCategories.length > 0 || filteredUnmapped.length > 0;

  if (!hasResults) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ color: "var(--text-dim)", fontSize: 13 }}
      >
        검색 결과가 없습니다
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "4px 0" }}>
      {filteredCategories.map((group) => {
        const key = group.category_major;
        const isCollapsed = collapsed[key] ?? false;
        const dotColor = aciToHex(CATEGORY_ACI_MAP[key] ?? 7);

        const allHidden = group.layers.every((l) =>
          hiddenLayers.has(l.original_name),
        );

        return (
          <div key={key}>
            <GroupHeader
              arrow={isCollapsed ? "▶" : "▼"}
              dotColor={dotColor}
              label={`${key} · ${group.category_major_name}`}
              count={group.count}
              onClick={() => toggleGroup(key)}
              onApplyColor={(color) => onApplyToCategory(key, color)}
              checked={!allHidden}
              onToggleVisibility={() => onToggleCategoryVisibility(key)}
            />
            {!isCollapsed &&
              group.layers.map((layer) => (
                <LayerRow
                  key={layer.original_name}
                  layer={layer}
                  selected={selectedLayer === layer.original_name}
                  hidden={hiddenLayers.has(layer.original_name)}
                  onToggleVisibility={() =>
                    onToggleLayerVisibility(layer.original_name)
                  }
                  onClick={() => onSelectLayer(layer.original_name)}
                />
              ))}
            <div
              style={{
                height: "0.5px",
                background: "var(--border)",
                margin: "4px 0",
              }}
            />
          </div>
        );
      })}

      {filteredUnmapped.length > 0 && (
        <div>
          <GroupHeader
            arrow={collapsed["__unmapped"] ? "▶" : "▼"}
            dotColor="#b8860b"
            label={`미매핑 레이어`}
            count={filteredUnmapped.length}
            onClick={() => toggleGroup("__unmapped")}
            warning
          />
          {!collapsed["__unmapped"] &&
            filteredUnmapped.map((layer) => (
              <LayerRow
                key={layer.original_name}
                layer={layer}
                selected={selectedLayer === layer.original_name}
                hidden={hiddenLayers.has(layer.original_name)}
                onToggleVisibility={() =>
                  onToggleLayerVisibility(layer.original_name)
                }
                onClick={() => onSelectLayer(layer.original_name)}
                unmapped
              />
            ))}
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ───────────────────────────── */

function GroupHeader({
  arrow,
  dotColor,
  label,
  count,
  onClick,
  warning,
  onApplyColor,
  checked,
  onToggleVisibility,
}: {
  arrow: string;
  dotColor: string;
  label: string;
  count: number;
  onClick: () => void;
  warning?: boolean;
  onApplyColor?: (aciColor: number) => void;
  checked?: boolean;
  onToggleVisibility?: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div
      className="flex items-center gap-2 select-none"
      style={{ padding: "6px 14px", position: "relative" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "var(--bg-hover)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {onToggleVisibility && (
        <input
          type="checkbox"
          checked={checked ?? true}
          onChange={onToggleVisibility}
          className="shrink-0 cursor-pointer"
          style={{ width: 12, height: 12, accentColor: "var(--accent-blue)" }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <span
        onClick={onClick}
        className="cursor-pointer"
        style={{
          fontSize: 10,
          color: "var(--text-dim)",
          width: 12,
          textAlign: "center",
        }}
      >
        {arrow}
      </span>
      <span
        onClick={onClick}
        className="shrink-0 cursor-pointer"
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          background: dotColor,
        }}
      />
      <span
        onClick={onClick}
        className="flex-1 font-medium cursor-pointer"
        style={{
          fontSize: 12,
          color: warning ? "#b8860b" : "var(--text-label)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 10,
          color: "var(--text-code)",
          background: "var(--bg-card)",
          borderRadius: 10,
          padding: "1px 6px",
        }}
      >
        {count}개
      </span>
      {onApplyColor && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPickerOpen(!pickerOpen);
            }}
            className="cursor-pointer shrink-0"
            style={{
              borderRadius: 4,
              border: "0.5px solid var(--border-interactive)",
              background: "var(--btn-bg)",
              color: "var(--text-dim)",
              fontSize: 10,
              padding: "2px 6px",
              whiteSpace: "nowrap",
            }}
          >
            전체 색상
          </button>
          {pickerOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: "100%",
                right: 14,
                zIndex: 20,
                background: "var(--bg-panel)",
                border: "0.5px solid var(--border)",
                borderRadius: 8,
                padding: 8,
                display: "grid",
                gridTemplateColumns: "repeat(9, 1fr)",
                gap: 4,
              }}
            >
              {ACI_PALETTE.map((aci) => (
                <button
                  key={aci}
                  onClick={() => {
                    onApplyColor(aci);
                    setPickerOpen(false);
                  }}
                  className="cursor-pointer"
                  title={`ACI ${aci}`}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    background: aciToHex(aci),
                    border: "0.5px solid rgba(255,255,255,0.15)",
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LayerRow({
  layer,
  selected,
  hidden,
  onToggleVisibility,
  onClick,
  unmapped,
}: {
  layer: LayerInfo;
  selected: boolean;
  hidden?: boolean;
  onToggleVisibility?: () => void;
  onClick: () => void;
  unmapped?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-2 cursor-pointer"
      style={{
        padding: "5px 14px 5px 32px",
        background: selected ? "var(--bg-selected)" : "transparent",
        borderLeft: selected ? "2px solid var(--accent-blue)" : "2px solid transparent",
        opacity: hidden ? 0.4 : 1,
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = "#242830";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "transparent";
      }}
    >
      {onToggleVisibility && (
        <input
          type="checkbox"
          checked={!hidden}
          onChange={onToggleVisibility}
          className="shrink-0 cursor-pointer"
          style={{ width: 11, height: 11, accentColor: "var(--accent-blue)" }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <span
        className="shrink-0 font-mono"
        style={{
          fontSize: 10,
          color: "var(--text-code)",
          width: 70,
        }}
      >
        {layer.original_name.length > 10
          ? layer.original_name.slice(0, 10)
          : layer.original_name}
      </span>
      <span className="flex-1 min-w-0" style={{ fontSize: 12 }}>
        <span
          style={{
            color: unmapped ? "var(--text-muted)" : "var(--text-secondary)",
          }}
        >
          {layer.name}
        </span>
        <span
          className="block truncate"
          style={{ fontSize: 10, color: "var(--text-dim)" }}
        >
          {layer.category_mid}
        </span>
      </span>
      <span
        className="shrink-0"
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          background: aciToHex(layer.current_aci_color),
          border: "0.5px solid rgba(255,255,255,0.1)",
        }}
      />
      <LinetypePreview
        linetype={layer.linetype}
        color={aciToHex(layer.current_aci_color)}
      />
    </div>
  );
}
