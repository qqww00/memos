## Why

Users need more control, visual clarity, and traceability when managing memos and kanban boards. Specifically:
1. Composing memos without a dedicated title form requires manually typing Markdown headings. Providing a title field streamlines memo creation across the editor and board card dialogs.
2. Category and milestone color definitions currently fall back to transient client hashing or single-category memo fields; persisting custom color definitions in the database ensures consistent visual styling across devices and reloads.
3. Dragging a card across kanban columns lacks real-time displacement animation in the target column, making card drop targeting feel rigid.
4. Changes made to a card's board properties (categories, milestones, columns, due dates, and completion status) are not logged, leaving users without an audit trail of changes.

## What Changes

- **Memo Form Title**:
  - Add an optional Title input in the main Memo Editor (`MemoEditor`) and board card creation dialogs (`InlineCardCreator`, `AddMemoToBoardDialog`).
  - Pre-populate and synchronize the title with Markdown H1 headings (`# Title`) and `memo.property.title`.
- **Database Persistence for Category & Milestone Colors**:
  - Store board-level category and milestone color definitions in the database via `Board.category_colors` and `Board.milestone_colors` (`BoardsUserSetting`).
  - Store per-card milestone color in `memo.payload` (`milestone_color_hex` in `KanbanPayload` / `Kanban`).
  - Update board APIs and frontend color resolution to read directly from database-persisted color maps.
- **Smooth Kanban Drag-and-Drop Displacement Animation**:
  - Enable `@dnd-kit` transition animations and multi-container `onDragOver` dynamic positioning so cards in the target column smoothly animate downwards to make room for the dragged card.
- **Memo Board Info Activity & Change History**:
  - Track changes made to board information (column movement, status change, category updates/removals, milestone updates, due date adjustments) in `memo.payload.activities` / `memo.activities`.
  - Render an Activity History section under the Memo Detail view (`MemoDetailDialog`) displaying chronological update logs with timestamps and creators.

## Capabilities

### New Capabilities
- `memo-form-title`: Form title input support across memo editor and card creator dialogs with markdown title synchronization.
- `memo-activity-history`: Audit log tracking and timeline rendering for memo board metadata changes.

### Modified Capabilities
- `kanban-boards`: Persist board category and milestone color definitions in the database.
- `kanban-cards`: Smooth target column displacement during drag and drop across columns.

## Impact

- **Protobuf / API**:
  - Extend `Board` and `BoardsUserSetting.Board` with `map<string, string> category_colors` and `map<string, string> milestone_colors`.
  - Extend `Kanban` and `KanbanPayload` with `optional string milestone_color_hex` and `repeated Activity activities`.
  - Regenerate protos with `buf generate`.
- **Backend**:
  - Update `BoardService` and `MemoService` to handle color map persistence and generate activity history records on kanban metadata mutations.
- **Frontend**:
  - Update `MemoEditor`, `InlineCardCreator`, `AddMemoToBoardDialog`, `MemoDetailDialog`, `KanbanColumn`, and `KanbanCard`.
