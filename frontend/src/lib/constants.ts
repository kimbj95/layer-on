export const CATEGORY_META = [
  { letter: "A", name: "교통", aci: 1 },
  { letter: "B", name: "건물", aci: 2 },
  { letter: "C", name: "시설", aci: 4 },
  { letter: "D", name: "식생", aci: 3 },
  { letter: "E", name: "수계", aci: 5 },
  { letter: "F", name: "지형", aci: 30 },
  { letter: "G", name: "경계", aci: 8 },
  { letter: "H", name: "주기", aci: 9 },
] as const;

export const CATEGORY_ACI_MAP: Record<string, number> = Object.fromEntries(
  CATEGORY_META.map((c) => [c.letter, c.aci]),
);

// ACI color palette for the color editor
// Row 1: standard 9 colors
// Row 2: extended palette
export const ACI_PALETTE = [
  1, 2, 3, 4, 5, 6, 7, 8, 9,
  10, 20, 30, 40, 50, 150, 170, 200, 210, 250,
];

// ACI index → hex color for display rendering
export const ACI_TO_HEX: Record<number, string> = {
  1: "#FF0000",   // Red
  2: "#FFFF00",   // Yellow
  3: "#00FF00",   // Green
  4: "#00FFFF",   // Cyan
  5: "#0000FF",   // Blue
  6: "#FF00FF",   // Magenta
  7: "#FFFFFF",   // White
  8: "#808080",   // Gray
  9: "#C0C0C0",   // Light gray
  10: "#FF0000",  // Red
  20: "#FFCC00",  // Dark yellow
  30: "#FF7F00",  // Orange
  32: "#FF9F43",  // Light orange
  40: "#BFFF00",  // Yellow-green
  50: "#00FF00",  // Green
  80: "#00FF80",  // Spring green
  90: "#00FFBF",  // Aquamarine
  140: "#00BFFF", // Deep sky blue
  150: "#007FFF", // Azure
  170: "#0000FF", // Blue
  200: "#7F00FF", // Violet
  210: "#BF00FF", // Purple
  220: "#FF00FF", // Magenta
  250: "#333333", // Near black
};

export function aciToHex(aci: number): string {
  return ACI_TO_HEX[aci] || "#FFFFFF";
}
