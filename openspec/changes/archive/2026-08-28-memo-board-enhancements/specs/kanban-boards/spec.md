## ADDED Requirements

### Requirement: Persist category and milestone color mapping in database
The system SHALL persist custom category and milestone color associations in the database within `Board.category_colors` and `Board.milestone_colors` (`BOARDS` user setting).

#### Scenario: User saves a custom category color on a board
- **WHEN** user assigns a hex color `#ef4444` to category "Bug"
- **THEN** the board definition in `user_setting` records `category_colors["Bug"] = "#ef4444"` and returns it in `GetBoard` and `ListBoards`

#### Scenario: User saves a custom milestone color on a board
- **WHEN** user assigns a hex color `#6366f1` to milestone "Q3 Release"
- **THEN** the board definition records `milestone_colors["Q3 Release"] = "#6366f1"` and persists it in the database
