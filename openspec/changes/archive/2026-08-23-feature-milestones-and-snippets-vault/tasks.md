## 1. First-Class Milestone Data Model & Integration

- [x] 1.1 Add `optional string milestone = 9;` to `Kanban` and `KanbanPayload` proto schemas and run `buf generate`
- [x] 1.2 Update Go store converters in `server/router/api/v1/memo_service_converter.go`
- [x] 1.3 Add `getCardMilestone` and `getMilestoneColor` in `web/src/components/Boards/cardUtils.ts`
- [x] 1.4 Render `[ 🎯 Milestone ]` badge on Kanban cards in `web/src/components/Boards/KanbanCard.tsx`
- [x] 1.5 Add Milestone picker popover to `AddMemoToBoardDialog.tsx`, `InlineCardCreator.tsx`, and `MemoDetailDialog.tsx`
- [x] 1.6 Add Milestone filter dropdown and milestone progress header banner in `web/src/pages/BoardDetail.tsx`

## 2. Milestones Roadmap View

- [x] 2.1 Create `web/src/components/Boards/MilestonesRoadmapView.tsx` with aggregate milestone progress cards and linked tasks
- [x] 2.2 Add View Switcher `[ 📌 Kanban | 🎯 Milestones Roadmap ]` in `web/src/pages/BoardDetail.tsx`

## 3. Code Snippets Vault

- [x] 3.1 Create `web/src/utils/snippetUtils.ts` to extract and parse code snippets across all memos
- [x] 3.2 Create `web/src/pages/Snippets.tsx` with language filter chips, full-text search, and 1-click copy
- [x] 3.3 Register `/snippets` route in router and add navigation item in `web/src/components/AppSidebar/`

## 4. Verification & Tests

- [x] 4.1 Add unit tests in `web/tests/feature-snippets.test.ts` for milestone extraction and snippet parsing
- [x] 4.2 Run `pnpm lint`, `pnpm test`, and `go test` across the full backend and frontend test suites
