import type { SessionState } from "@/types";

interface BottomBarProps {
  session: SessionState | null;
  dirty: boolean;
}

export default function BottomBar({ session, dirty }: BottomBarProps) {
  if (!session) return null;

  return (
    <div
      className="flex items-center justify-between shrink-0"
      style={{
        padding: "8px 14px",
        background: "var(--bg-panel)",
        borderTop: "0.5px solid var(--border)",
      }}
    >
      <div
        className="flex items-center gap-2"
        style={{ fontSize: 11, color: "var(--text-dim)" }}
      >
        <span>
          {session.total_layers}개 레이어 ·{" "}
          <span style={{ color: "var(--accent-blue)" }}>
            {session.mapped_count}개 매핑됨
          </span>
          {" "}· {session.original_format?.toUpperCase() || "DXF"} · 파싱 완료
        </span>
        {dirty && (
          <span className="flex items-center gap-1">
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#FFD32A",
                display: "inline-block",
              }}
            />
            <span style={{ color: "#FFD32A" }}>변경사항 있음</span>
          </span>
        )}
      </div>
    </div>
  );
}
