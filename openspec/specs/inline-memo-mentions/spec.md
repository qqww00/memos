## ADDED Requirements

### Requirement: Wiki-Link Syntax Parsing
The system SHALL parse inline wiki-link patterns `[[memos/{uid}|{title}]]`, `[[memos/{uid}]]`, and `[[{uid}]]` in Markdown content across both memo bodies and comments.

#### Scenario: Parse memo wiki-link with custom title
- **WHEN** markdown content contains `[[memos/abc123|Sprint Roadmap]]`
- **THEN** parser identifies the token as a memo mention with target `memos/abc123` and display text `Sprint Roadmap`

#### Scenario: Parse memo wiki-link with memo identifier only
- **WHEN** markdown content contains `[[memos/abc123]]` or `[[abc123]]`
- **THEN** parser identifies the token as a memo mention with target `memos/abc123` and default display text derived from target

---

### Requirement: Editor Autocomplete for Memo Mentions
The system SHALL trigger an autocomplete popup when typing `[[` in the memo editor and comment inputs, allowing users to search and select existing memos.

#### Scenario: Trigger autocomplete and search by title or snippet
- **WHEN** user types `[[` followed by query text in the editor
- **THEN** system queries available memos matching the query by title or content and displays suggestions

#### Scenario: Selecting an autocomplete suggestion
- **WHEN** user selects a suggested memo from the dropdown
- **THEN** system inserts the formatted wiki-link `[[memos/{uid}|{title}]]` at the cursor position and closes the autocomplete popup

---

### Requirement: Memo Mention Rendering and Hover Preview
The system SHALL render memo wiki-links as styled interactive badges in memo view and comment sections, displaying a preview card on hover.

#### Scenario: Rendering interactive memo link
- **WHEN** a memo with wiki-links is displayed
- **THEN** the wiki-link renders as a badge with a memo icon and clickable link navigating to `/memos/{uid}`

#### Scenario: Hovering over memo mention
- **WHEN** user hovers over a memo mention badge
- **THEN** a popover preview card appears displaying the referenced memo's snippet, author, and timestamp

---

### Requirement: Automatic Relation Synchronization
The system SHALL detect outgoing memo references from the content upon saving a memo and automatically synchronize `MemoRelation` (Type: `REFERENCE`).

#### Scenario: Saving memo with inline mentions
- **WHEN** user saves a memo containing one or more valid memo wiki-links
- **THEN** system extracts the referenced memo resource names and updates `memo.relations` so backlinks are reflected in the sidebar
