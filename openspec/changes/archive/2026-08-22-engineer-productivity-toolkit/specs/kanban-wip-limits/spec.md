## ADDED Requirements

### Requirement: Configure column WIP limit
The system SHALL allow users to set an optional maximum Work-In-Progress (WIP) card limit on any Kanban column.

#### Scenario: User sets WIP limit on a column
- **WHEN** user edits a column and enters a positive integer for WIP limit
- **THEN** the column stores the WIP limit and displays the count format `count/limit` in the column header

### Requirement: Visual warning when WIP limit is exceeded
The system SHALL visually alert the user when the number of active cards in a column exceeds its configured WIP limit.

#### Scenario: Column card count exceeds WIP limit
- **WHEN** the number of cards in a column is greater than its WIP limit
- **THEN** the column header displays a warning badge and highlighted background to indicate WIP limit breach without blocking card placement
