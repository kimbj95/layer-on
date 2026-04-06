export default function DxfGuide() {
  return (
    <div style={{ margin: "0 12px 12px", fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6 }}>
      <div>DWG, DXF 모두 지원</div>
      <div style={{ color: "var(--text-code)", marginTop: 2 }}>
        DXF: <span style={{ color: "var(--text-label)" }}>색상</span> + <span style={{ color: "var(--text-label)" }}>레이어 설명</span> 변경
      </div>
      <div style={{ color: "var(--text-code)" }}>
        DWG: <span style={{ color: "var(--text-label)" }}>색상</span> 변경만 지원
      </div>
    </div>
  );
}
