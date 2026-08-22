## ADDED Requirements

### Requirement: Parse markdown task lists on Kanban cards
The system SHALL parse standard Markdown task list items (`- [ ]` and `- [x]`) from memo content for display on Kanban cards.

#### Scenario: Memo contains task list items
- **WHEN** a memo content includes one or more `- [ ]` or `- [x]` Markdown checklist items
- **THEN** the Kanban card displays a checklist indicator showing completed count versus total count (e.g. `2/4`) along with a mini progress bar

#### Scenario: Memo has no task list items
- **WHEN** a memo content does not contain any `- [ ]` or `- [x]` lines
- **THEN** the checklist indicator and progress bar are not rendered

### Requirement: Interactive subtask toggle from Kanban card
The system SHALL allow users to directly check or uncheck individual subtask items directly from the Kanban card without opening the full edit dialog.

#### Scenario: User toggles a subtask checkbox on the card
- **WHEN** a user clicks an interactive task list item checkbox on the Kanban card
- **THEN** the memo's content is updated with the modified `[x]` or `[ ]` state, the mutation is dispatched via `updateMemo`, and the card progress immediately updates optimistically
