import type { SessionState } from "@/types";

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
