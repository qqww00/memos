# Milestones Roadmap View Specification

## Requirements

### Requirement: Board View Switcher
The system SHALL provide a view switcher in BoardDetail between `Kanban` View and `Milestones Roadmap` View.

#### Scenario: User toggles to Milestones Roadmap view
- **WHEN** the user clicks the "Milestones Roadmap" button in the board header
- **THEN** the view switches from Kanban columns to the aggregate milestone tracks list

### Requirement: Milestone Aggregate Progress and Connected Cards
The system SHALL group cards by milestone, calculate completion percentage (Done cards / Total cards), and list connected tasks with their current column status and target deadline.

#### Scenario: Jump to filtered Kanban from milestone track
- **WHEN** user clicks "View Kanban" on a milestone track
- **THEN** the system switches to the Kanban view pre-filtered to that milestone
