## ADDED Requirements

### Requirement: Dedicated Boards Sidebar Tenant
The application SHALL render `BoardsSidebarContent` in the left application sidebar whenever the route is `/boards` or `/boards/:boardId`, replacing the default memo activity calendar and general memo tags.

#### Scenario: User navigates to Boards route
- **WHEN** the user navigates to `/boards` or `/boards/:boardId`
- **THEN** the sidebar displays the boards productivity sidebar instead of the memo activity calendar

### Requirement: Board Navigation and Switcher
The sidebar SHALL render a list of all user boards with active indicators, total card counters, and a "+ New Board" creation trigger.

#### Scenario: Switching active board from sidebar
- **WHEN** the user clicks on another board item in the sidebar board list
- **THEN** the application navigates directly to `/boards/:boardId` of the selected board

#### Scenario: Creating a new board from sidebar
- **WHEN** the user clicks the "+ New Board" button in the sidebar header
- **THEN** the create board dialog opens, allowing the user to create a new board

### Requirement: Adaptive Scope Rendering
The sidebar SHALL dynamically adjust its analytics and filter sections depending on whether the current route is the global boards hub (`/boards`) or an active board detail view (`/boards/:boardId`).

#### Scenario: Global hub view at `/boards`
- **WHEN** the user is at `/boards`
- **THEN** the sidebar displays global task metrics across all boards including total cards, overdue count, and tasks due today

#### Scenario: Active board detail view at `/boards/:boardId`
- **WHEN** the user is at `/boards/:boardId`
- **THEN** the sidebar displays active board progress (completion percentage progress bar, column breakdown, and attention alerts)

### Requirement: Active Board Quick Filters
When viewing an active board (`/boards/:boardId`), the sidebar SHALL display available categories and deadline filters that allow 1-click filtering of cards on the active Kanban board.

#### Scenario: Filtering board by category from sidebar
- **WHEN** the user clicks a category badge in the sidebar
- **THEN** the active board filters cards to only display cards matching the selected category

#### Scenario: Filtering board by deadline status from sidebar
- **WHEN** the user clicks an overdue or due-today alert in the sidebar
- **THEN** the active board filters cards to only display matching cards
