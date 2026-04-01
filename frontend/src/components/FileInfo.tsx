import type { SessionState } from "@/types";

interface FileInfoProps {
  session: SessionState;
  onReset: () => void;
}

export default function FileInfo({ session, onReset }: FileInfoProps) {
  return (
    <div
      style={{
        margin: "0 12px 12px",
        padding: "8px 10px",
        background: "var(--bg-card)",
        borderRadius: 6,
        border: "0.5px solid var(--border)",
      }}
    >
      <div
        title={session.file_name}
        className="font-medium truncate"
        style={{ fontSize: 11, color: "var(--accent-blue)" }}
      >
        {session.file_name}
      </div>
      <div
        className="flex items-center justify-between"
        style={{ marginTop: 2 }}
      >
        <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
          {session.file_size_mb} MB · 파싱 완료
        </span>
        <button
          onClick={onReset}
          className="cursor-pointer"
          style={{
            fontSize: 10,
            color: "var(--text-dim)",
            background: "none",
            border: "none",
            padding: 0,
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          새 파일
        </button>
      </div>
    </div>
  );
}
