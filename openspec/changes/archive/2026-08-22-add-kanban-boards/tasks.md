# Tasks: add-kanban-boards

## 1. Proto definitions

- [x] 1.1 Add `KanbanPayload` message (`board_id`, `column_id`, `position`) and `optional KanbanPayload kanban = 4` field to `proto/store/memo.proto`
- [x] 1.2 Add `BOARDS = 9` enum value, `BoardsUserSetting`/`Board`/`BoardColumn` messages, and oneof wiring to `proto/store/user_setting.proto`
- [x] 1.3 Create `proto/api/v1/board_service.proto` (Board resource, List/Get/Create/Update/Delete RPCs with HTTP annotations, mirroring `memo_view_service.proto` style)
- [x] 1.4 Add `kanban` field to api `Memo` message and document the new `UpdateMemo` mask path
- [x] 1.5 Run `cd proto && buf generate && buf lint` and commit generated Go/TS/OpenAPI outputs untouched by hand

## 2. Store layer (no schema changes)

- [x] 2.1 Add `BOARDS` case to `convertUserSettingFromRaw`/`convertUserSettingToRaw` in `store/user_setting.go`
- [x] 2.2 Implement `GetUserBoards`, `UpsertUserBoard`, `RemoveUserBoard` helpers with a `boardsMu` mutex following the `memoViewMu` pattern
- [x] 2.3 Store-level tests for board CRUD round-trip (protojson marshal/unmarshal, concurrent add via mutex)

## 3. Filter engine

- [x] 3.1 Declare `kanban_board`, `kanban_column`, `kanban_position` (JSON-path backed) and `has_kanban` (presence) in `internal/filter/schema.go`
- [x] 3.2 Add per-dialect unit tests (sqlite/mysql/postgres) asserting rendered SQL for equality on board/column, comparison on position, and presence checks
- [x] 3.3 Run existing `internal/filter` tests unmodified to prove no regression

## 4. API services

- [x] 4.1 Create `server/router/api/v1/board_service.go` implementing BoardService (owner-scoped resolution, title uniqueness per user, at-least-one-column rule, `DeleteBoard` kanban sweep with batched memo updates)
- [x] 4.2 Add `kanban` mask-path handling in `UpdateMemo` (`memo_service.go`) mirroring the `location` pattern, including target board/column validation and empty-message clearing
- [x] 4.3 Register BoardService in `server/server.go`/`server/router/api/v1/v1.go` and add routes to `acl_config.go`
- [x] 4.4 Server tests: board CRUD, permission denial across users, kanban assign/move/clear via UpdateMemo, content-edit preserves kanban payload, board delete sweep

## 5. Frontend data layer

- [x] 5.1 Add `@dnd-kit/core` and `@dnd-kit/sortable` to `web/package.json` and install
- [x] 5.2 Create `useBoards` React Query hook (list/create/update/delete against BoardService) in `web/src/hooks/`
- [x] 5.3 Create `useBoardCards` hook (ListMemos filtered by `kanban_board`, grouped by column client-side, sorted by position then id)
- [x] 5.4 Create `useUpdateMemoKanban` mutation with optimistic drag update and rollback

## 6. Frontend UI

- [x] 6.1 Create `web/src/components/Boards/` components: BoardCard, BoardList, ColumnHeader (rename/recolor/remove/reorder actions), KanbanColumn, KanbanCard (compact `MemoView` wrapper)
- [x] 6.2 Create `web/src/pages/Boards.tsx` (board grid, create dialog, empty state) with lazy-loaded route at `/boards`
- [x] 6.3 Create board detail page at `/boards/:boardId` with horizontal columns and `DndContext`/`SortableContext` drag-and-drop (cross-column move, midpoint insert, append; gap-exhaustion re-normalization)
- [x] 6.4 Implement "Add memo to board": picker on board page (search, default filter `!has_kanban`) and "Add to board" item in `MemoActionMenu`
- [x] 6.5 Add "Boards" sidebar entry in `AppSidebar`, route wiring, and English locale strings in `web/src/locales/en.json`

## 7. Verification

- [x] 7.1 Backend: `go test -v -race ./server/... ./internal/... ./store/...` (store driver tests as available) and `golangci-lint run`
- [x] 7.2 Frontend: `cd web && pnpm lint && pnpm test && pnpm build`; confirm boards chunk is split from the entry bundle
- [x] 7.3 Manual smoke: create board, add memos, drag within/between columns, edit memo content and confirm card state survives, delete board and confirm cards are freed
