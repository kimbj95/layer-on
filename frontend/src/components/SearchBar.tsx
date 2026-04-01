"use client";

import { CATEGORY_META } from "@/lib/constants";

interface SearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  activeCategories: Set<string>;
  onToggleCategory: (cat: string) => void;
  totalCount: number;
  categoryCounts: Record<string, number>;
}

export default function SearchBar({
  query,
  onQueryChange,
  activeCategories,
  onToggleCategory,
  totalCount,
  categoryCounts,
}: SearchBarProps) {
  return (
    <div
      className="shrink-0"
      style={{
        background: "var(--bg-panel)",
        borderBottom: "0.5px solid var(--border)",
      }}
    >
      {/* Search row */}
      <div
        className="flex items-center gap-2"
        style={{ padding: "8px 14px" }}
      >
        <div
          className="flex items-center flex-1 gap-2"
          style={{
            background: "var(--bg-card)",
            border: "0.5px solid var(--border)",
            borderRadius: 6,
            padding: "5px 10px",
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-dim)"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="레이어 코드 또는 이름 검색..."
            className="flex-1 outline-none"
            style={{
              background: "transparent",
              border: "none",
              fontSize: 12,
              color: "var(--text-label)",
            }}
          />
          {query && (
            <button
              onClick={() => onQueryChange("")}
              className="cursor-pointer"
              style={{
                background: "none",
                border: "none",
                color: "var(--text-dim)",
                fontSize: 12,
                padding: 0,
              }}
            >
              ✕
            </button>
          )}
        </div>
        <span
          className="shrink-0"
          style={{
            fontSize: 11,
            color: "var(--text-dim)",
            whiteSpace: "nowrap",
          }}
        >
          {totalCount}개 레이어
        </span>
      </div>

      {/* Category chips */}
      <div
        className="flex flex-wrap gap-1.5"
        style={{ padding: "0 14px 8px" }}
      >
        {CATEGORY_META.map((cat) => {
          const active =
            activeCategories.size === 0 || activeCategories.has(cat.letter);
          const count = categoryCounts[cat.letter] ?? 0;
          return (
            <button
              key={cat.letter}
              onClick={() => onToggleCategory(cat.letter)}
              className="flex items-center gap-1 cursor-pointer transition-opacity"
              style={{
                padding: "3px 8px",
                borderRadius: 5,
                border: `0.5px solid ${active ? "var(--border-interactive)" : "var(--border)"}`,
                background: active ? "var(--bg-card)" : "transparent",
                opacity: active ? 1 : 0.4,
                fontSize: 11,
                color: "var(--text-secondary)",
              }}
            >
              <span
                className="shrink-0"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: cat.color,
                }}
              />
              <span>
                {cat.letter} {cat.name}
              </span>
              {count > 0 && (
                <span style={{ color: "var(--text-dim)", fontSize: 10 }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
