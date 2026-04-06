"use client";

import { useCallback, useRef, useState } from "react";
import { uploadDxfStream } from "@/lib/api";
import type { UploadProgress } from "@/lib/api";
import type { SessionState } from "@/types";

interface UploadZoneProps {
  onUploadComplete: (data: SessionState) => void;
  onError: (message: string) => void;
}

const STEPS = [
  { key: "uploading", label: "파일 업로드" },
  { key: "parsing", label: "레이어 분석" },
  { key: "mapping", label: "표준코드 매핑" },
  { key: "finalizing", label: "마무리" },
] as const;

function getTimeEstimate(sizeBytes: number): string {
  const mb = sizeBytes / (1024 * 1024);
  if (mb < 5) return "예상 소요시간: ~5초";
  if (mb < 15) return "예상 소요시간: ~15초";
  if (mb < 30) return "예상 소요시간: ~30초";
  if (mb < 50) return "예상 소요시간: ~1분";
  return "예상 소요시간: ~2분";
}

export default function UploadZone({
  onUploadComplete,
  onError,
}: UploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [complete, setComplete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileSizeRef = useRef<number>(0);

  const handleFile = useCallback(
    async (file: File) => {
      setInlineError(null);

      const name = file.name.toLowerCase();
      if (!name.endsWith(".dxf") && !name.endsWith(".dwg")) {
        setInlineError("DXF 또는 DWG 파일만 지원합니다");
        return;
      }

      if (file.size > 200 * 1024 * 1024) {
        setInlineError("200MB 이하 파일만 지원합니다");
        return;
      }

      fileSizeRef.current = file.size;
      setUploading(true);
      setProgress(null);
      setComplete(false);

      try {
        await uploadDxfStream(
          file,
          (p) => setProgress(p),
          (data) => {
            setProgress({ step: "finalizing", message: "완료", percent: 100 });
            setComplete(true);
            setTimeout(() => {
              onUploadComplete(data);
              setUploading(false);
              setProgress(null);
              setComplete(false);
            }, 1000);
          },
          (message) => {
            onError(message);
            setUploading(false);
            setProgress(null);
          },
        );
      } catch {
        onError("업로드 실패");
        setUploading(false);
        setProgress(null);
      }
    },
    [onUploadComplete, onError],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile],
  );

  const currentStepIndex = progress
    ? STEPS.findIndex((s) => s.key === progress.step)
    : -1;

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
        className={uploading ? "" : "cursor-pointer transition-colors"}
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
          accept=".dxf,.dwg"
          onChange={handleChange}
          className="hidden"
        />
        {uploading ? (
          <div style={{ padding: "4px 0" }}>
            {/* Progress bar */}
            <div
              style={{
                height: 3,
                background: "var(--border)",
                borderRadius: 2,
                margin: "0 0 14px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress?.percent ?? 0}%`,
                  background: complete ? "#4ade80" : "var(--accent-blue)",
                  borderRadius: 2,
                  transition: "width 0.3s ease, background 0.3s ease",
                }}
              />
            </div>

            {/* Step list */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 5,
                alignItems: "flex-start",
                margin: "0 auto",
                width: "fit-content",
              }}
            >
              {STEPS.map((step, idx) => {
                const isCompleted = currentStepIndex > idx || complete;
                const isCurrent = currentStepIndex === idx && !complete;
                const isPending = currentStepIndex < idx;

                if (isPending) return null;

                return (
                  <div
                    key={step.key}
                    className="flex items-center gap-2"
                    style={{ fontSize: 11 }}
                  >
                    {isCompleted ? (
                      <span style={{ color: "var(--text-dim)", fontSize: 10, width: 12, textAlign: "center" }}>
                        ✓
                      </span>
                    ) : isCurrent ? (
                      <svg
                        className="animate-spin"
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--accent-blue)"
                        strokeWidth="2.5"
                        style={{ width: 12, flexShrink: 0 }}
                      >
                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                      </svg>
                    ) : null}
                    <span
                      style={{
                        color: isCompleted
                          ? "var(--text-dim)"
                          : "var(--text-label)",
                      }}
                    >
                      {complete && idx === STEPS.length - 1
                        ? "완료"
                        : step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Time estimate */}
            {!complete && (
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-dim)",
                  marginTop: 10,
                }}
              >
                {getTimeEstimate(fileSizeRef.current)}
              </div>
            )}
          </div>
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
                DXF / DWG 파일 업로드
              </strong>
              클릭 또는 드래그 (최대 200MB)
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
