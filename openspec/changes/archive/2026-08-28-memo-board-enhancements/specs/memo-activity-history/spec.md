## ADDED Requirements

### Requirement: Board metadata changes are recorded in memo activity history
The system SHALL record an audit log entry in `memo.activities` whenever card metadata on a board is updated (such as category additions/removals/modifications, milestone assignments/changes, column moves, completion status toggles, or due date changes).

#### Scenario: User updates card category
- **WHEN** user updates a card's category from "Design" to "Backend"
- **THEN** an activity entry with type `UPDATE_CATEGORY`, timestamp, and description "Changed category from 'Design' to 'Backend'" is recorded and saved in the memo's payload

#### Scenario: User removes a category
- **WHEN** user removes the category "Urgent" from a card
- **THEN** an activity entry is recorded with description "Removed category 'Urgent'"

#### Scenario: User changes milestone
- **WHEN** user sets or changes the card milestone to "v1.0-release"
- **THEN** an activity entry is recorded with description "Set milestone to 'v1.0-release'"

#### Scenario: User moves card to another column
- **WHEN** user moves a card from column "Backlog" to "In Progress"
- **THEN** an activity entry is recorded with description "Moved card to 'In Progress'"

### Requirement: Activity history is displayed in the Memo Detail view
The system SHALL render a chronological activity history timeline under the memo detail view (`MemoDetailDialog`) displaying all logged updates with time and user context.

#### Scenario: User opens memo detail view
- **WHEN** user opens `MemoDetailDialog` for a card with past board changes
- **THEN** the dialog displays an Activity History section beneath the memo view showing each action with its formatted relative/exact timestamp
