## Why

Senior software engineers need high-level organizational structure beyond flat task lists: grouping related tasks under coherent Features/Epics with milestone tracking, and having instant access to reusable code snippets scattered across all engineering notes. This change introduces Feature-driven Kanban organization (badges, focus filtering, and roadmap summary) and a global Code Snippets Vault in the sidebar.

## What Changes

- **Feature-Driven Kanban Cards**:
  - Support associating cards with a Feature/Epic identifier (via `#feat/<name>` or `feat: <name>` syntax / category badge).
  - Render distinct Feature badges on Kanban cards with dedicated accent styling.
  - Add a Quick Focus Filter bar on Kanban boards to isolate tasks for a specific feature with a live milestone progress banner.
- **Features & Milestones Roadmap View**:
  - Add a multi-view switcher in Board detail: `[ 📌 Kanban Board | 🎯 Features & Milestones ]`.
  - In the Features tab, render aggregate feature cards showing completion percentage, linked task status (Todo, In Progress, Done), target dates, and one-click jump to filtered Kanban view.
- **Global Code Snippets Vault**:
  - Add a new **Snippets 💻** route in the sidebar with live snippet count.
  - Automatically extract and index code blocks across all memos with syntax highlighting, language tags (`Go`, `SQL`, `TypeScript`, `Bash`, `Python`, `Protobuf`, etc.), and line count.
  - Provide instant full-text search across code content and language filter chips.
  - Include one-click copy, IDE deep-link launcher, and direct navigation to the parent memo.

## Capabilities

### New Capabilities
- `feature-driven-kanban`: Card-level feature metadata, feature badge rendering, and Kanban header focus filter with milestone progress.
- `feature-roadmap-view`: Board-level Features & Milestones tab view displaying aggregate progress across all active feature tracks.
- `code-snippets-vault`: Global code snippet aggregator, search, language filtering, and sidebar integration across all memos.

### Modified Capabilities
<!-- None -->

## Impact

- **Frontend**:
  - `web/src/components/Boards/`: `KanbanCard.tsx`, `BoardDetail.tsx`, `cardUtils.ts`, new `FeaturesRoadmapView.tsx`.
  - `web/src/pages/`: new `Snippets.tsx` page.
  - `web/src/components/AppSidebar/`: add Snippets route and sidebar navigation row.
  - `web/src/router/routes.ts`: add `/snippets` route.
