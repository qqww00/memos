## Context

Memos has a rich Kanban board system and markdown note-taking features. However, complex software projects require grouping tasks under higher-level Features/Epics with progress metrics, and developers frequently save code snippets across memos that are difficult to locate and reuse without a dedicated code vault.

## Goals / Non-Goals

**Goals:**
- Enable lightweight feature association on cards via tags/prefixes (`#feat/...`, `feat: ...`).
- Render Feature badges on cards with deterministic color generation.
- Add quick Feature focus filter and live milestone progress summary in Kanban header.
- Add a "Features & Milestones" tab in Board detail displaying aggregate progress for each feature.
- Build a global Code Snippets Vault (`/snippets`) that automatically extracts and aggregates code blocks from all memos with language filtering, search, copy, and source navigation.

**Non-Goals:**
- Heavy relational database schema migrations for epics (keeps the lightweight markdown-first architecture of Memos).
- Third-party Gist synchronization (all snippet data remains local/self-hosted in Memos).

## Decisions

1. **Feature Extraction in `cardUtils.ts`**:
   - `getCardFeatures(content: string): string[]`: Extracts `#feat/<name>` tags, `#feature/<name>`, or `feat: <name>`.
   - `getFeatureColor(featureName: string): string`: Returns deterministic color hue based on feature name hash.
   - *Rationale:* Zero schema changes required; works seamlessly with existing markdown memos and API.

2. **Features & Milestones Tab (`FeaturesRoadmapView.tsx`)**:
   - Integrated as a subview in `BoardDetail.tsx` toggled via `activeView: "kanban" | "features"`.
   - Automatically computes `totalCards`, `doneCards`, `percentComplete` per feature based on column status.
   - Includes "View in Kanban" button that switches back to Kanban view with the feature filter pre-applied.

3. **Global Code Snippets Vault (`Snippets.tsx` & `snippetUtils.ts`)**:
   - `extractSnippetsFromMemos(memos: Memo[])`: Scans markdown AST / regex for fenced code blocks.
   - Extracts: language, line count, snippet preview/title from preceding markdown heading or memo title, timestamp, and memo UID.
   - `Snippets.tsx` uses React Query (`useMemoList`) to fetch memos, memoizes snippet extraction, and provides instant client-side filtering by language and search keyword.

## Risks / Trade-offs

- [Performance with thousands of memos] → Memoized parsing with React `useMemo` and fast regex scanning ensures instantaneous filtering.
