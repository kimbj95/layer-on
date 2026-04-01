"use client";

import { useCallback, useRef, useState } from "react";
import { uploadDxf } from "@/lib/api";
import type { SessionState } from "@/types";

interface UploadZoneProps {
  onUploadComplete: (data: SessionState) => void;
  onError: (message: string) => void;
}

export default function UploadZone({
  onUploadComplete,
  onError,
}: UploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setInlineError(null);

      if (!file.name.toLowerCase().endsWith(".dxf")) {
        setInlineError("DXF 파일만 지원합니다");
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        setInlineError("50MB 이하 파일만 지원합니다");
        return;
      }

      setUploading(true);
      try {
        const data = await uploadDxf(file);
        onUploadComplete(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "업로드 실패";
        if (message.includes("fetch") || message.includes("Failed")) {
          onError("서버 연결에 실패했습니다");
        } else if (message.includes("시간")) {
          onError("파일 처리 시간이 초과되었습니다");
        } else {
          onError(message);
        }
      } finally {
        setUploading(false);
      }
    },
    [onUploadComplete, onError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  return (
    <div>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className="cursor-pointer transition-colors"
        style={{
          margin: 12,
          marginBottom: inlineError ? 4 : 12,
          border: `1px dashed ${dragOver ? "var(--accent-blue)" : "var(--border-interactive)"}`,
          borderRadius: 8,
          padding: "20px 12px",
          textAlign: "center",
          background: dragOver ? "var(--bg-card)" : "var(--bg-app)",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".dxf"
          onChange={handleChange}
          className="hidden"
        />
        {uploading ? (
          <>
            <div
              className="flex items-center justify-center mx-auto"
              style={{
                width: 28,
                height: 28,
                marginBottom: 8,
                background: "var(--bg-card)",
                borderRadius: 6,
              }}
            >
              <svg
                className="animate-spin"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent-blue)"
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              <strong
                className="block font-medium"
                style={{ fontSize: 11, color: "var(--text-label)" }}
              >
                파싱 중...
              </strong>
              잠시만 기다려주세요
            </div>
          </>
        ) : (
          <>
            <div
              className="flex items-center justify-center mx-auto"
              style={{
                width: 28,
                height: 28,
                marginBottom: 8,
                background: "var(--bg-card)",
                borderRadius: 6,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent-blue)"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                lineHeight: 1.5,
              }}
            >
              <strong
                className="block font-medium"
                style={{ fontSize: 11, color: "var(--text-label)" }}
              >
                DXF 파일 업로드
              </strong>
              클릭 또는 드래그
            </div>
          </>
        )}
      </div>

      {inlineError && (
        <div
          style={{
            margin: "0 12px 8px",
            fontSize: 11,
            color: "#ff6b6b",
            padding: "4px 8px",
            background: "#2a1a1a",
            borderRadius: 4,
            border: "0.5px solid #3a2020",
          }}
        >
          {inlineError}
        </div>
      )}
    </div>
  );
}
