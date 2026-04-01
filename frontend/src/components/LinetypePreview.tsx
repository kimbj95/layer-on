interface LinetypePreviewProps {
  linetype: string;
  color: string;
}

export default function LinetypePreview({ linetype, color }: LinetypePreviewProps) {
  const w = 30;
  const h = 10;
  const y = h / 2;

  let content: React.ReactNode;

  switch (linetype) {
    case "DASHED":
      content = (
        <line
          x1="0" y1={y} x2={w} y2={y}
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
      );
      break;
    case "CENTER":
      content = (
        <line
          x1="0" y1={y} x2={w} y2={y}
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray="8 2 2 2"
        />
      );
      break;
    default: // Continuous
      content = (
        <line
          x1="0" y1={y} x2={w} y2={y}
          stroke={color}
          strokeWidth="1.5"
        />
      );
  }

  return (
    <svg width={w} height={h} className="shrink-0">
      {content}
    </svg>
  );
}
