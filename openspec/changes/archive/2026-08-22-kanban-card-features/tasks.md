# Implementation Tasks

## 1. Protobuf & Backend Service Extension

- [x] 1.1 Extend `proto/api/v1/memo_service.proto` and `proto/store/memo.proto` with `category`, `category_color_hex`, `due_time`, and `is_closed`.
- [x] 1.2 Run `cd proto && buf generate` to regenerate Go and TypeScript models.
- [x] 1.3 Update proto-to-store converters and memo service validation in `server/router/api/v1/memo_service.go`.
- [x] 1.4 Add backend test verifying saving and retrieving extended kanban card fields.

## 2. Frontend Components & Compact Card View

- [x] 2.1 Update `web/src/hooks/useBoardQueries.ts` mutation payloads with category, color, due_time, and is_closed.
- [x] 2.2 Create card title and description parser helper with deadline progress calculation.
- [x] 2.3 Redesign `KanbanCard.tsx` to render compact card with category badge, bold title, 2-line snippet, metadata icons, due date progress bar, and close toggle.
- [x] 2.4 Update `InlineCardCreator.tsx` to allow selecting category, color, and due date.
- [x] 2.5 Update `AddMemoToBoardDialog.tsx` to support category and due date fields.
- [x] 2.6 Add category and due date editing controls in `MemoDetailDialog.tsx`.

## 3. Verification & Testing

- [x] 3.1 Run backend tests with `go test -v -race ./server/router/api/v1/test/...`.
- [x] 3.2 Run frontend biome check, linter, and tests with `cd web && pnpm biome check --write src tests && pnpm lint && pnpm test`.
- [x] 3.3 Verify production build with `cd web && pnpm build`.
