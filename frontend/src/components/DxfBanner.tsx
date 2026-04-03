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
        DWG, DXF 파일 모두 지원됩니다. DWG 파일은 자동 변환 후 처리됩니다.
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
