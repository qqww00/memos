# Design: Kanban Card Categories, Compact View, Due Dates, and Card Completion

## Context

Memos allows memos to belong to a Kanban board column with a fractional position stored in `memo.payload.kanban`. To provide a modern task/project management experience, we are extending the Kanban payload and redesigning the board card presentation to be compact and functional.

## Goals / Non-Goals

**Goals:**
- Extend `Kanban` and `KanbanPayload` in Protobuf with `category`, `category_color_hex`, `due_time`, and `is_closed`.
- Redesign `KanbanCard` to display title, 2-line description clamp, category badge, due date badge, time-based progress bar, and close/reopen toggle.
- Allow setting category, color palette, and due date in `InlineCardCreator`, `AddMemoToBoardDialog`, and `MemoDetailDialog`.
- Support instant optimistic updates when closing or modifying card properties.

**Non-Goals:**
- Replacing global memos list behavior (these fields are board-specific).
- Complex multi-board memberships per memo.

## Decisions

### 1. Protobuf Fields Extension
Extend `proto/api/v1/memo_service.proto` and `proto/store/memo.proto`:
```protobuf
message Kanban {
  string board_id = 1;
  string column_id = 2;
  double position = 3;
  optional string category = 4;
  optional string category_color_hex = 5;
  optional google.protobuf.Timestamp due_time = 6;
  optional bool is_closed = 7;
}
```
*Rationale:* Storing these within `memo.payload.kanban` preserves zero-migration SQLite/MySQL/Postgres compatibility.

### 2. Compact Card Parsing
Extract title from the first non-empty line of `memo.content` (stripping leading `#`, `*`, `-`).
Extract the subsequent lines as a description snippet clamped to 2 lines.

### 3. Due Date Progress Calculation
$$\text{Progress} = \min(100, \max(0, \frac{\text{now} - \text{createTime}}{\text{dueTime} - \text{createTime}} \times 100))$$
- Bar color:
  - `< 70%`: Primary blue / emerald
  - `70% - 99%`: Warning amber
  - `100%` / Overdue: Destructive red
  - Completed / Closed: Muted gray or green check

### 4. Close Card Action
Add a checkmark / close button on the card and in the card menu. When clicked, sets `is_closed: !memo.kanban.is_closed` via `useUpdateMemoKanban`.

## Risks / Trade-offs

- [Risk] Proto changes require regeneration across backend and web frontend.
  → Mitigation: Run `cd proto && buf generate` and update proto converters in `server/router/api/v1/memo_service.go`.
