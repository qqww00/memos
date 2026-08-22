## ADDED Requirements

### Requirement: IDE deep link detection
The system SHALL detect local file path patterns (e.g. `src/foo/bar.ts:42`, `server/main.go`, `/path/to/file.go:10`) in code blocks or inline text and provide direct action links to open in VS Code or Cursor.

#### Scenario: User hovers or clicks on recognized file path
- **WHEN** a recognized source file path is rendered in memo content
- **THEN** an action link or badge is provided to trigger `vscode://file/<absolute_or_relative_path>:<line>` or `cursor://file/...`

### Requirement: Quick code snippet copy
The system SHALL enhance code blocks with quick-action utilities including copy-to-clipboard with formatted syntax detection.

#### Scenario: User clicks copy code block button
- **WHEN** user clicks the copy button in a code block
- **THEN** the raw code content is copied to clipboard and a brief visual confirmation is displayed
