export const BOARD_COLUMN_COLORS = [
  { label: "Slate", value: "#64748b" },
  { label: "Red", value: "#ef4444" },
  { label: "Orange", value: "#f97316" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Green", value: "#10b981" },
  { label: "Teal", value: "#06b6d4" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Purple", value: "#8b5cf6" },
] as const;

export const DEFAULT_BOARD_COLUMNS = [
  { title: "Todo", colorHex: "#64748b" },
  { title: "In Progress", colorHex: "#3b82f6" },
  { title: "Done", colorHex: "#10b981" },
];
