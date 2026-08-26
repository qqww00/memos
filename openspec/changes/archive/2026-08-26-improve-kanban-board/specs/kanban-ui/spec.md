## ADDED Requirements

### Requirement: Dropdown selectors for board categories and milestones with color indicators
The system SHALL provide dropdown selectors in the card detail dialog for selecting existing board categories (multi-select) and board milestones (single-select), each displaying a right-aligned color indicator for every option.

#### Scenario: Select category from dropdown in card detail
- **WHEN** the user opens the categories dropdown in the card detail dialog
- **THEN** the dropdown shows available board categories with checkmarks for selected ones and color dots on the right of each item

#### Scenario: Select milestone from dropdown in card detail
- **WHEN** the user opens the milestones dropdown in the card detail dialog
- **THEN** the dropdown displays available board milestones with a clear option, active selection checkmark, and right-aligned milestone color dots

### Requirement: Authenticated root landing displays boards
The system SHALL display the Boards page when an authenticated user navigates to the root path `/`.

#### Scenario: Authenticated user visits root URL
- **WHEN** an authenticated user opens `/`
- **THEN** the system displays the Boards view
