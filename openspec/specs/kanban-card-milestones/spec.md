# Kanban Card Milestones Specification

## Requirements

### Requirement: First-Class Card Milestone Property
The system SHALL support an explicit `milestone` field on `Kanban` cards, enabling users to assign milestone targets (e.g., `v1.0 Launch`, `Sprint 24`) via card creation popovers and card detail editors.

#### Scenario: Card assigned a milestone renders milestone badge
- **WHEN** a Kanban card has `milestone` set
- **THEN** the Kanban card displays a styled `[ 🎯 MilestoneName ]` badge with deterministic accent coloring

### Requirement: Kanban Header Milestone Filter
The system SHALL provide a Milestone filter dropdown in the Board header allowing the user to isolate cards belonging to a specific Milestone and display an active milestone progress banner.

#### Scenario: User selects a milestone filter
- **WHEN** the user selects a specific milestone from the Milestone filter dropdown
- **THEN** only cards belonging to that milestone are displayed in the columns, and a Milestone progress summary banner is displayed
