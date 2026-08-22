## ADDED Requirements

### Requirement: Global Code Block Extraction
The system SHALL scan all memos to extract code blocks with detected language, line count, snippet preview text, and parent memo reference.

#### Scenario: Memo containing code blocks is indexed
- **WHEN** memos contain fenced code blocks (e.g. ```go ... ```)
- **THEN** the Snippets Vault aggregates each code snippet with language, line count, and snippet title/preview

### Requirement: Snippets Vault Sidebar Route and Interface
The system SHALL provide a `/snippets` route accessible from the sidebar displaying snippet count, language filter chips, full-text search, syntax highlighting, one-click copy, and parent memo links.

#### Scenario: Filtering snippets by language
- **WHEN** the user selects the "Go" language filter chip
- **THEN** only code snippets with language "go" are displayed in the vault

#### Scenario: Copying snippet code
- **WHEN** user clicks "Copy Code" on a snippet card
- **THEN** the exact code content is copied to clipboard with feedback
