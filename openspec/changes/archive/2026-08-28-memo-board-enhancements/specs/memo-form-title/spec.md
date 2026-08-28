## ADDED Requirements

### Requirement: Memo editor supports dedicated form title input
The system SHALL provide an optional Title input in the memo editor (`MemoEditor`). When a title is specified, it SHALL be synchronized with the Markdown content's first H1 heading (`# Title`) upon save and edit.

#### Scenario: User enters a title and content in editor
- **WHEN** the user types "Project Roadmap" in the Title input and "Here are the milestones." in the content area
- **THEN** saving the memo formats the Markdown as `# Project Roadmap\n\nHere are the milestones.` and sets `memo.property.title` to "Project Roadmap"

#### Scenario: User opens an existing memo with an H1 heading
- **WHEN** an existing memo starting with `# Sprint 1 Goals\n\nTasks to complete` is opened in the editor
- **THEN** the Title input is pre-populated with "Sprint 1 Goals" and the content area displays "Tasks to complete"

#### Scenario: User leaves title empty
- **WHEN** the user leaves the Title input empty and enters arbitrary markdown content
- **THEN** the memo content is saved directly without prepending a title heading

### Requirement: Board card creation dialogs support dedicated title input
The system SHALL provide a dedicated Title input in `InlineCardCreator` and `AddMemoToBoardDialog`.

#### Scenario: Create card from board with title
- **WHEN** user types "Implement Auth" into the Title input of `InlineCardCreator` with description "Use JWT tokens"
- **THEN** the created memo's content starts with `# Implement Auth\n\nUse JWT tokens` and displays "Implement Auth" as the card title on the board
