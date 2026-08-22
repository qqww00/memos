# kanban-ui Spec

## ADDED Requirements

### Requirement: Board list page
The system SHALL provide a `/boards` page listing the current user's boards as cards with title and column count, with create, rename, and delete actions. Creating a board SHALL seed it with default columns "Todo", "In Progress", "Done".

#### Scenario: Create a board from the list page
- **WHEN** the user clicks "New Board", enters a title, and confirms
- **THEN** the new board appears in the list and opens with three default columns

#### Scenario: Empty state
- **WHEN** the user has no boards
- **THEN** the page shows an empty-state prompt with a create action

### Requirement: Board detail page with columns
The system SHALL provide `/boards/:boardId` rendering the board's columns horizontally in definition order, each column showing its title, color accent, and its memos as cards ordered by `position` ascending. Columns SHALL be manageable (add, rename, recolor, reorder, remove) from this page.

#### Scenario: Render column cards in order
- **WHEN** a column contains cards with positions 3.0, 1.0, 2.0
- **THEN** the cards render in ascending position order 1.0, 2.0, 3.0

#### Scenario: Last column protection surfaced
- **WHEN** the user attempts to remove the only remaining column
- **THEN** the UI blocks or surfaces the rejection without losing board state

### Requirement: Drag and drop cards
The system SHALL implement drag-and-drop for cards within a column (reorder) and across columns (move) using `@dnd-kit`. A completed drag SHALL produce exactly one `UpdateMemo` call with the `kanban` mask carrying the new `column_id` and midpoint/appended `position`. The UI SHALL optimistically apply the drop and roll back on API error.

#### Scenario: Drag card to another column
- **WHEN** the user drags a card from "Todo" and drops it between two cards of "Doing"
- **THEN** the card immediately appears at that spot and one `UpdateMemo` request persists `column_id` and midpoint `position`

#### Scenario: Failed move rolls back
- **WHEN** a drop's `UpdateMemo` request fails
- **THEN** the card animates back to its original column and position and an error toast is shown

### Requirement: Cards reuse the memo card component
The system SHALL render board cards using the existing `MemoView` component (compact mode) so tags, blurred-tag behavior, attachments, and links behave identically to the rest of the app. Clicking a card SHALL navigate to the memo detail page.

#### Scenario: Blurred tag on a card
- **WHEN** a card's memo carries a tag configured with blur content
- **THEN** the card renders blurred with the same reveal interaction as in the memo feed

### Requirement: Add memo to board
The system SHALL provide an entry point to add an existing memo to a board column: from the board page (picker searching the user's memos, defaulting the filter to memos not yet on the board) and from the memo action menu (choose board and column). Adding SHALL assign append position in the chosen column.

#### Scenario: Add memo via board picker
- **WHEN** the user searches a memo by keyword in the "Add memo" picker and selects it for column "Todo"
- **THEN** the memo appears at the end of that column and receives `has_kanban` state

#### Scenario: Add via memo action menu
- **WHEN** the user opens a memo's action menu, chooses "Add to board", and picks a board and column
- **THEN** the memo is assigned to that column with append position

### Requirement: Board navigation entry
The system SHALL add a "Boards" entry to the application sidebar linking to `/boards`, visible to signed-in users.

#### Scenario: Sidebar navigation
- **WHEN** a signed-in user opens the sidebar
- **THEN** a "Boards" link is present and navigates to `/boards`

### Requirement: Board routes are lazy-loaded
The system SHALL code-split the boards pages so `@dnd-kit` and board components are only loaded when a `/boards` route is visited, keeping them out of the main bundle.

#### Scenario: Main bundle unaffected
- **WHEN** the app is built and the user never visits `/boards`
- **THEN** `@dnd-kit` modules are not present in the entry chunk
