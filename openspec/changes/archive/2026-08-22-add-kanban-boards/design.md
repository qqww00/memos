# Design: add-kanban-boards

## Context

Memos stores memos with a JSON `payload` column (`memo.payload`) and arbitrary per-user settings in `user_setting (user_id, key, value)`. Both are text columns controlled by code, not DDL — the two available "escape hatches" for persistence without migration. The repo already has strong precedents for everything this feature needs:

- **Per-user entity CRUD in a user setting**: `MemoViewService` manages `{id, title, filter}` views under the `MEMO_VIEWS` key (`store/user_setting.go:449-586`, mutex-guarded read-modify-write, protojson round-trip).
- **Client-writable payload field via field mask**: `UpdateMemo` path `"location"` merges into `memo.payload` without a content rebuild (`server/router/api/v1/memo_service.go:527-532`).
- **CEL filtering over payload JSON paths**: `internal/filter/` compiles CEL to dialect-aware SQL (e.g. `property.has_task_list` → `JSON_EXTRACT(memo.payload, '$.property.hasTaskList')`).
- **Payload rebuild safety**: `memopayload.RebuildMemoPayload` only overwrites `Tags` and `Property` in place (`server/runner/memopayload/runner.go:85-86`), so additional payload fields survive content edits.

Constraints: zero DB migrations, no breaking API/proto changes, additive-only edits to existing files where required, new frontend dependency must be minimal.

## Goals / Non-Goals

**Goals:**

- Multiple boards per user (GitHub-Projects mental model), each with user-defined ordered columns.
- Card = whole memo; drag changes the memo's kanban state (column + order), never its content.
- Server-side queryable board/column via the standard `ListMemos` CEL filter.
- Fluid drag-and-drop on a dedicated `/boards` page using `@dnd-kit`.
- Zero schema migrations; boards in `user_setting`, card state in `memo.payload`.

**Non-Goals:**

- Task-list-item (checkbox) cards — a memo is a card, period.
- Shared/collaborative boards across users (board ownership is single-user; visibility of cards still follows memo visibility rules).
- Swimlanes, WIP limits, board templates, automation.
- Backfill/migration of any existing data.

## Decisions

### D1. Board definitions live in a new `UserSetting` key `BOARDS`

`proto/store/user_setting.proto` gains enum `BOARDS = 9`, message `BoardsUserSetting { repeated Board boards = 1 }` with `Board { string id; string title; repeated BoardColumn columns; google.protobuf.Timestamp created_at; updated_at }`, `BoardColumn { string id; string title; string color_hex }`. Column order in the repeated field is board column order.

- *Why*: exact precedent of `MEMO_VIEWS`/`WEBHOOKS`; free uniqueness per user, no DDL, cache + mutex pattern reusable.
- *Alternative rejected*: separate table — requires migrations, violating the core constraint.
- Store helpers (`GetUserBoards`, `UpsertUserBoard`, `RemoveUserBoard`, column ops) follow the `memoViewMu` pattern: one `boardsMu` guarding read-modify-write of the whole blob.

### D2. Card state is `MemoPayload.kanban` (field 4, additive)

```proto
message KanbanPayload {
  string board_id = 1;
  string column_id = 2;
  double position = 3;  // fractional ordering within the column
}
```

- *Why*: queryable server-side via JSON-path SQL (D4); survives payload rebuilds; follows the `location` field-mask precedent for writes.
- *Alternative rejected*: ordering/membership in the board blob (user_setting) — not server-side queryable, racy single-blob writes, dangling memo ids.
- A memo is on at most one board at a time (single `kanban` field). Moving to a different board re-points `board_id`; removing from board clears `kanban` (proto3 presence makes this representable via optional message semantics — use `optional KanbanPayload kanban = 4`).

### D3. Ordering uses fractional `double` positions

Insert between neighbors → `position = (prev + next) / 2`. Append → `last + 1.0`. Client sorts by `position` then `id`.

- *Why*: reorder touches exactly one memo row; no renumber cascades; stable under concurrent appends.
- *Risk*: float precision after ~50 bisections at the same spot → frontend detects gap exhaustion (`next - prev < epsilon`) and re-normalizes the column by issuing position rebalance writes. Simple and rare.

### D4. CEL filter fields `kanban_board`, `kanban_column`, `kanban_position`

`internal/filter/schema.go` declares three string/double fields backed by JSON paths `$.kanban.boardId`, `$.kanban.columnId`, `$.kanban.position` (protojson naming), rendered with existing JSON-extract helpers per dialect — same machinery as `property.has_task_list`. Presence check follows the `has_location` pattern: `has_kanban` renders as key-existence on `$.kanban`.

