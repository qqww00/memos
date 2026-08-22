# kanban-filtering Spec

## ADDED Requirements

### Requirement: CEL filter fields for kanban state
The system SHALL extend the memo filter schema with `kanban_board` (string), `kanban_column` (string), and `kanban_position` (double) fields backed by JSON paths within `memo.payload` (`$.kanban.boardId`, `$.kanban.columnId`, `$.kanban.position`), rendered to dialect-appropriate JSON extraction SQL for SQLite, MySQL, and PostgreSQL.

#### Scenario: Filter by board and column
- **WHEN** `ListMemos` is called with filter `kanban_board == "b1" && kanban_column == "todo"`
- **THEN** only memos whose payload kanban state matches both values are returned, on every supported database dialect

#### Scenario: Comparison on position
- **WHEN** `ListMemos` is called with filter `kanban_board == "b1" && kanban_position < 2.0`
- **THEN** memos in that board with positions below 2.0 are returned

### Requirement: Presence predicate for kanban state
The system SHALL support an `has_kanban` presence field rendered as a JSON key-existence check on `$.kanban`, following the existing `has_location` pattern: missing key and explicit JSON null both count as absent, and only boolean equality (or bare/negated use) is allowed.

#### Scenario: List all cards on any board
- **WHEN** `ListMemos` is called with filter `has_kanban`
- **THEN** all memos with kanban state are returned

#### Scenario: Find memos not on any board
- **WHEN** `ListMemos` is called with filter `!has_kanban`
- **THEN** memos without kanban state are returned and memos with kanban state are excluded

### Requirement: Existing filter behavior is unchanged
The system SHALL NOT alter the rendering, semantics, or validation of any pre-existing filter field; all additions SHALL be purely additive to the schema declaration and existing filter engine tests SHALL continue to pass unmodified.

#### Scenario: Legacy filter still compiles identically
- **WHEN** a filter such as `has_task_list && visibility == "PUBLIC"` is compiled before and after this change
- **THEN** the generated SQL and arguments are identical

### Requirement: Filter tests cover all dialects
The system SHALL include unit tests for the new kanban filter fields asserting the rendered SQL for SQLite, MySQL, and PostgreSQL, following the existing `internal/filter` test conventions.

#### Scenario: Dialect rendering matrix
- **WHEN** the new fields are rendered for each dialect
- **THEN** each dialect's SQL uses its native JSON access syntax (e.g. `json_extract`, `->>`, `JSON_EXTRACT`) as documented for existing payload fields
