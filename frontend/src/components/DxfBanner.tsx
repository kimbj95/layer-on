"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "layeron-dxf-banner-dismissed";

export default function DxfBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "1");
  };

  return (
    <div
      className="flex items-center justify-between shrink-0"
      style={{
        padding: "6px 16px",
        background: "#1e2a3a",
        borderBottom: "0.5px solid var(--border)",
        fontSize: 11,
        color: "var(--text-secondary)",
      }}
    >
      <span>
        <span style={{ color: "var(--accent-blue)", marginRight: 6 }}>i</span>
        현재 DXF 파일만 지원합니다. DWG 파일은 AutoCAD에서 &apos;다른 이름으로
        저장 &gt; DXF&apos;로 변환 후 업로드해주세요.
      </span>
      <button
        onClick={dismiss}
        className="cursor-pointer shrink-0"
        style={{
          background: "none",
          border: "none",
          color: "var(--text-dim)",
          fontSize: 13,
          padding: "0 0 0 12px",
        }}
      >
        ✕
      </button>
    </div>
  );
}
