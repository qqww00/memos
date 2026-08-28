## 1. Protobuf & API Schema Updates

- [x] 1.1 Update `proto/store/user_setting.proto` and `proto/api/v1/board_service.proto` with `category_colors` and `milestone_colors` maps on `Board`.
- [x] 1.2 Update `proto/store/memo.proto` and `proto/api/v1/memo_service.proto` with `milestone_color_hex` and `Activity` / `activities` message on `Memo` / `MemoPayload`.
- [x] 1.3 Run `buf generate` to regenerate Go, TypeScript, and OpenAPI definitions.

## 2. Backend Implementation

- [x] 2.1 Update `server/router/api/v1/board_service.go` and `store/user_setting.go` to persist and return `category_colors` and `milestone_colors`.
- [x] 2.2 Update `server/router/api/v1/memo_service.go` and `memo_service_converter.go` to diff kanban updates, append activity logs, and persist/return `activities` and `milestone_color_hex`.
- [x] 2.3 Add backend unit tests for board color persistence and memo kanban activity logging.

## 3. Frontend Form Title Support

- [x] 3.1 Update `MemoEditor` to include a dedicated Title input field that syncs bidirectionally with Markdown H1 headings.
- [x] 3.2 Update `InlineCardCreator` and `AddMemoToBoardDialog` with dedicated Title and Content input fields.

## 4. Frontend Color Database Persistence

- [x] 4.1 Update `cardUtils.ts` and board hooks to prioritize board-level `categoryColors` / `milestoneColors` and memo `milestoneColorHex` from DB.
- [x] 4.2 Update `MemoDetailDialog`, `AddMemoToBoardDialog`, and board settings to save color choices into the database via `UpdateBoard` / `UpdateMemoKanban`.

## 5. Smooth Kanban Drag-and-Drop Displacement Animation

- [x] 5.1 Enable `@dnd-kit/sortable` transitions and layout animations in `KanbanCard.tsx` and `KanbanColumn.tsx`.
- [x] 5.2 Implement multi-container `onDragOver` in `BoardDetail.tsx` to dynamically reorder and shift target column items downward during drag.

## 6. Memo Activity History UI

- [x] 6.1 Create `MemoActivityHistory` timeline component and integrate it into `MemoDetailDialog.tsx` under the memo view.
- [x] 6.2 Format activity events (category change/removal, milestone change/removal, column movement, completion status, due date) with clear relative/exact timestamps and user names.

## 7. Verification & Testing

- [x] 7.1 Run backend tests (`go test -v -race ./server/...` and `./store/...`).
- [x] 7.2 Run frontend lint, typecheck, and tests (`cd web && pnpm lint && pnpm test`).
