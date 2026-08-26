## ADDED Requirements

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
