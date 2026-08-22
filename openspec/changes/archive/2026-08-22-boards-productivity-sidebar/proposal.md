## Why

When navigating to `/boards` or `/boards/:boardId`, the left sidebar currently falls back to the default `CollectionSidebarContent`, which renders the standard memo creation activity calendar and general memo tags. In the context of Kanban boards and project/task management, this calendar is irrelevant to task tracking and board workflows.

Replacing the generic calendar with an adaptive, modular productivity sidebar provides instant board navigation, health/progress metrics, and contextual category/deadline filters directly alongside the Kanban workspace.

## What Changes

- **Dedicated Boards Sidebar Tenant (`BoardsSidebarContent`)**: Wire `getSidebarRouteKind` and `RouteSidebarContent` so `/boards` and `/boards/:boardId` render a specialized sidebar rather than the fallback memo collection sidebar.
- **Board Navigator & Quick Switcher**: Display a list of all user boards with card count badges, active board indicator, and a quick "+ New Board" action to switch boards without navigating back to `/boards`.
- **Adaptive Scope Support**:
  - **Global Hub (`/boards`)**: Displays global task analytics across all boards (total cards, total overdue tasks, tasks due today).
  - **Active Board Detail (`/boards/:boardId`)**: Displays active board health metrics (completion percentage progress bar, column card distribution, overdue & due today alerts for the active board).
- **Contextual Board Filters**: At `/boards/:boardId`, render board-specific categories/labels and quick deadline filters that allow 1-click filtering of the active Kanban board.

## Capabilities

### New Capabilities
- `boards-productivity-sidebar`: Specialized, contextual productivity sidebar for `/boards` and `/boards/:boardId` supporting board switching, health and progress analytics, and board-level quick filters.

### Modified Capabilities
<!-- None -->

## Impact

- **Affected Code**: `web/src/components/AppSidebar/AppSidebar.tsx`, `web/src/components/AppSidebar/BoardsSidebarContent.tsx` (new), `web/src/components/Boards/`, `web/src/pages/BoardDetail.tsx` (optional filter sync via search params / context).
- **APIs/Dependencies**: Leverages existing `useBoards`, `useBoardCards`, and `useAllBoardsCards` / board queries. No backend proto or database schema changes needed.
