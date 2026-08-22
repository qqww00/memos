## ADDED Requirements

### Requirement: Card Feature Extraction and Badge
The system SHALL extract feature associations from memo content (using `#feat/<name>`, `#feature/<name>`, or `feat: <name>` markers) and render a distinct Feature badge on the Kanban card.

#### Scenario: Memo with feature tag renders feature badge
- **WHEN** a memo content includes `#feat/auth` or `feat: Authentication`
- **THEN** the Kanban card displays a styled badge with the feature name and assigned color

#### Scenario: Memo without feature tag
- **WHEN** a memo content contains no feature tag or prefix
- **THEN** no feature badge is rendered on the card

### Requirement: Kanban Header Feature Focus Filter
The system SHALL provide a Feature filter in the Board header allowing the user to isolate cards belonging to a specific Feature.

#### Scenario: User selects a feature filter
- **WHEN** the user selects a specific feature from the Feature filter list
- **THEN** only cards belonging to that feature are displayed in the columns, and a Feature Milestone progress summary banner is displayed
