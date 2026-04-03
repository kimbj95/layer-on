export default function DxfGuide() {
  return (
    <div style={{ margin: "0 12px 12px", fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6 }}>
      <div>DWG, DXF 모두 지원</div>
      <div style={{ color: "var(--text-code)", marginTop: 2 }}>
        DXF: 레이어 색상 + 분류명 description 적용
      </div>
      <div style={{ color: "var(--text-code)" }}>
        DWG: 레이어 색상 변경만 지원 (description 미지원)
      </div>
    </div>
  );
}
