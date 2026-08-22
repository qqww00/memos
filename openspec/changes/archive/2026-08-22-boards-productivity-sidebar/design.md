## Context

Currently, Memos routes `/boards` and `/boards/:boardId` fall back to the generic `CollectionSidebarContent` in `AppSidebar.tsx`, rendering an activity calendar heatmap and generic tags that are disconnected from the Kanban workflow. 

`getSidebarRouteKind` in `routes.ts` already returns `"boards"`, but `AppSidebar.tsx` lacks a dedicated component for this route kind.

## Goals / Non-Goals

**Goals:**
- Implement `BoardsSidebarContent` dedicated to `/boards` and `/boards/:boardId`.
- Provide board listing with active board highlighting, card counts, and 1-click switching.
- Provide a "+ New Board" creation dialog trigger in the sidebar.
- Provide adaptive analytics:
  - Global overview (total cards, global overdue/due-today) when on `/boards`.
  - Active board health (completion %, column distribution, overdue/due-today alerts) when on `/boards/:boardId`.
- Provide contextual category and deadline quick filters for the active board synchronized via URL search params (`category`, `due`, `status`) so `BoardDetail.tsx` reflects sidebar filter clicks.

**Non-Goals:**
- Changing backend protobuf or database schema.
- Re-implementing the core Kanban drag-and-drop mechanism.

## Decisions

### 1. Dedicated `BoardsSidebarContent` Component
- **Decision**: Place `BoardsSidebarContent.tsx` under `web/src/components/AppSidebar/` following the existing pattern of `CollectionSidebarContent`, `AttachmentsSidebarContent`, `InboxSidebarContent`, and `SettingsSidebarContent`.
- **Rationale**: Keeps sidebar tenant logic isolated, modular, and adhering to Memos conventions.

### 2. URL Search Params for Filter Synchronization
- **Decision**: Synchronize active board filters (category, status, due date) via URL search parameters (e.g., `?category=bug`, `?due=today`, `?status=all`).
- **Rationale**: Allows direct linking, browser history support, and instant synchronization between `BoardsSidebarContent` and `BoardDetail.tsx` without needing complex global state stores.

### 3. Progressive Card Stats Calculation
- **Decision**: For the active board, calculate stats directly from `useBoardCards(activeBoardId)`. For global view, aggregate cards from loaded boards.
- **Rationale**: Leverages React Query cache efficiently with zero extra network overhead.

## Risks / Trade-offs

- **[Filter state conflicts between header popovers and sidebar]** → Both read and write to the same URL search params / shared filter state, ensuring bidirectional consistency.
- **[Empty board state]** → Graceful empty states with helpful prompts to create boards or add cards.
