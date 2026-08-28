# kanban-cards Spec

## ADDED Requirements

### Requirement: Card state is stored in memo payload
The system SHALL store kanban card state as an additive `kanban` field inside the existing `memo.payload` JSON column, comprising `board_id`, `column_id`, and a fractional `position` (double). A memo SHALL be a card of at most one board at a time.

#### Scenario: Assign a memo to a board column
- **WHEN** `UpdateMemo` is called with mask path `kanban` and `{board_id, column_id, position}`
- **THEN** the memo's payload contains that kanban object and the memo content is unchanged

#### Scenario: Card state survives content edits
- **WHEN** a card's memo content is later edited through the normal editor
- **THEN** the payload rebuild preserves the `kanban` field (only `tags` and `property` are recomputed)

### Requirement: Dragging never rewrites memo content
The system SHALL implement moving a card between or within columns solely as a `kanban` payload update, and MUST NOT modify, append to, or reformat the memo's `content` string.

#### Scenario: Move card from Todo to Doing
- **WHEN** a card is dragged from column "Todo" to column "Doing"
- **THEN** only `kanban.column_id` (and `position`) change; `content`, `tags`, and attachments are untouched

### Requirement: Fractional ordering within columns
The system SHALL order cards within a column by `position` ascending (ties broken by memo id ascending). Insertions between two cards SHALL compute the midpoint of neighboring positions; appends SHALL use a position greater than the current maximum.

#### Scenario: Insert between two cards
- **WHEN** cards with positions 1.0 and 2.0 exist and a card is dropped between them
- **THEN** the moved card receives position 1.5 and the column renders it between the two

#### Scenario: Position precision exhaustion
- **WHEN** neighboring positions become closer than a small epsilon after repeated insertions at the same spot
- **THEN** the client re-normalizes positions across the column via additional `UpdateMemo` calls so subsequent midpoints remain representable

### Requirement: Removing a card from a board
The system SHALL support clearing a memo's kanban state by sending `UpdateMemo` with mask path `kanban` and an empty kanban object, returning the memo to "not on any board".

#### Scenario: User removes card from board
- **WHEN** `UpdateMemo` sets mask `kanban` with an empty message
- **THEN** the memo's payload no longer carries kanban state and the memo remains otherwise intact

### Requirement: Kanban writes are additive and backwards compatible
The system SHALL keep the `kanban` payload field and the `UpdateMemo` mask path additive: older clients ignore them, and older servers receiving kanban-bearing payloads from newer clients SHALL tolerate the unknown JSON keys without error.

#### Scenario: Older server receives kanban payload
- **WHEN** a newer client round-trips a memo whose payload includes `kanban` through a server built before this feature
- **THEN** the request succeeds and no corruption or validation error occurs

### Requirement: Moving a card to a different board
The system SHALL support moving a card from one board to another by overwriting `board_id`, `column_id`, and `position` in a single `UpdateMemo` call, provided the target board and column exist and belong to the same user.

#### Scenario: Move card to another board
- **WHEN** a card on board A is moved to column "Todo" of board B
- **THEN** the card appears in board B's "Todo" and no longer in any board A column listing

#### Scenario: Target column does not exist
- **WHEN** `UpdateMemo` sets kanban state referencing a `column_id` that does not exist on the target board
- **THEN** the request is rejected with `InvalidArgument`

### Requirement: Card due date displays date without hour/minute
The system SHALL format the card due date label with month and day (and year when different from the current year) without displaying hour or minute strings, while continuing to calculate the deadline progress bar and remaining time relative to the full timestamp.

#### Scenario: Display due date on card
- **WHEN** a card has a due date timestamp set
- **THEN** the card renders the due date label as month and day (e.g., "Aug 26") and computes the percentage progress bar based on the exact timestamp

### Requirement: Category badge colors are resolved independently per category
The system SHALL resolve category badge colors on a card such that a primary category override color only applies to that specific primary category, and secondary categories resolve to their own deterministic or configured category colors.

#### Scenario: Card with multiple categories renders distinct colors
- **WHEN** a card has primary category "Bug" with custom red color and secondary category "Frontend"
- **THEN** "Bug" renders in red and "Frontend" renders in its independent category color without being overwritten by the red color

### Requirement: Smooth target column displacement during drag and drop
The system SHALL provide smooth vertical displacement animations for cards in the target column during drag operations across kanban columns, dynamically shifting cards downward or upward to create space at the exact hover position before drop.

#### Scenario: User drags a card over a neighbor column
- **WHEN** user drags a card from Column A over the middle of Column B
- **THEN** cards in Column B below the drag cursor position smoothly translate downwards with CSS transitions
- **WHEN** the card is dropped
- **THEN** the card settles into the target index and updates its column and position

### Requirement: Card-level milestone color persistence
The system SHALL support storing an optional `milestone_color_hex` on `kanban` card payload, persisting it in the database and rendering the milestone badge accordingly.

#### Scenario: User saves a card with custom milestone color
- **WHEN** user sets a custom color `#10b981` on a card's milestone
- **THEN** `kanban.milestone_color_hex` is saved in `memo.payload` and returned in memo queries


