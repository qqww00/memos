## ADDED Requirements

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
