package test

import (
	"context"
	"strconv"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"

	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestUserBoards(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	// Initially no boards
	boards, err := ts.GetUserBoards(ctx, user.ID)
	require.NoError(t, err)
	require.Empty(t, boards)

	// Add a board
	board1 := &storepb.BoardsUserSetting_Board{
		Id:    "board-1",
		Title: "Website Revamp",
		Columns: []*storepb.BoardsUserSetting_BoardColumn{
			{Id: "col-todo", Title: "Todo"},
			{Id: "col-doing", Title: "In Progress"},
			{Id: "col-done", Title: "Done"},
		},
	}
	err = ts.UpsertUserBoard(ctx, user.ID, board1)
	require.NoError(t, err)

	// Verify board was added
	boards, err = ts.GetUserBoards(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, boards, 1)
	require.Equal(t, "Website Revamp", boards[0].Title)
	require.Len(t, boards[0].Columns, 3)

	// Add another board
	board2 := &storepb.BoardsUserSetting_Board{
		Id:    "board-2",
		Title: "Inbox Flow",
		Columns: []*storepb.BoardsUserSetting_BoardColumn{
			{Id: "col-in", Title: "New"},
		},
	}
	err = ts.UpsertUserBoard(ctx, user.ID, board2)
	require.NoError(t, err)

	boards, err = ts.GetUserBoards(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, boards, 2)

	// Replace board-1 (rename + column change)
	board1Updated := &storepb.BoardsUserSetting_Board{
		Id:    "board-1",
		Title: "Website Revamp v2",
		Columns: []*storepb.BoardsUserSetting_BoardColumn{
			{Id: "col-todo", Title: "Backlog"},
			{Id: "col-done", Title: "Done"},
		},
	}
	err = ts.UpsertUserBoard(ctx, user.ID, board1Updated)
	require.NoError(t, err)

	boards, err = ts.GetUserBoards(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, boards, 2)
	for _, board := range boards {
		if board.Id == "board-1" {
			require.Equal(t, "Website Revamp v2", board.Title)
			require.Len(t, board.Columns, 2)
			require.Equal(t, "Backlog", board.Columns[0].Title)
		}
	}

	// Get a single board
	found, err := ts.GetUserBoard(ctx, user.ID, "board-2")
	require.NoError(t, err)
	require.NotNil(t, found)
	require.Equal(t, "Inbox Flow", found.Title)

	// Get non-existent board
	missing, err := ts.GetUserBoard(ctx, user.ID, "non-existent")
	require.NoError(t, err)
	require.Nil(t, missing)

	// Remove a board
	removed, err := ts.RemoveUserBoard(ctx, user.ID, "board-1")
	require.NoError(t, err)
	require.True(t, removed)

	boards, err = ts.GetUserBoards(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, boards, 1)
	require.Equal(t, "board-2", boards[0].Id)

	// Removing again reports not found
	removed, err = ts.RemoveUserBoard(ctx, user.ID, "board-1")
	require.NoError(t, err)
	require.False(t, removed)

	ts.Close()
}

func TestUserBoardsConcurrentAdds(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	const boardCount = 16
	start := make(chan struct{})
	errCh := make(chan error, boardCount)
	var wg sync.WaitGroup
	for i := range boardCount {
		boardID := strconv.Itoa(i)
		wg.Go(func() {
			<-start
			errCh <- ts.UpsertUserBoard(ctx, user.ID, &storepb.BoardsUserSetting_Board{
				Id:    boardID,
				Title: "Board " + boardID,
				Columns: []*storepb.BoardsUserSetting_BoardColumn{
					{Id: "col-" + boardID, Title: "Todo"},
				},
			})
		})
	}
	close(start)
	wg.Wait()
	close(errCh)
	for err := range errCh {
		require.NoError(t, err)
	}

	boards, err := ts.GetUserBoards(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, boards, boardCount)
	seen := make(map[string]bool, boardCount)
	for _, board := range boards {
		require.False(t, seen[board.Id], "duplicate board %q", board.Id)
		seen[board.Id] = true
	}
}

func TestUserBoardsReturnsDefensiveClones(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	require.NoError(t, ts.UpsertUserBoard(ctx, user.ID, &storepb.BoardsUserSetting_Board{
		Id:    "board-1",
		Title: "Original title",
		Columns: []*storepb.BoardsUserSetting_BoardColumn{
			{Id: "col-1", Title: "Original column"},
		},
	}))

	firstRead, err := ts.GetUserBoards(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, firstRead, 1)
	firstRead[0].Title = "Mutated title"
	firstRead[0].Columns[0].Title = "Mutated column"

	secondRead, err := ts.GetUserBoards(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, secondRead, 1)
	require.Equal(t, "Original title", secondRead[0].Title)
	require.Equal(t, "Original column", secondRead[0].Columns[0].Title)

	single, err := ts.GetUserBoard(ctx, user.ID, "board-1")
	require.NoError(t, err)
	single.Title = "Mutated single"
	single.Columns[0].Title = "Mutated single column"

	singleAgain, err := ts.GetUserBoard(ctx, user.ID, "board-1")
	require.NoError(t, err)
	require.Equal(t, "Original title", singleAgain.Title)
	require.Equal(t, "Original column", singleAgain.Columns[0].Title)
}

func TestUserBoardsRoundTripSpecialCharacters(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	board := &storepb.BoardsUserSetting_Board{
		Id:        "board-special",
		Title:     `My "Special" & <Board> 🚀`,
		CreatedAt: timestamppb.Now(),
		Columns: []*storepb.BoardsUserSetting_BoardColumn{
			{Id: "col-1", Title: "你好", ColorHex: "#0969da"},
			{Id: "col-2", Title: `Quotes "and" backslash \`, ColorHex: ""},
		},
	}
	require.NoError(t, ts.UpsertUserBoard(ctx, user.ID, board))

	boards, err := ts.GetUserBoards(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, boards, 1)
	require.Equal(t, board.Title, boards[0].Title)
	require.Equal(t, board.Columns[0].Title, boards[0].Columns[0].Title)
	require.Equal(t, board.Columns[0].ColorHex, boards[0].Columns[0].ColorHex)
	require.Equal(t, board.Columns[1].Title, boards[0].Columns[1].Title)
	require.NotNil(t, boards[0].CreatedAt)
}

func TestUserBoardColorPersistence(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	user, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)

	board := &storepb.BoardsUserSetting_Board{
		Id:        "board-colors",
		Title:     "Color Test Board",
		CreatedAt: timestamppb.Now(),
		Columns: []*storepb.BoardsUserSetting_BoardColumn{
			{Id: "col-1", Title: "Todo"},
		},
		CategoryColors: map[string]string{
			"Bug":     "#ef4444",
			"Feature": "#3b82f6",
		},
		MilestoneColors: map[string]string{
			"v1.0": "#6366f1",
			"v2.0": "#10b981",
		},
	}
	require.NoError(t, ts.UpsertUserBoard(ctx, user.ID, board))

	savedBoard, err := ts.GetUserBoard(ctx, user.ID, "board-colors")
	require.NoError(t, err)
	require.NotNil(t, savedBoard)
	require.Equal(t, "#ef4444", savedBoard.CategoryColors["Bug"])
	require.Equal(t, "#3b82f6", savedBoard.CategoryColors["Feature"])
	require.Equal(t, "#6366f1", savedBoard.MilestoneColors["v1.0"])
	require.Equal(t, "#10b981", savedBoard.MilestoneColors["v2.0"])
}
