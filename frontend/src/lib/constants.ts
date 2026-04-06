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
// Row 1: standard 9 colors (ACI 1-9)
// Row 2: useful distinct colors from extended ACI palette
export const ACI_PALETTE = [
  1, 2, 3, 4, 5, 6, 7, 8, 9,
  14, 22, 30, 42, 62, 94, 134, 174, 210, 250,
];

// AutoCAD standard ACI color table (accurate values)
// Reference: https://gohtx.com/acadcolors.php
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
  10: "#FF0000",  // Red (same as 1)
  14: "#FF7F7F",  // Light red / salmon
  20: "#FF3F00",  // Red-orange
  22: "#FF7F00",  // Orange
  30: "#FF7F00",  // Orange
  32: "#FFBF00",  // Amber
  40: "#FFFF00",  // Yellow (same as 2)
  42: "#BFFF00",  // Yellow-green
  50: "#00FF00",  // Green (same as 3)
  62: "#00FF7F",  // Spring green
  80: "#00FFBF",  // Turquoise
  90: "#00FFFF",  // Cyan (same as 4)
  94: "#007FFF",  // Azure
  130: "#0000FF", // Blue (same as 5)
  134: "#3F00FF", // Indigo
  150: "#7F00FF", // Violet
  170: "#BF00FF", // Purple
  174: "#FF00BF", // Hot pink
  200: "#FF007F", // Rose
  210: "#FF0040", // Crimson
  250: "#333333", // Near black
};

export function aciToHex(aci: number): string {
  return ACI_TO_HEX[aci] || "#FFFFFF";
}
