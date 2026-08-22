# Proposal: add-kanban-boards

## Why

Memos users track work (tasks, bugs, ideas) as memos, but the list/timeline views cannot answer "what is in flight right now?". A GitHub Projects-style Kanban board gives per-project status flow at a glance. The hard constraint: the feature must ship with **zero database schema migrations** and without breaking any existing behavior — all persistent state must live in existing JSON columns (`memo.payload`, `user_setting.value`).

## What Changes

- Add a per-user **Boards** backend: multiple boards (like GitHub Projects), each with a user-defined set of columns, stored as a new `UserSetting` key (`BOARDS`) in the existing `user_setting` table.
- Add **kanban card state** on memos: `MemoPayload` gains an additive `kanban` field (`board_id`, `column_id`, `position`) persisted in the existing `memo.payload` JSON column.
- Expose board CRUD and card move operations via new Connect/gRPC-Gateway services under `proto/api/v1/` (additive proto, backwards-compatible).
- Extend the CEL filter schema (`internal/filter/schema.go`) so memos can be queried by kanban board/column server-side (e.g. `kanban_board == "..." && kanban_column == "..."`), rendered to JSON-path SQL like existing payload fields.
- Card = **whole memo** (not task-list items). Dragging a card moves the memo's kanban column/position; memo content is never rewritten by board actions.
- New frontend page `/boards` (list of boards) and `/boards/:boardId` (board view with horizontal columns, drag-and-drop cards via `@dnd-kit`), reusing the existing `MemoView` card component.
- No changes to any database DDL, `LATEST.sql`, or migration files. No breaking API changes.

## Capabilities

### New Capabilities

- `kanban-boards`: Per-user board definitions (boards, columns, colors, WIP-free ordering) with full CRUD, persisted as a `BOARDS` user setting — no schema migration.
- `kanban-cards`: Kanban card state on memos (`MemoPayload.kanban`), assignment via `UpdateMemo` field mask, and drag-equivalent move semantics (column + fractional position) without touching memo content.
- `kanban-filtering`: Server-side CEL filter fields for kanban board/column so boards and third-party clients can query cards with the standard `ListMemos` filter.
- `kanban-ui`: `/boards` pages — board list, board detail with columns and drag-and-drop cards, "add memo to board" entry points.

### Modified Capabilities

<!-- No existing main specs; all capabilities above are new. Memo UpdateMemo gains an
     additive field-mask path, which is covered as a requirement inside kanban-cards. -->

## Impact

- **Proto**: `proto/store/memo.proto` (additive `KanbanPayload` field), `proto/store/user_setting.proto` (new `BOARDS` key + message), new `proto/api/v1/board_service.proto` + `memo` updates; regenerate `proto/gen/` and `web/src/types/proto/`.
- **Backend**: `store/user_setting.go` (board CRUD helpers, mutex-guarded like MEMO_VIEWS), `internal/filter/schema.go` (new fields), `server/router/api/v1/` (board service, `UpdateMemo` `kanban` path following the `location` precedent at memo_service.go:527), `server/router/api/v1/acl_config.go`, `server/server.go` service registration.
- **Frontend**: new `web/src/pages/Boards*.tsx`, board components, `@dnd-kit/core` + `@dnd-kit/sortable` dependency (new, user-approved), React Query hooks under `web/src/hooks/`, sidebar entry, locale strings (en fallback first).
- **Storage**: none — `memo.payload` and `user_setting.value` are existing JSON text columns; payload rebuild (`server/runner/memopayload`) only overwrites `Tags`/`Property` in place, so kanban state survives rebuilds.
- **Out of scope**: task-list-item cards, cross-user shared boards, board templates, swimlanes.
