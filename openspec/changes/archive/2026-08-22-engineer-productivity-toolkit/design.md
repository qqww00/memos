## Context

Senior engineers track tasks across multiple dimensions: high-level architecture decisions, technical investigations (spikes), incident timelines, and granular subtasks. The Kanban board is their primary visual work hub. Adding checklist progress directly to cards, providing engineering templates, supporting WIP limits, and enabling IDE deep-links creates a streamlined development environment inside Memos.

## Goals / Non-Goals

**Goals:**
- Parse and display markdown checklist items directly on Kanban cards with interactive toggle support.
- Provide a template library (ADR, RFC, Bug Spike, Incident Postmortem, Code Review) for fast note/card creation.
- Support optional WIP limits on board columns with warning indicators.
- Enable IDE deep linking (`vscode://` and `cursor://`) from file paths recognized in memos.

**Non-Goals:**
- Building a full Git/GitHub issue sync client (can be a separate future plugin).
- Blocking card drag/drop when WIP limits are exceeded (soft-limit / advisory warning only).

## Decisions

### 1. Checklist Extraction & In-Place Toggle
- **Decision**: Use a regex/AST utility `parseTaskLists(content: string)` to identify markdown checkboxes `- [ ]` and `- [x]`.
- **In-place toggle**: When a user clicks a subtask checkbox on a Kanban card, update the line in `memo.content` and dispatch `updateMemo({ update: { name, content }, updateMask: ["content"] })` with optimistic UI update.

### 2. Engineering Templates Architecture
- **Decision**: Define templates in a lightweight configuration module `web/src/components/Boards/engineeringTemplates.ts`.
- Include metadata (id, label, icon, category, default tags, markdown scaffold).
- Integrate as a dropdown trigger in `InlineCardCreator` and `MemoEditor`.

### 3. WIP Limits Storage
- **Decision**: Store WIP limit optionally on `BoardColumn` (e.g. `wipLimit?: number` or encoded in column configuration). Display `count/limit` in `ColumnHeader`.
- If `count > wipLimit`, apply warning badge styles (`border-warning`, text alert) to the column header without preventing drops.

### 4. IDE Deep Linking Protocol
- **Decision**: Recognize common file path patterns (e.g., `(path/to/file.ext)(:line)?`) and render an external tool icon with `vscode://file/...` or `cursor://file/...` href.

## Risks / Trade-offs

- **[Risk] Multiple subtasks toggle race condition**: Rapid toggling on the same card could lead to content overwrite conflicts.
  - **Mitigation**: Debounce or apply sequential optimistic patching against the latest cached content.
- **[Risk] IDE Protocol Handler compatibility**: Not all browsers/OSes handle `vscode://` smoothly without user permission.
  - **Mitigation**: Standard link anchor with tooltips indicating target editor.
