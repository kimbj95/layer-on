"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeometryData, LayerInfo, SessionState } from "@/types";
import { applyColors, downloadDxf, getGeometry } from "@/lib/api";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import BottomBar from "@/components/BottomBar";
import SearchBar from "@/components/SearchBar";
import LayerList from "@/components/LayerList";
import MapPreview from "@/components/MapPreview";
import SplitPane from "@/components/SplitPane";
import DxfBanner from "@/components/DxfBanner";

// ── helpers ──────────────────────────────────────

function buildLayerMap(session: SessionState): Map<string, LayerInfo> {
  const map = new Map<string, LayerInfo>();
  for (const cat of session.categories) {
    for (const l of cat.layers) map.set(l.original_name, l);
  }
  for (const l of session.unmapped_layers) map.set(l.original_name, l);
  return map;
}

function applyOverridesToSession(
  session: SessionState,
  overrides: Map<string, string>
): SessionState {
  if (overrides.size === 0) return session;

  const mapLayers = (layers: LayerInfo[]) =>
    layers.map((l) => {
      const color = overrides.get(l.original_name);
      return color ? { ...l, current_color: color } : l;
    });

  return {
    ...session,
    categories: session.categories.map((cat) => ({
      ...cat,
      layers: mapLayers(cat.layers),
    })),
    unmapped_layers: mapLayers(session.unmapped_layers),
  };
}

// ── toast types ──────────────────────────────────

type Toast = {
  message: string;
  type: "error" | "success";
};

// ── component ────────────────────────────────────

