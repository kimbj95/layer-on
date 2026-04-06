import { useEffect, useRef } from "react";

interface SecurityModalProps {
  open: boolean;
  onClose: () => void;
}

const sections = [
  {
    icon: "📁",
    title: "파일 보관",
    lines: [
      "업로드된 파일은 처리 완료 후 즉시 삭제됩니다.",
      "별도의 데이터베이스에 파일을 보관하지 않습니다.",
    ],
  },
  {
    icon: "🔐",
    title: "암호화 통신",
    lines: [
      "모든 파일 전송은 HTTPS(TLS)로 암호화됩니다.",
      "전송 중 제3자가 파일을 열람할 수 없습니다.",
    ],
  },
  {
    icon: "⚙️",
    title: "처리 방식",
    lines: [
      "파일은 임시 메모리에서만 처리됩니다.",
      "레이어 색상과 설명만 수정하며, 도면 데이터를 열람하거나 저장하지 않습니다.",
      "브라우저를 닫으면 세션이 종료됩니다.",
    ],
  },
  {
    icon: "🛡️",
    title: "악성코드 위험 없음",
    lines: [
      "LayerOn은 파일을 실행하지 않고 구조만 분석합니다.",
      "설치가 필요 없는 웹 기반 서비스입니다.",
    ],
  },
];

export default function SecurityModal({ open, onClose }: SecurityModalProps) {
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
        animation: "secmodal-fade 150ms ease",
      }}
    >
      <style>{`
        @keyframes secmodal-fade {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--bg-panel)",
          borderRadius: 12,
          padding: 24,
          position: "relative",
          color: "var(--text-primary)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        {/* Close button */}
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

        {/* Title */}
        <h2
          style={{
            fontSize: 17,
            fontWeight: 700,
            marginBottom: 18,
          }}
        >
          LayerOn 보안 안내
        </h2>

        {/* Sections */}
        {sections.map((s, i) => (
          <div key={i} style={{ marginBottom: i < sections.length - 1 ? 16 : 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                marginBottom: 4,
              }}
            >
              {s.icon} {s.title}
            </div>
            {s.lines.map((line, j) => (
              <div
                key={j}
                style={{
                  fontSize: 12.5,
                  color: "var(--text-dim)",
                  lineHeight: 1.6,
                }}
              >
                {line}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
