## ADDED Requirements

### Requirement: Card Category with Color Palette
The system SHALL support assigning a category and a color hex code to a memo on a board.

#### Scenario: Assign category to board card
- **WHEN** user creates or edits a memo on a board and specifies a category (e.g. "Bug") and color hex (e.g. "#ef4444")
- **THEN** the category badge is displayed with the corresponding color on the Kanban card.

#### Scenario: Clear category
- **WHEN** user removes the category from the memo's Kanban settings
- **THEN** the category badge is no longer rendered on the card.

### Requirement: Compact Card View
The system SHALL render Kanban cards in a compact, structured format displaying the title, a clamped description snippet, metadata counters, and category badge.

#### Scenario: Card presentation
- **WHEN** memos are rendered inside a Kanban column
- **THEN** the card displays the first line as a bold title, followed by up to 2 lines of description, without full feed widgets.

#### Scenario: Open full memo detail modal
- **WHEN** user clicks on a compact Kanban card
- **THEN** the system opens a `MemoDetailDialog` modal popup showing full markdown content, attachments, and comments without URL redirect.

### Requirement: Due Date and Progress Bar
The system SHALL support setting a due date on board memos and display a visual progress bar indicating time elapsed toward the deadline.

#### Scenario: Card with active due date
- **WHEN** a card has a due date in the future
- **THEN** a due date badge and progress bar are rendered, showing the elapsed percentage from creation time to due time.

#### Scenario: Overdue card
- **WHEN** the current time exceeds the due date
- **THEN** the progress bar is 100% full and styled with an overdue warning color (red).

### Requirement: Close and Reopen Cards
The system SHALL support marking a card as closed or reopening a closed card.

#### Scenario: Mark card as closed
- **WHEN** user clicks the close action on a card
- **THEN** the card's status becomes closed (`is_closed: true`), displaying a completed badge and strikethrough styling on title.

#### Scenario: Reopen closed card
- **WHEN** user clicks the reopen action on a closed card
- **THEN** the card returns to active status.
