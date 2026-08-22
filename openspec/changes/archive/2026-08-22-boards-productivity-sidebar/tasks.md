## 1. Sidebar Component and Route Integration

- [x] 1.1 Create `BoardsSidebarContent.tsx` with Boards navigation list and "+ New Board" dialog trigger
- [x] 1.2 Wire `RouteSidebarContent` in `AppSidebar.tsx` to render `BoardsSidebarContent` when `kind === "boards"`

## 2. Adaptive Analytics and Board Health

- [x] 2.1 Implement global stats widget for `/boards` (total boards, total cards, overdue/due-today counters)
- [x] 2.2 Implement active board health widget for `/boards/:boardId` (progress bar, column breakdown, overdue & due-today alerts)

## 3. Contextual Quick Filters and Synchronization

- [x] 3.1 Implement category filter pills with color dots in `BoardsSidebarContent`
- [x] 3.2 Implement deadline status filter buttons (Overdue, Due Today) in `BoardsSidebarContent`
- [x] 3.3 Synchronize filter state between sidebar and `BoardDetail.tsx` via URL search parameters

## 4. Verification and Polish

- [x] 4.1 Verify UI responsiveness, mobile drawer closing, and OKLch theme consistency
- [x] 4.2 Run frontend linting and tests (`pnpm lint && pnpm test`)
