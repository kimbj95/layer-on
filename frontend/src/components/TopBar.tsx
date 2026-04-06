"use client";

interface TopBarProps {
  dirty: boolean;
  saving: boolean;
  hasSession: boolean;
  originalFormat: "dxf" | "dwg" | undefined;
  onSave: () => void;
  onResetAll: () => void;
}

export default function TopBar({
  dirty,
  saving,
  hasSession,
  originalFormat,
  onSave,
  onResetAll,
}: TopBarProps) {
  const saveEnabled = hasSession && !saving;
  const formatLabel = originalFormat?.toUpperCase() ?? "";

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
        <button
          disabled={!saveEnabled}
          onClick={onSave}
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
          {saving
            ? "적용 중..."
            : hasSession
              ? `${formatLabel} 저장`
              : "저장"}
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
    </div>
  );
}