export default function Home() {
  const [baseSession, setBaseSession] = useState<SessionState | null>(null);
  const [colorOverrides, setColorOverrides] = useState<Map<string, string>>(
    new Map()
  );
  const [toast, setToast] = useState<Toast | null>(null);
  const [query, setQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set()
  );
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [geometryData, setGeometryData] = useState<GeometryData | null>(null);
  const [geometryLoading, setGeometryLoading] = useState(false);
  const [geometryError, setGeometryError] = useState<string | null>(null);

  const session = useMemo(
    () =>
      baseSession
        ? applyOverridesToSession(baseSession, colorOverrides)
        : null,
    [baseSession, colorOverrides]
  );

  const dirty = colorOverrides.size > 0;

  const layerMap = useMemo(
    () => (session ? buildLayerMap(session) : new Map<string, LayerInfo>()),
    [session]
  );

  const selectedLayerInfo = selectedLayer
    ? layerMap.get(selectedLayer) ?? null
    : null;

  const categoryCounts = useMemo(() => {
    if (!session) return {};
    const counts: Record<string, number> = {};
    for (const group of session.categories) {
      if (group.category_major) {
        counts[group.category_major] = group.count;
      }
    }
    return counts;
  }, [session]);

  const layerColors = useMemo(() => {
    const map = new Map<string, string>();
    if (!session) return map;
    for (const cat of session.categories) {
      for (const l of cat.layers) map.set(l.original_name, l.current_color);
    }
    for (const l of session.unmapped_layers) map.set(l.original_name, l.current_color);
    return map;
  }, [session]);

  // ── toast helper ───────────────────────────────

  const showToast = useCallback((message: string, type: "error" | "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── handlers ─────────────────────────────────

  const handleUploadComplete = useCallback((data: SessionState) => {
    setBaseSession(data);
    setColorOverrides(new Map());
    setToast(null);
    setQuery("");
    setActiveCategories(new Set());
    setSelectedLayer(null);

    // Fetch geometry in background
    setGeometryData(null);
    setGeometryError(null);
    setGeometryLoading(true);
    getGeometry(data.session_id)
      .then(setGeometryData)
      .catch(() => setGeometryError("미리보기를 불러올 수 없습니다"))
      .finally(() => setGeometryLoading(false));
  }, []);

  const handleError = useCallback(
    (message: string) => {
      showToast(message, "error");
    },
    [showToast]
  );

  const handleReset = useCallback(() => {
    setBaseSession(null);
    setColorOverrides(new Map());
    setToast(null);
    setQuery("");
    setActiveCategories(new Set());
    setSelectedLayer(null);
    setGeometryData(null);
    setGeometryError(null);
  }, []);

  const handleToggleCategory = useCallback((cat: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const handleColorChange = useCallback(
    (layerName: string, color: string) => {
      if (!baseSession) return;
      setColorOverrides((prev) => {
        const next = new Map(prev);
        const baseMap = buildLayerMap(baseSession);
        const original = baseMap.get(layerName);
        if (
          original &&
          original.default_color.toLowerCase() === color.toLowerCase()
        ) {
          next.delete(layerName);
        } else {
          next.set(layerName, color);
        }
        return next;
      });
    },
    [baseSession]
  );

  const handleApplyToCategory = useCallback(
    (categoryMajor: string, color: string) => {
      if (!baseSession) return;
      setColorOverrides((prev) => {
        const next = new Map(prev);
        const baseMap = buildLayerMap(baseSession);
        for (const cat of baseSession.categories) {
          if (cat.category_major !== categoryMajor) continue;
          for (const layer of cat.layers) {
            const original = baseMap.get(layer.original_name);
            if (
              original &&
              original.default_color.toLowerCase() === color.toLowerCase()
            ) {
              next.delete(layer.original_name);
            } else {
              next.set(layer.original_name, color);
            }
          }
        }
        return next;
      });
    },
    [baseSession]
  );

  const handleResetToDefault = useCallback((layerName: string) => {
    setColorOverrides((prev) => {
      const next = new Map(prev);
      next.delete(layerName);
      return next;
    });
  }, []);

  const handleResetAll = useCallback(() => {
    if (!window.confirm("모든 레이어를 기본 색상으로 초기화하시겠습니까?")) {
      return;
    }
    setColorOverrides(new Map());
  }, []);

  const handleSave = useCallback(
    async (outputFormat: "dxf" | "dwg" = "dxf") => {
      if (!session || !baseSession) return;
      setSaving(true);
      try {
        const overrides: Record<string, { color: string }> = {};
        for (const [name, color] of colorOverrides) {
          overrides[name] = { color };
        }
        await applyColors(baseSession.session_id, overrides, outputFormat);

        const blob = await downloadDxf(baseSession.session_id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const baseName = baseSession.file_name.replace(/\.(dxf|dwg)$/i, "");
        a.download = `layeron_${baseName}.${outputFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setColorOverrides(new Map());
        setBaseSession(session);
        showToast("다운로드 완료", "success");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "저장 실패";
        if (msg.includes("fetch") || msg.includes("Failed")) {
          showToast("서버 연결에 실패했습니다", "error");
        } else {
          showToast(msg, "error");
        }
      } finally {
        setSaving(false);
      }
    },
    [session, baseSession, colorOverrides, showToast]
  );

  // Cmd/Ctrl+S
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (dirtyRef.current) handleSaveRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── render ───────────────────────────────────

  return (
    <div className="flex flex-col" style={{ height: "100vh", minHeight: 600 }}>
      <DxfBanner />
      <TopBar
        dirty={dirty}
        saving={saving}
        hasSession={!!session}
        onSave={(fmt) => handleSave(fmt)}
        onResetAll={handleResetAll}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          session={session}
          selectedLayerInfo={selectedLayerInfo}
          onUploadComplete={handleUploadComplete}
          onError={handleError}
          onReset={handleReset}
          onColorChange={handleColorChange}
          onApplyToCategory={handleApplyToCategory}
          onResetToDefault={handleResetToDefault}
        />

        <SplitPane
          left={
            <div className="flex flex-col flex-1 overflow-hidden">
              {session ? (
                <>
                  <SearchBar
                    query={query}
                    onQueryChange={setQuery}
                    activeCategories={activeCategories}
                    onToggleCategory={handleToggleCategory}
                    totalCount={session.total_layers}
                    categoryCounts={categoryCounts}
                  />
                  <LayerList
                    session={session}
                    query={query}
                    activeCategories={activeCategories}
                    selectedLayer={selectedLayer}
                    onSelectLayer={setSelectedLayer}
                    onApplyToCategory={handleApplyToCategory}
                  />
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-code)"
                    strokeWidth="1"
                  >
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                  </svg>
                  <p style={{ fontSize: 13, color: "var(--text-dim)" }}>
                    DXF / DWG 파일을 업로드하세요
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-code)" }}>
                    레이어 코드를 자동으로 분류하고 색상을 지정합니다
                  </p>
                </div>
              )}
              <BottomBar session={session} dirty={dirty} />
            </div>
          }
          right={
            <MapPreview
              geometry={geometryData}
              layerColors={layerColors}
              loading={geometryLoading}
              error={geometryError}
            />
          }
        />
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          className="fixed flex items-center gap-2"
          style={{
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: toast.type === "error" ? "#3a1c1c" : "#1c3a1c",
            border: `0.5px solid ${toast.type === "error" ? "#5a2a2a" : "#2a5a2a"}`,
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 12,
            color: toast.type === "error" ? "#ff6b6b" : "#55efc4",
            zIndex: 50,
            maxWidth: "80vw",
          }}
        >
          <span>{toast.type === "error" ? "⚠" : "✓"}</span>
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="cursor-pointer"
            style={{
              background: "none",
              border: "none",
              color: toast.type === "error" ? "#ff6b6b" : "#55efc4",
              fontSize: 14,
              marginLeft: 8,
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
