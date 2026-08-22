export const CATEGORY_PALETTE = [
  { label: "Slate", value: "#64748b" },
  { label: "Red", value: "#ef4444" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Emerald", value: "#10b981" },
  { label: "Cyan", value: "#06b6d4" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Purple", value: "#8b5cf6" },
  { label: "Rose", value: "#f43f5e" },
];

/**
 * Derives a consistent category badge color.
 */
export function getCategoryColor(categoryName: string, overrideColor?: string): string {
  if (overrideColor) return overrideColor;
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = (hash << 5) - hash + categoryName.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % CATEGORY_PALETTE.length;
  return CATEGORY_PALETTE[index]?.value || "#64748b";
}

/**
 * Extracts a normalized array of categories from a memo kanban payload.
 */
export function getCardCategories(kanban?: { category?: string; categories?: string[] }): string[] {
  if (!kanban) return [];
  const list = new Set<string>();
  if (kanban.category?.trim()) {
    list.add(kanban.category.trim());
  }
  if (Array.isArray(kanban.categories)) {
    for (const c of kanban.categories) {
      if (c?.trim()) list.add(c.trim());
    }
  }
  return Array.from(list);
}

/**
 * Extracts a clean title and description snippet from raw memo markdown.
 */
export function parseCardContent(content: string): { title: string; description: string } {
  const lines = content.split("\n").map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);

  if (nonEmpty.length === 0) {
    return { title: "Untitled", description: "" };
  }

  // Clean markdown prefixes from title
  const rawTitle = nonEmpty[0] ?? "";
  const title =
    rawTitle
      .replace(/^#{1,6}\s+/, "")
      .replace(/^[-*+]\s+/, "")
      .replace(/^\d+\.\s+/, "")
      .trim() || "Untitled";

  // Description is the rest of the lines
  const descriptionLines: string[] = [];
  let pastFirst = false;
  for (const line of lines) {
    if (!pastFirst) {
      if (line === rawTitle) {
        pastFirst = true;
      }
      continue;
    }
    if (line) {
      // Strip some markdown syntax for snippet clarity
      const cleanLine = line
        .replace(/^#{1,6}\s+/, "")
        .replace(/^[-*+]\s+/, "")
        .trim();
      if (cleanLine) {
        descriptionLines.push(cleanLine);
      }
    }
  }

  return {
    title,
    description: descriptionLines.slice(0, 3).join(" "),
  };
}

export interface DeadlineProgress {
  progress: number;
  isOverdue: boolean;
  formattedDue: string;
  remainingText: string;
  colorClass: string;
}

/**
 * Computes time elapsed progress percentage towards due date.
 */
export function computeDeadlineProgress(createTimeSeconds?: number, dueTimeSeconds?: number): DeadlineProgress | null {
  if (!dueTimeSeconds || Number.isNaN(dueTimeSeconds)) return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const isOverdue = nowSeconds >= dueTimeSeconds;
  const dueDate = new Date(dueTimeSeconds * 1000);
  const formattedDue = dueDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const diffSeconds = dueTimeSeconds - nowSeconds;
  let remainingText = "";
  if (isOverdue) {
    const overdueSeconds = Math.abs(diffSeconds);
    if (overdueSeconds < 3600) {
      remainingText = "Overdue (<1h)";
    } else if (overdueSeconds < 86400) {
      remainingText = `Overdue (${Math.floor(overdueSeconds / 3600)}h)`;
    } else {
      const days = Math.floor(overdueSeconds / 86400);
      remainingText = `Overdue (${days}d)`;
    }

    return {
      progress: 100,
      isOverdue: true,
      formattedDue,
      remainingText,
      colorClass: "bg-destructive",
    };
  }

  if (diffSeconds < 3600) {
    const mins = Math.max(1, Math.floor(diffSeconds / 60));
    remainingText = `${mins}m left`;
  } else if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600);
    remainingText = `${hours}h left`;
  } else {
    const days = Math.floor(diffSeconds / 86400);
    remainingText = `${days}d left`;
  }

  // Active in-progress task baseline start time
  let start = createTimeSeconds ? Math.min(createTimeSeconds, nowSeconds) : nowSeconds - 86400;
  if (start >= dueTimeSeconds) {
    start = dueTimeSeconds - 86400;
  }

  const total = Math.max(1, dueTimeSeconds - start);
  const elapsed = Math.max(0, nowSeconds - start);
  const progress = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));

  let colorClass = "bg-primary";
  if (progress >= 85) {
    colorClass = "bg-destructive";
  } else if (progress >= 60) {
    colorClass = "bg-amber-500";
  }

  return {
    progress,
    isOverdue: false,
    formattedDue,
    remainingText,
    colorClass,
  };
}

export interface TaskListItem {
  index: number;
  checked: boolean;
  text: string;
  line: string;
}

export interface TaskListSummary {
  items: TaskListItem[];
  total: number;
  completed: number;
  percent: number;
}

const TASK_LIST_REGEX = /^(\s*[-*+]\s+\[)([ xX])(\]\s+)(.*)$/;

/**
 * Extracts all task list checklist items (`- [ ]` / `- [x]`) from markdown content.
 */
export function parseTaskLists(content: string): TaskListSummary {
  if (!content) {
    return { items: [], total: 0, completed: 0, percent: 0 };
  }

  const lines = content.split("\n");
  const items: TaskListItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(TASK_LIST_REGEX);
    if (match) {
      const checked = match[2].toLowerCase() === "x";
      const text = match[4].trim();
      items.push({
        index: items.length,
        checked,
        text,
        line,
      });
    }
  }

  const total = items.length;
  const completed = items.filter((item) => item.checked).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    items,
    total,
    completed,
    percent,
  };
}

/**
 * Toggles a specific task list item checkbox in markdown content by its index.
 */
export function toggleTaskListItem(content: string, itemIndex: number, newChecked: boolean): string {
  const lines = content.split("\n");
  let currentTaskIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(TASK_LIST_REGEX);
    if (match) {
      if (currentTaskIdx === itemIndex) {
        const replacement = `${match[1]}${newChecked ? "x" : " "}${match[3]}${match[4]}`;
        lines[i] = replacement;
        break;
      }
      currentTaskIdx++;
    }
  }

  return lines.join("\n");
}
