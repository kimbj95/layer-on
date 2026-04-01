"use client";

import { useState } from "react";

export default function DxfGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ margin: "0 12px 12px" }}>
      <button
        onClick={() => setOpen(!open)}
        className="cursor-pointer"
        style={{
          fontSize: 11,
          color: "var(--text-dim)",
          background: "none",
          border: "none",
          padding: 0,
          textDecoration: "underline",
          textUnderlineOffset: 2,
        }}
      >
        {open ? "▾" : "▸"} DWG → DXF 변환 방법
      </button>
      {open && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 10px",
            background: "var(--bg-card)",
            borderRadius: 6,
            border: "0.5px solid var(--border)",
            fontSize: 11,
            color: "var(--text-muted)",
            lineHeight: 1.7,
            whiteSpace: "pre-line",
          }}
        >
          {`AutoCAD에서 변환:
1. 파일 → 다른 이름으로 저장
2. 파일 형식에서 'AutoCAD DXF (*.dxf)' 선택
3. 저장 후 해당 .dxf 파일을 업로드

또는 무료 변환기 사용:
• ODA File Converter (무료 데스크톱 앱)
  opendesign.com/guestfiles/oda_file_converter`}
        </div>
      )}
    </div>
  );
}
