## 1. Due Date Formatting & Computation

- [x] 1.1 Update `computeDeadlineProgress` in `cardUtils.ts` to format `formattedDue` with date-only label while preserving exact progress bar calculations
- [x] 1.2 Update due date picker in `MemoDetailDialog.tsx` for simplified date selection with accurate timestamp persistence

## 2. Category Color Consistency

- [x] 2.1 Fix secondary category color inheritance bug in `KanbanCard.tsx`
- [x] 2.2 Unify category color resolution in `MemoDetailDialog.tsx`, `BoardDetail.tsx`, and `MilestonesRoadmapView.tsx`

## 3. Categories and Milestones Dropdowns in Card Detail

- [x] 3.1 Replace flat category pill wrap in `MemoDetailDialog.tsx` with a multi-select DropdownMenu containing right-aligned color indicators
- [x] 3.2 Replace flat milestone pill wrap in `MemoDetailDialog.tsx` with a single-select DropdownMenu containing right-aligned milestone color indicators

## 4. Boards as Home Page

- [x] 4.1 Update route configuration in `router/index.tsx` so authenticated root `/` renders `<Boards />`
- [x] 4.2 Verify navigation links and sidebar active states for Boards as home

## 5. Verification & Tests

- [x] 5.1 Run frontend lint and unit tests
- [x] 5.2 Verify complete board lifecycle, due date progress, dropdown selections, and color consistency
