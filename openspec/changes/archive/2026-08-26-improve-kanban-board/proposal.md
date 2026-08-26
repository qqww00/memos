## Why

The Kanban board experience has several UX friction points: due dates in cards show unnecessary hour/minute strings that clutter the badge display, category and milestone selectors in the card detail dialog use flat unwieldy button wraps instead of compact dropdowns with color indicators, board is not yet the primary home page for fast access, and category badge colors are inconsistent between card views, filter popups, and the detail dialog.

Resolving these issues streamlines board navigation, provides a cleaner card interface with accurate progress calculation, improves categorization workflows, and ensures visual consistency across the entire workspace.

## What Changes

- **Due Date UI simplification**: Simplify card due date labels to show date-only (e.g. "Aug 26") while retaining second-level timestamp accuracy for progress percentage calculation and deadline countdown.
- **Board categories dropdown**: Replace the flat category pill wrap in the card detail dialog with a compact multi-select dropdown featuring color dot indicators on the right.
- **Board milestones dropdown**: Replace the flat milestone pill wrap in the card detail dialog with a compact single-select dropdown featuring milestone color indicators.
- **Boards as Home Page**: Set Boards as the default landing view for authenticated users at `/` with seamless navigation.
- **Unified Category Color Resolver**: Fix the category color override bug where secondary categories inherit primary category colors, and establish a single source of truth for category color resolution across cards, dialogs, filters, and roadmaps.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `kanban-cards`: Update due date display formatting to date-only on cards while maintaining deadline progress computation, and fix card badge category color inheritance bugs.
- `kanban-ui`: Enhance category and milestone selector interfaces in the card detail dialog to use structured dropdowns with color indicators on the right. Set Boards as the authenticated home landing experience.

## Impact

- Frontend: `web/src/components/Boards/cardUtils.ts`, `KanbanCard.tsx`, `MemoDetailDialog.tsx`, `BoardDetail.tsx`, `MilestonesRoadmapView.tsx`, `web/src/router/index.tsx`, `web/src/components/AppSidebar/AppSidebar.tsx`.
- APIs/Backend: No backend proto or migration changes required; all enhancements utilize existing kanban protobuf fields.