- Enables: `kanban_board == "b1" && kanban_column == "todo"`, `!has_kanban` for "add to board" pickers, and third-party API reuse.

### D5. API surface: new `BoardService` + `UpdateMemo` path

- `proto/api/v1/board_service.proto`: `Board` resource `users/{user}/boards/{board}` with `ListBoards`, `GetBoard`, `CreateBoard`, `UpdateBoard` (field mask: title, columns), `DeleteBoard`. Column add/rename/remove/color are expressed through `UpdateBoard`'s `columns` mask path — one service, no per-column RPCs.
- Card operations reuse existing memo RPCs:
  - Assign/move card → `UpdateMemo` with new mask path `"kanban"` (service copies `request.Memo.Kanban` into payload exactly like `location`; `kanban {}` clears it).
  - List column cards → `ListMemos` with `filter: 'kanban_board == "..." && kanban_column == "..."'`.
- Deleting a board leaves `memo.payload.kanban` orphaned; `DeleteBoard` sweeps the user's memos on that board and clears the field (bounded batch, best-effort with logging — matches runner patterns).
- Registration: `server/server.go` service wiring + `server/router/api/v1/acl_config.go` (authenticated, owner-scoped — same class as memo views).

### D6. Frontend: `/boards` pages, `@dnd-kit`, hooks-first data flow

- Routes: `/boards` (grid of board cards, create/rename/delete), `/boards/:boardId` (columns). New sidebar entry, `web/src/pages/Boards.tsx` + `web/src/components/Boards/`.
- DnD: `@dnd-kit/core` + `@dnd-kit/sortable` (React 19 compatible, tree-shakeable, ~1/3 the size of react-dnd, no provider HELL). One `DndContext` per board; `SortableContext` per column; cross-column drag = `onDragEnd` computes new `column_id` + midpoint `position` and fires `updateMemo` (mask `kanban`).
- Cards render with the existing `MemoView` component (compact mode) so all existing behaviors (tags, blur, attachments, links) come free.
- Data: React Query hooks under `web/src/hooks/` — `useBoards` (CRUD against BoardService), `useBoardCards` (`ListMemos` filter per board, grouped client-side by column, sorted by position). Optimistic drag update, rollback on error.
- Locales: English keys first (`web/src/locales/en.json`); other locales follow the existing community pattern and are non-blocking.

### D7. ACL & ownership

Board RPCs resolve `parent`/`name` to the authenticated user; only `users/{me}/boards/*` is writable. Reading someone's board definition is disallowed for other users — cards themselves remain visible through existing memo visibility (PUBLIC/PROTECTED) channels. Admin override follows existing `isSuperUser` conventions where already applied.

## Risks / Trade-offs

- [Blob read-modify-write races on BOARDS setting] → single `boardsMu` serializes writes per process (same as MEMO_VIEWS); last-write-wins across replicas is acceptable for per-user board edits, mirroring accepted behavior for views/webhooks.
- [Orphaned kanban state if board deleted mid-flight] → `DeleteBoard` sweeps memos; frontend also treats unknown `board_id` as "not on a board" so stale state never crashes the UI.
- [Float position exhaustion] → gap-exhaustion detection + column re-normalization (D3).
- [`updated_ts` bumps on every drag] → accepted; consistent with any memo update. If it proves noisy, a later additive change could add a separate `kanban_updated` payload timestamp (non-goal now).
- [Filter schema extension touches a shared, well-tested engine] → additive fields only; new schema/engine tests per dialect (sqlite/mysql/postgres) following `internal/filter` test conventions; no changes to existing field rendering.
- [New frontend dependency] → `@dnd-kit` scoped to `Boards` components via lazy-loaded route chunks; does not affect the main bundle for users who never open `/boards`.
- [Backward compatibility] → all proto changes additive (new field numbers, new enum values); older clients ignore unknown payload keys; `protojson` ignores unknown JSON fields, so older servers tolerate kanban-augmented payloads from newer clients.

## Migration Plan

No DB migration. Deploy is code-only. Rollback = revert binary; leftover `memo.payload.kanban` JSON and `BOARDS` user-setting rows are inert, unknown data that harms nothing (protojson skips unknown fields). This property is a design requirement, not an accident.

## Open Questions

- None blocking. (Column color palette default set is a UI detail; use GitHub's 8-color set.)
