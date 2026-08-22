## ADDED Requirements

### Requirement: Board Multi-View Switcher
The system SHALL provide a view toggle in BoardDetail between Kanban View and Features & Milestones View.

#### Scenario: User toggles to Features & Milestones view
- **WHEN** the user clicks the "Features & Milestones" tab in the board header
- **THEN** the view switches from Kanban columns to the aggregate feature tracks list

### Requirement: Feature Aggregate Progress and Connected Cards
The system SHALL group cards by feature, calculate completion percentage (Done cards / Total cards), and list connected tasks with their current column status.

#### Scenario: Displaying feature progress card
- **WHEN** cards under a feature have 3 completed and 1 in-progress card
- **THEN** the feature card displays 75% progress bar, count `3/4 Done`, and the list of card titles with status indicators

#### Scenario: Jump to filtered Kanban from feature card
- **WHEN** user clicks "View in Kanban" on a feature card
- **THEN** the system switches to the Kanban view pre-filtered to that feature
