## 1. Wiki-Link Grammar & Markdown Parser

- [x] 1.1 Create `memo-mention-grammar.ts` to parse `[[memos/{uid}|{title}]]`, `[[memos/{uid}]]`, and `[[{uid}]]` patterns
- [x] 1.2 Extend `remark-tag.ts` and AST types to support `memoMention` nodes in Markdown pipeline
- [x] 1.3 Add unit tests for memo wiki-link grammar and markdown AST transformations

## 2. Editor Autocomplete & Decorations

- [x] 2.1 Implement CodeMirror autocomplete source in `memoMentionAutocomplete.ts` triggered by `[[`
- [x] 2.2 Add syntax highlight decorations for `[[...]]` ranges in editor view
- [x] 2.3 Register autocomplete and decoration extensions in `MemoEditor/Editor/extensions.ts`

## 3. Memo Mention UI & Hover Preview

- [x] 3.1 Create `MemoMention.tsx` component with styled badge, memo icon, and router navigation
- [x] 3.2 Add hover preview popover displaying referenced memo snippet, creator, and timestamp
- [x] 3.3 Wire `MemoMention` into `MemoMarkdownRenderer.tsx` and verify in memo body and comments

## 4. Automatic Relation Synchronization & Tests

- [x] 4.1 Implement extraction utility to parse referenced memo UIDs from Markdown content
- [x] 4.2 Connect automatic relation syncing in `memoService.ts` to update `MemoRelation` (Type: `REFERENCE`) on save
- [x] 4.3 Add component and integration tests verifying mention autocomplete, rendering, and relation extraction
