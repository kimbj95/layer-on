import { useEffect, useRef } from "react";

interface UsageGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export default function UsageGuideModal({ open, onClose }: UsageGuideModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        animation: "guidemodal-fade 150ms ease",
      }}
    >
      <style>{`
        @keyframes guidemodal-fade {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "80vh",
          overflowY: "auto",
          background: "var(--bg-panel)",
          borderRadius: 12,
          padding: 24,
          position: "relative",
          color: "var(--text-primary)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "none",
            border: "none",
            color: "var(--text-dim)",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            padding: 4,
          }}
          aria-label="닫기"
        >
          ✕
        </button>

        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 18 }}>
          LayerOn 사용 가이드
        </h2>

        {/* DXF */}
        <Section icon="📄" title="DXF 파일 업로드" badge="→ DXF 다운로드">
          <Feature ok>레이어 색상 변경 (ACI)</Feature>
          <Feature ok>레이어 설명(Description) 추가</Feature>
          <Feature ok>레이어명 영문 변환 (옵션)</Feature>
          <div
            style={{
              margin: "6px 0",
              padding: "7px 10px",
              background: "var(--bg-card)",
              borderRadius: 5,
              fontSize: 11,
              color: "var(--text-dim)",
              lineHeight: 1.6,
            }}
          >
            <div>레이어코드_대분류_중분류 형식으로 변환</div>
            <div style={{ color: "var(--text-secondary)", fontFamily: "monospace", marginTop: 2 }}>
              A0013111 → A0013111_Traffic_RoadBoundary
            </div>
          </div>
        </Section>

        {/* DWG */}
        <Section icon="📐" title="DWG 파일 업로드">
          <Sub>다운로드 형식을 선택할 수 있습니다:</Sub>

          <FormatBlock label="DWG 다운로드">
            <Feature ok>레이어 색상 변경 (ACI)</Feature>
            <Feature ok>레이어명 영문 변환 (옵션)</Feature>
            <Feature>레이어 설명 (DWG 포맷 제한)</Feature>
            <Sub>데이터 손실 없음</Sub>
          </FormatBlock>

          <FormatBlock label="DXF 다운로드" recommended>
            <Feature ok>레이어 색상 변경 (ACI)</Feature>
            <Feature ok>레이어명 영문 변환 (옵션)</Feature>
            <Feature ok>레이어 설명 추가</Feature>
            <Sub>데이터 손실 없음</Sub>
          </FormatBlock>

          <Tip>DXF로 다운로드하면 모든 기능을 사용할 수 있습니다.</Tip>
        </Section>

        {/* Color */}
        <Section icon="🎨" title="색상 체계">
          <Line>AutoCAD 표준 ACI(AutoCAD Color Index) 색상을 사용합니다.</Line>
          <Line>프린트(CTB) 설정과 호환됩니다.</Line>
        </Section>

        {/* Preview */}
        <Section icon="🔍" title="미리보기" last>
          <Line>우측 패널에서 도면을 미리 확인할 수 있습니다.</Line>
          <Line>색상 변경 시 실시간으로 반영됩니다.</Line>
          <Line>DWG 파일은 미리보기에서 일부 요소가 표시되지 않을 수 있습니다.</Line>
        </Section>
      </div>
    </div>
  );
}

function Section({ icon, title, badge, children, last }: { icon: string; title: string; badge?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : 18 }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>
          {icon} {title}
        </span>
        {badge && (
          <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{badge}</span>
        )}
      </div>
      <div style={{ paddingLeft: 4 }}>{children}</div>
    </div>
  );
}

function Feature({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.7 }}>
      <span style={{ color: ok ? "#4ade80" : "#666", marginRight: 4 }}>
        {ok ? "✅" : "❌"}
      </span>
      {children}
    </div>
  );
}

function FormatBlock({ label, recommended, children }: { label: string; recommended?: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        margin: "8px 0",
        padding: "8px 12px",
        borderLeft: `2px solid ${recommended ? "var(--accent-blue)" : "var(--border)"}`,
        background: "var(--bg-card)",
        borderRadius: "0 6px 6px 0",
      }}
    >
      <div className="flex items-center gap-2" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        {label}
        {recommended && (
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
        )}
      </div>
      {children}
    </div>
  );
}

function Sub({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.7, ...style }}>
      {children}
    </div>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: "6px 10px",
        fontSize: 12,
        color: "var(--accent-blue)",
        background: "rgba(77,159,255,0.08)",
        borderRadius: 6,
      }}
    >
      💡 {children}
    </div>
  );
}
