# kanban-boards Spec

## ADDED Requirements

### Requirement: Boards are stored without database migrations
The system SHALL persist board definitions entirely within the existing `user_setting` table under a new `BOARDS` setting key, and SHALL NOT introduce any database schema change (no new tables, columns, migrations, or `LATEST.sql` edits).

#### Scenario: Fresh install and upgraded instance share the same schema
- **WHEN** the server starts on a fresh database or on a database created before this feature
- **THEN** no migration is executed and board features operate identically on both

### Requirement: Multiple boards per user
The system SHALL allow each user to own zero or more boards, each identified by a server-generated stable id, a user-supplied title, and an ordered list of columns.

#### Scenario: User creates two boards
- **WHEN** the user creates boards "Inbox Flow" and "Website Revamp"
- **THEN** both boards appear in `ListBoards` for that user with distinct ids and independent column sets

#### Scenario: Board titles are unique per user
- **WHEN** the user creates a board whose title exactly matches an existing board title (case-insensitive)
- **THEN** the request is rejected with `InvalidArgument`

### Requirement: Board columns are manageable
The system SHALL support adding, renaming, reordering, recoloring, and removing columns via `UpdateBoard` with the `columns` field-mask path. Column order in the board definition SHALL define display order. A board SHALL always retain at least one column.

#### Scenario: Remove the last remaining column
- **WHEN** a board has one column and the user attempts to remove it
- **THEN** the request is rejected with `InvalidArgument` and the column remains

#### Scenario: Rename and reorder columns
- **WHEN** the user renames column "Todo" to "Backlog" and moves it after "Doing"
- **THEN** `GetBoard` returns the renamed column in the new position

### Requirement: Board deletion clears card state
The system SHALL, on `DeleteBoard`, make a best-effort pass over the deleting user's memos whose `kanban.board_id` references the deleted board and clear their `kanban` payload field.

#### Scenario: Delete a board containing cards
- **WHEN** the user deletes a board that has 5 memos assigned to its columns
- **THEN** subsequent `ListMemos` with `has_kanban` filter no longer returns those memos as kanban cards

#### Scenario: Stale kanban state is tolerated
- **WHEN** a memo still carries `kanban.board_id` referencing a board that no longer exists (e.g. sweep failed mid-run)
- **THEN** the frontend renders the memo as not-on-a-board and no error is surfaced to the user

### Requirement: Board access is owner-scoped
The system SHALL restrict all board read and write operations to the owning user (and super-admin override where conventions apply). Board RPC name resolution SHALL reject `users/{other}/boards/*` access with `PermissionDenied`.

#### Scenario: Another user reads a board
- **WHEN** user B calls `GetBoard` on `users/A/boards/1`
- **THEN** the request fails with `PermissionDenied`

### Requirement: Concurrent board edits are serialized
The system SHALL serialize read-modify-write cycles on the `BOARDS` user setting with a process-level mutex, following the existing `MEMO_VIEWS` pattern, so concurrent column edits cannot interleave and lose updates within one server process.

#### Scenario: Rapid column additions
- **WHEN** two concurrent `UpdateBoard` requests each add a different column
- **THEN** both columns are present in the resulting board definition
