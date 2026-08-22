## 1. Kanban Card Live Checklist Progress

- [x] 1.1 Implement `parseTaskLists(content: string)` utility to extract subtasks and calculate completed/total counts
- [x] 1.2 Add checklist progress indicator badge and mini progress bar to `KanbanCard.tsx`
- [x] 1.3 Implement interactive in-place checkbox toggling on `KanbanCard.tsx` with optimistic content updates

## 2. Engineering Templates (ADR, RFC, Spike, Incident, Code Review)

- [x] 2.1 Create `engineeringTemplates.ts` with structured templates (ADR, RFC, Spike, Incident Postmortem, Code Review)
- [x] 2.2 Add template selector dropdown menu to `InlineCardCreator.tsx`
- [x] 2.3 Add template insertion support in `MemoEditor` and `CreateBoardDialog`

## 3. Kanban Column WIP Limits

- [x] 3.1 Update column schema / state to support optional `wipLimit` configuration
- [x] 3.2 Update `ColumnHeader.tsx` to display `count/limit` and apply warning styles when limit is exceeded
- [x] 3.3 Add WIP limit input field in column create/edit dialogs

## 4. Developer Quick-Tools & Deep Linking

- [x] 4.1 Create file path parser and IDE deep-link generator utility (`vscode://`, `cursor://`)
- [x] 4.2 Integrate IDE launcher button on detected file path references in memo markdown
- [x] 4.3 Add one-click copy code snippet with language indicator in code blocks

## 5. Verification & Tests

- [x] 5.1 Add unit tests for task list parser and template insertion
- [x] 5.2 Add unit tests for WIP limit calculation and warning display
- [x] 5.3 Run `pnpm lint` and `pnpm test` across the test suite
