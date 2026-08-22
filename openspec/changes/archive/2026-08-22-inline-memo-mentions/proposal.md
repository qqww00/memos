## Why

Memos currently supports user mentions (`@username`) and tags (`#tag`), but lacks a native, frictionless way to reference or mention other memos inline within memo bodies and comments. Users need a wiki-link referencing mechanism (`[[Judul Memo]]` or `[[memos/id|Judul Memo]]`) to cross-link ideas, reference relevant discussions in comments, and navigate knowledge seamlessly.

## What Changes

- **Memo Title Referencing**: Uses the existing first `# H1` heading as the canonical memo title (with graceful fallback to snippet/first-line if no H1 heading is present) for search and display.
- **Inline Wiki-Link Syntax**: Supports `[[memos/uid|Title]]`, `[[memos/uid]]`, or `[[Title]]` syntax in both memos and comments.
- **Editor Autocomplete for Memos**: Typing `[[` in the memo editor or comment input opens an autocomplete popup to search memos by title/content and insert the wiki-link.
- **Rendered Memo Mention Link & Hover Preview**: Renders wiki-links as styled inline badges/links with memo icons and provides a hover preview card showing the referenced memo's snippet, date, and author.
- **Automatic Relation Sync**: When a memo containing wiki-links is saved, outgoing `MemoRelation` (Type: `REFERENCE`) are automatically created/updated, enabling backlink discovery in the sidebar.

## Capabilities

### New Capabilities
- `inline-memo-mentions`: Core inline wiki-link grammar, editor autocomplete popover for `[[`, markdown AST transformation, hover preview card, comment support, and automatic relation syncing.

### Modified Capabilities
<!-- None -->

## Impact

- **Frontend**:
  - CodeMirror editor extensions for `[[` autocomplete and syntax decorations.
  - Remark/Rehype markdown pipeline plugins for parsing wiki-link nodes.
  - Render components for memo mention badge and popover preview in memo views and comments.
  - Editor save pipelines to sync detected inline relations with `memo.relations`.
- **Backend / API**:
  - Leverages existing `MemoService` (`ListMemos`, `SetMemoRelations`, `memo.property.title`). No breaking API changes or database migrations required.
