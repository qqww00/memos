## Context

Memos allows capturing thoughts and micro-notes with rich Markdown support. Currently, users can mention other users with `@username` and organize content with `#tags`. However, connecting related memos requires manually navigating to the metadata toolbar to create a `MemoRelation`. 

Introducing inline wiki-link mentions (`[[...]]`) provides a standard note-linking experience across both memo bodies and comments, tightly integrating with Memos' existing `MemoRelation` graph and `memo.property.title` extraction.

## Goals / Non-Goals

**Goals:**
- Enable wiki-link syntax `[[memos/{uid}|{title}]]` and `[[memos/{uid}]]` in Markdown content.
- Provide autocomplete suggestions in CodeMirror when the user types `[[`.
- Display rich interactive memo mention badges with hover previews in memo content and comments.
- Automatically synchronize inline memo mentions with `MemoRelation` (type: `REFERENCE`) on memo save.

**Non-Goals:**
- Inbox notifications for memo mentions (deferred per user requirement).
- Dynamic creation of new memos from unlinked titles (dead wiki-link creation).
- Dedicated schema changes for separate title fields in the database (leverages `# H1` extraction).

## Decisions

### 1. Wiki-Link Grammar and Parsing
- **Format**: `[[memos/{uid}|{title}]]`, `[[memos/{uid}]]`, and `[[{uid}]]`.
- **Parsing Layer**: Integrated into `web/src/utils/remark-plugins/remark-tag.ts` and `web/src/utils/memo-mention-grammar.ts` as an MDAST node type (`memoMention`).
- **Safety**: Opaque within code blocks, inline code, and math expressions (`$$` / `$`).

### 2. Memo Title Extraction & Display
- Memo titles are extracted from the first `# Heading 1` (as supported by `internal/markdown` and `memo.property.title`).
- If no heading exists, the autocomplete and display fall back to the memo snippet (truncated first non-empty line).

### 3. Editor Autocomplete Integration
- CodeMirror completion source listening to `[[` triggers.
- Debounced search querying `memoServiceClient.listMemos` with creator and content filter.
- Inserts `[[memos/{uid}|{title}]]` when selected.

### 4. Rendering & Hover Popover
- Rendered via a dedicated `MemoMention` component inside `web/src/components/MemoContent`.
- Utilizes Radix Popover / Tooltip or custom hover card displaying snippet, author, and timestamp.
- Navigation links directly to the `/memos/{uid}` route.

### 5. Automatic Relation Synchronization
- When saving a memo (`useMemoSave` / `memoService`), the content is scanned for `memos/{uid}` patterns.
- Extracted references are merged into `memo.relations` with `type: MemoRelation_Type.REFERENCE`.

## Risks / Trade-offs

- **[Risk]** High latency on large libraries during autocomplete.
  - **Mitigation**: Debounce search queries (300ms) with `pageSize: 20` and pre-filter by current user/protected scope.
- **[Risk]** False positive parsing inside code blocks or LaTeX formulas.
  - **Mitigation**: CodeMirror and Remark tokenizers mark code/math as opaque boundaries before parsing wiki-links.
