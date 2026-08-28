## Context

Memos provides markdown note-taking and Kanban board management. Currently, cards on a board have dynamic metadata (columns, categories, milestones, completion state, and due dates). However:
1. Title editing in the memo editor requires typing markdown headings manually rather than using an explicit form field.
2. Category and milestone color definitions are generated client-side by hashing strings or held transiently, rather than persisted to the database.
3. Cross-column dragging in Kanban does not displace items in real time during drag over.
4. Updates made to board metadata do not record audit history entries.

## Goals / Non-Goals

**Goals:**
- Provide a dedicated Title input in `MemoEditor`, `InlineCardCreator`, and `AddMemoToBoardDialog` that syncs bidirectionally with Markdown H1 headings.
- Persist category and milestone color definitions in the database via `Board.category_colors` and `Board.milestone_colors` in `BoardsUserSetting`, plus `milestone_color_hex` in `KanbanPayload`.
- Implement smooth real-time downward/vertical displacement animations in target columns when dragging cards across columns with `@dnd-kit`.
- Automatically log board metadata updates (category change, milestone change, column move, completion status, due date) as persistent `Activity` items in `memo.payload` and render an Activity History section in `MemoDetailDialog`.

**Non-Goals:**
- Creating a separate SQL table for activities (storing in `memo.payload` keeps schema migration-free and self-contained).
- Breaking existing Markdown parsing or `memo.property.title` contracts.

## Decisions

### Decision 1: Title Form Synchronization via Markdown H1
- *Approach*: Keep storage in `memo.content` using standard `# <title>\n\n<body content>`. The UI provides an explicit Title input field. When the editor initializes, if the content starts with an H1 heading, the title field is populated and stripped from the body input for a clean editing experience. When saving, the title is prepended as `# <title>\n\n` if present.
- *Alternatives considered*: Adding a new `title` column in the database (would require migrations across SQLite, Postgres, MySQL and breaking changes to existing raw markdown notes).

### Decision 2: Board & Card Color Storage in Database
- *Approach*: Extend protobuf `Board` and `BoardsUserSetting.Board` with `map<string, string> category_colors` and `map<string, string> milestone_colors`. Extend `Kanban` / `KanbanPayload` with `optional string milestone_color_hex`.
- *Alternatives considered*: Storing color mappings only in local storage (does not sync across devices or multiple users).

### Decision 3: Smooth Drag-and-Drop Animations with @dnd-kit
- *Approach*: In `KanbanCard.tsx`, enable `transition` CSS and default layout animations. In `BoardDetail.tsx`, use `onDragOver` in `DndContext` to calculate dynamic over index and update active column items so target column cards translate smoothly down/up before drop.
- *Alternatives considered*: Custom manual drag listeners (re-inventing sortable context).

### Decision 4: Audit Activity History in Memo Payload
- *Approach*: Store `repeated Activity activities` in `Memo` and `MemoPayload`. In `server/router/api/v1/memo_service.go`, when `kanban` is updated, compute the diff against previous kanban state and append an activity entry (type, description, timestamp, creator). `MemoDetailDialog` renders these entries chronologically.
- *Alternatives considered*: Ephemeral notification hub (not permanent history).

## Risks / Trade-offs

- [Risk] Concurrent board drag or edits overwriting activity history.
  → Mitigation: Backend preserves existing activities and appends new activity records during `UpdateMemo`.
- [Risk] Markdown title extraction edge cases (e.g. multi-line H1).
  → Mitigation: Standardize first-line `# Title` regex stripping and formatting, matching `internal/markdown` heading parser.
