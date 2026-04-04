import type { GeometryData, SessionState } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function uploadDxf(file: File): Promise<SessionState> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "업로드 실패" }));
    throw new Error(err.detail || `Upload failed (${res.status})`);
  }
  return res.json();
}

export interface UploadProgress {
  step: "uploading" | "converting" | "parsing" | "mapping" | "finalizing";
  message: string;
  percent: number;
}

export async function uploadDxfStream(
  file: File,
  onProgress: (p: UploadProgress) => void,
  onComplete: (state: SessionState) => void,
  onError: (msg: string) => void,
): Promise<void> {
  const form = new FormData();
  form.append("file", file);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/upload-stream`, {
      method: "POST",
      body: form,
    });
  } catch {
    onError("서버 연결에 실패했습니다");
    return;
  }

  if (!res.body) {
    onError("서버 응답을 읽을 수 없습니다");
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const lines = part.trim().split("\n");
      let eventType = "";
      let data = "";

      for (const line of lines) {
        if (line.startsWith("event: ")) eventType = line.slice(7);
        else if (line.startsWith("data: ")) data = line.slice(6);
      }

      if (!eventType || !data) continue;

      try {
        const parsed = JSON.parse(data);
        if (eventType === "progress") onProgress(parsed as UploadProgress);
        else if (eventType === "complete") onComplete(parsed as SessionState);
        else if (eventType === "error") onError(parsed.message || "업로드 실패");
      } catch {
        onError("서버 응답 파싱 실패");
      }
    }
  }
}

export async function getGeometry(
  sessionId: string,
): Promise<GeometryData> {
  const res = await fetch(`${API_BASE}/api/session/${sessionId}/geometry`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "지오메트리 조회 실패" }));
    throw new Error(err.detail);
  }
  return res.json();
}

export async function getSession(sessionId: string): Promise<SessionState> {
  const res = await fetch(`${API_BASE}/api/session/${sessionId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "세션 조회 실패" }));
    throw new Error(err.detail);
  }
  return res.json();
}

export async function applyColors(
  sessionId: string,
  layerOverrides: Record<string, { color: string }>,
  outputFormat: "dxf" | "dwg" = "dxf"
): Promise<{ status: string; output_filename: string }> {
  const res = await fetch(`${API_BASE}/api/session/${sessionId}/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      layer_overrides: layerOverrides,
      output_format: outputFormat,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "적용 실패" }));
    throw new Error(err.detail);
  }
  return res.json();
}

export async function downloadDxf(sessionId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/session/${sessionId}/download`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "다운로드 실패" }));
    throw new Error(err.detail);
  }
  return res.blob();
}
