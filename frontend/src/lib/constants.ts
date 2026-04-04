export const CATEGORY_META = [
  { letter: "A", name: "교통", color: "#FF6B6B" },
  { letter: "B", name: "건물", color: "#FFD32A" },
  { letter: "C", name: "시설", color: "#00CEC9" },
  { letter: "D", name: "식생", color: "#55EFC4" },
  { letter: "E", name: "수계", color: "#4D9FFF" },
  { letter: "F", name: "지형", color: "#E17055" },
  { letter: "G", name: "경계", color: "#B2BEC3" },
  { letter: "H", name: "주기", color: "#636E72" },
] as const;

export const CATEGORY_COLOR_MAP: Record<string, string> = Object.fromEntries(
  CATEGORY_META.map((c) => [c.letter, c.color])
);

export const COLOR_PRESETS = [
  "#FF6B6B", "#FF9F9F", "#FD79A8",
  "#E17055", "#FF9F43", "#FFD32A",
  "#55EFC4", "#00CEC9", "#4D9FFF",
  "#A29BFE", "#6C5CE7",
  "#B2BEC3", "#636E72", "#000000", "#FFFFFF",
];
