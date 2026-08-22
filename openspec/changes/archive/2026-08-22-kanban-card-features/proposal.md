# Proposal: Kanban Card Categories, Compact View, Due Dates, and Card Completion

## Why

Kanban boards currently render full memo views with all metadata and long content directly inside column cards. To make boards feel like a true project management workflow tool (similar to Linear or Trello), cards need:
1. Distinct visual categories with curated color palettes.
2. A streamlined, compact card representation focused on title and a brief description snippet.
3. Due date tracking with visual progress indicators as deadlines approach.
4. Quick completion and card closing actions.

## What Changes

- **Kanban Card Data Model**:
  - Extend Protobuf `Kanban` and `KanbanPayload` definitions with `category`, `category_color_hex`, `due_time`, and `is_closed`.
- **Compact Card View**:
  - Redesign `KanbanCard` to display category badges, bold clean title, 2-line description clamp, metadata badges (attachments count, comments count), and completion status.
- **Due Date & Progress Bar**:
  - Display due date badge with time-based visual progress bar (on track, approaching deadline, overdue).
- **Card Completion / Close**:
  - Add quick action to close/reopen cards on boards with strikethrough styling and closed-filter management.
- **Card Composer & Detail Editor**:
  - Enable setting category, color, and due date when creating cards inline or editing them inside `MemoDetailDialog`.

## Capabilities

### New Capabilities
- `kanban-card-features`: Extends board cards with category labels, compact presentation, due dates with deadline progress bars, and board-level card completion.

### Modified Capabilities
<!-- No existing capabilities to modify in openspec/specs/ -->

## Impact

- **Protobuf Schemas**: `proto/api/v1/memo_service.proto` and `proto/store/memo.proto`.
- **Protobuf Generation**: `buf generate` regenerating Go + TypeScript contracts.
- **Backend API**: `memo_service.go` handling the new Kanban fields in `CreateMemo` and `UpdateMemo`.
- **Frontend Components**: `KanbanCard.tsx`, `InlineCardCreator.tsx`, `MemoDetailDialog.tsx`, `AddMemoToBoardDialog.tsx`, `useBoardQueries.ts`.
- **Translations**: `web/src/locales/en.json`.
