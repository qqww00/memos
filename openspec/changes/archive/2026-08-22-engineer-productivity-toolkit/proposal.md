## Why

Senior software engineers manage complex technical decisions, investigation spikes, subtask tracking, and daily development workflows. Currently, Memos lacks quick-template scaffolding, visual subtask progression on Kanban cards, WIP limit guardrails to prevent multitasking overload, and deep-linking to local IDEs (VS Code/Cursor). Adding these features directly targets high-frequency developer workflows to minimize context switching and improve engineering velocity.

## What Changes

- **Kanban Card Live Checklist**:
  - Automatically parse Markdown task lists (`- [ ]`, `- [x]`) within memo content.
  - Render an interactive subtask progress indicator (e.g. `3/5 tasks`, progress bar) on the Kanban card.
  - Support direct checkbox toggling from the card without opening the modal.
- **Engineering Templates**:
  - Pre-defined, curated Markdown templates for developer workflows:
    - Architecture Decision Record (ADR)
    - Request for Comments (RFC)
    - Technical Spike / Bug Investigation
    - Incident Postmortem
    - Code Review Checklist
  - Template selector in memo creation and card creation flows.
- **Kanban Column WIP Limits**:
  - Optional WIP limit setting per column on Kanban boards (e.g., In Progress limit = 3).
  - Visual indicators and warning states when a column exceeds its configured WIP limit.
- **Developer Quick-Tools & Deep Linking**:
  - Auto-detection of local file paths with line numbers in memo content (e.g. `server/server.go:42`).
  - One-click deep-link launcher for VS Code (`vscode://file/...`) and Cursor (`cursor://file/...`).
  - Quick code copy with language indication.

## Capabilities

### New Capabilities
- `kanban-checklist-progress`: Markdown task list parsing, progress indicator, and interactive subtask toggling on Kanban cards.
- `engineering-templates`: Engineering-focused Markdown templates (ADR, RFC, Spike, Incident, Code Review) for card and memo creation.
- `kanban-wip-limits`: Configurable column WIP limits with visual warning badges and soft-limit enforcement.
- `dev-quick-tools`: File path deep-linking to IDEs (VS Code / Cursor) and developer-focused code snippet actions.

### Modified Capabilities
<!-- None: No existing specs in openspec/specs -->

## Impact

- **Frontend**:
  - `web/src/components/Boards/KanbanCard.tsx`: Checklist preview & progress bar.
  - `web/src/components/Boards/KanbanColumn.tsx` & `ColumnHeader.tsx`: WIP limit display & warning state.
  - `web/src/components/Boards/InlineCardCreator.tsx` & `MemoEditor`: Template insertion dropdown.
  - `web/src/components/MemoContent/`: File path pattern matching and IDE protocol links (`vscode://`, `cursor://`).
- **Protobuf / Backend**:
  - Proto update for `BoardColumn` if column `wip_limit` is persisted, or stored in board column metadata.
- **Dependencies**:
  - No heavy external dependencies required; uses existing Lucide icons, Tailwind, and React.
