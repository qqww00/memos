## ADDED Requirements

### Requirement: Engineering template library
The system SHALL provide a structured set of pre-built engineering templates accessible from the memo creation interfaces and board card creator.

#### Scenario: User opens template selector
- **WHEN** user clicks the template picker icon in the card creator or memo editor
- **THEN** a menu is displayed with options: "ADR (Architecture Decision Record)", "RFC (Request for Comments)", "Technical Spike / Investigation", "Incident Postmortem", and "Code Review Checklist"

### Requirement: Template content injection
The system SHALL populate the editor with the chosen template's structured markdown content and placeholder sections.

#### Scenario: User selects ADR template
- **WHEN** user selects "ADR (Architecture Decision Record)"
- **THEN** the editor content is filled with title, Status, Context, Decision, Consequences, and Alternatives Considered sections

#### Scenario: User selects Spike template
- **WHEN** user selects "Technical Spike / Investigation"
- **THEN** the editor content is filled with Goal, Hypothesis, Findings, Performance / Benchmark Data, and Next Steps
