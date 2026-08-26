## Context

Memos includes a full-featured Kanban board system (`/boards` and `/boards/:boardId`), supporting custom columns, drag & drop, categories, milestones, task checklist progress, and deadline tracking. Based on user feedback and explore analysis, five UX improvements have been identified:
1. Card due date display includes hour/minute strings which clutters the badge; it should only display the date, but keep the underlying timestamp accurate for real-time progress calculations.
2. The card detail dialog's "Board categories (click to toggle)" uses a flat list of pills; it should be replaced with a multi-select dropdown featuring a color indicator on the right of each option.
3. The authenticated root landing (`/`) should navigate directly to Boards.
4. The card detail dialog's "Board milestones" uses a flat list of pills; it should be replaced with a single-select dropdown with milestone color indicators on the right.
5. Card category badge colors are inconsistent between card views and modal detail views due to `overrideColor` leaking across all categories on a card.

## Goals / Non-Goals

**Goals:**
- Date-only label formatting for card due dates (e.g. "Aug 26" or "Aug 26, 2027") while preserving second-precision deadline progress bar calculations.
- Clean dropdowns for Board Categories and Board Milestones with right-aligned color indicators in `MemoDetailDialog`.
- Route `/` renders `<Boards />` for authenticated users.
- Unified category color resolution mechanism across all cards, dialogs, filters, and roadmaps.

**Non-Goals:**
- Changing the underlying protobuf message schema or database migrations (existing `due_time`, `category`, `categories`, `category_color_hex`, `milestone` fields are fully sufficient).
- Removing the time dimension from stored timestamps (time stays stored to preserve progress countdown calculations).

## Decisions

### Decision 1: Due Date Label vs Calculation
- **Choice**: In `cardUtils.ts`, update `formattedDue` in `computeDeadlineProgress` to omit `hour` and `minute`, using `{ month: "short", day: "numeric", year: (if different year) }`.
- **Detail Dialog Picker**: Provide a date input (`type="date"`) or preserve time under the hood (setting to 23:59:59 end-of-day by default on date change if none set).
- **Rationale**: Keeps card UI clean while retaining exact percentage and remaining time countdown (`"3h left"`, `"Overdue (1d)"`).

### Decision 2: Dropdown Selectors for Categories and Milestones
- **Choice**: Replace horizontal wrapped buttons in `MemoDetailDialog.tsx` with Radix UI `DropdownMenu` components.
  - Categories dropdown: Multi-select with checkmarks on the left and color dot badge (`style={{ backgroundColor: color }}`) on the right.
  - Milestones dropdown: Single-select with checkmark on active item, "Clear / None" option, and right-aligned milestone color dot badge.
- **Rationale**: Eliminates vertical clutter when many categories/milestones exist and makes color associations immediately clear.

### Decision 3: Authenticated Landing at `/`
- **Choice**: Update `LandingRoute` in `router/index.tsx` so authenticated users visiting `/` render `<Boards />` within the standard layout. Keep timeline feed accessible via the sidebar navigation.
- **Rationale**: Elevates boards as the central productivity dashboard.

### Decision 4: Unified Category Color Resolution
- **Choice**: 
  - Fix `KanbanCard.tsx` so that `memo.kanban.categoryColorHex` is only applied to the primary category (`cat === memo.kanban.category`), while other categories use `getCategoryColor(cat)`.
  - Update `MemoDetailDialog.tsx` and other consumers to use a consistent resolver `getCategoryColor(cat, memo.kanban?.category === cat ? memo.kanban?.categoryColorHex : undefined)`.
- **Rationale**: Ensures identical badge colors between cards in columns, filter dropdowns, and card detail dialogs.

## Risks / Trade-offs

- **[Risk] Existing users expecting timeline on `/`** → Mitigation: Timeline remains fully accessible in the sidebar navigation and via `/` scope switch.
- **[Risk] Overdue cards near midnight** → Mitigation: Setting date picker to default to 23:59:59 avoids false overdue alerts earlier in the day.
