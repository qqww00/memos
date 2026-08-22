package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

func createTestBoard(t *testing.T, ts *TestService, ctx context.Context, username string, title string) *v1pb.Board {
	t.Helper()
	board, err := ts.Service.CreateBoard(ctx, &v1pb.CreateBoardRequest{
		Parent: fmt.Sprintf("users/%s", username),
		Board:  &v1pb.Board{Title: title},
	})
	require.NoError(t, err)
	return board
}

func TestBoardCRUD(t *testing.T) {
	ctx := context.Background()

	t.Run("create with default columns", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		board := createTestBoard(t, ts, userCtx, user.Username, "Website Revamp")
		require.NotEmpty(t, board.Name)
		require.Equal(t, "Website Revamp", board.Title)
		require.Len(t, board.Columns, 3)
		require.Equal(t, "Todo", board.Columns[0].Title)
		require.Equal(t, "In Progress", board.Columns[1].Title)
		require.Equal(t, "Done", board.Columns[2].Title)
		for _, column := range board.Columns {
			require.NotEmpty(t, column.Id)
		}
		require.NotNil(t, board.CreateTime)
	})

	t.Run("create with custom columns", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		board, err := ts.Service.CreateBoard(userCtx, &v1pb.CreateBoardRequest{
			Parent: fmt.Sprintf("users/%s", user.Username),
			Board: &v1pb.Board{
				Title: "Custom",
				Columns: []*v1pb.BoardColumn{
					{Title: "Icebox", ColorHex: "#0969da"},
					{Title: "Ship"},
				},
			},
		})
		require.NoError(t, err)
		require.Len(t, board.Columns, 2)
		require.Equal(t, "Icebox", board.Columns[0].Title)
		require.Equal(t, "#0969da", board.Columns[0].ColorHex)
	})

	t.Run("title required and unique per user", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		_, err = ts.Service.CreateBoard(userCtx, &v1pb.CreateBoardRequest{
			Parent: fmt.Sprintf("users/%s", user.Username),
			Board:  &v1pb.Board{Title: "   "},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "title is required")

		createTestBoard(t, ts, userCtx, user.Username, "Unique Title")
		_, err = ts.Service.CreateBoard(userCtx, &v1pb.CreateBoardRequest{
			Parent: fmt.Sprintf("users/%s", user.Username),
			Board:  &v1pb.Board{Title: "unique title"},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "already exists")

		// Same title is fine for a different user.
		other, err := ts.CreateRegularUser(ctx, "otheruser")
		require.NoError(t, err)
		otherCtx := ts.CreateUserContext(ctx, other.ID)
		createTestBoard(t, ts, otherCtx, other.Username, "Unique Title")
	})

	t.Run("permission denied across users", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user1, err := ts.CreateRegularUser(ctx, "user1")
		require.NoError(t, err)
		user2, err := ts.CreateRegularUser(ctx, "user2")
		require.NoError(t, err)

		user1Ctx := ts.CreateUserContext(ctx, user1.ID)
		board := createTestBoard(t, ts, user1Ctx, user1.Username, "Mine")

		user2Ctx := ts.CreateUserContext(ctx, user2.ID)
		_, err = ts.Service.GetBoard(user2Ctx, &v1pb.GetBoardRequest{Name: board.Name})
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")

		_, err = ts.Service.ListBoards(user2Ctx, &v1pb.ListBoardsRequest{Parent: fmt.Sprintf("users/%s", user1.Username)})
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")

		_, err = ts.Service.UpdateBoard(user2Ctx, &v1pb.UpdateBoardRequest{
			Board:      &v1pb.Board{Name: board.Name, Title: "Hacked"},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"title"}},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")

		_, err = ts.Service.DeleteBoard(user2Ctx, &v1pb.DeleteBoardRequest{Name: board.Name})
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})

	t.Run("update title and columns, keep at least one column", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)
		board := createTestBoard(t, ts, userCtx, user.Username, "Original")

		updated, err := ts.Service.UpdateBoard(userCtx, &v1pb.UpdateBoardRequest{
			Board: &v1pb.Board{
				Name:  board.Name,
				Title: "Renamed",
				Columns: []*v1pb.BoardColumn{
					{Id: board.Columns[0].Id, Title: "Backlog"},
					{Id: board.Columns[2].Id, Title: "Done"},
				},
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"title", "columns"}},
		})
		require.NoError(t, err)
		require.Equal(t, "Renamed", updated.Title)
		require.Len(t, updated.Columns, 2)
		require.Equal(t, board.Columns[0].Id, updated.Columns[0].Id)
		require.Equal(t, "Backlog", updated.Columns[0].Title)

		_, err = ts.Service.UpdateBoard(userCtx, &v1pb.UpdateBoardRequest{
			Board:      &v1pb.Board{Name: board.Name, Columns: []*v1pb.BoardColumn{}},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"columns"}},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "at least one column")

		_, err = ts.Service.UpdateBoard(userCtx, &v1pb.UpdateBoardRequest{
			Board:      &v1pb.Board{Name: board.Name, Columns: []*v1pb.BoardColumn{{Title: ""}}},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"columns"}},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "column title is required")

		_, err = ts.Service.UpdateBoard(userCtx, &v1pb.UpdateBoardRequest{
			Board:      &v1pb.Board{Name: board.Name},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"unexpected"}},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "unsupported update mask path")
	})

	t.Run("delete board", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)
		board := createTestBoard(t, ts, userCtx, user.Username, "Doomed")

		_, err = ts.Service.DeleteBoard(userCtx, &v1pb.DeleteBoardRequest{Name: board.Name})
		require.NoError(t, err)

		_, err = ts.Service.GetBoard(userCtx, &v1pb.GetBoardRequest{Name: board.Name})
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found")

		_, err = ts.Service.DeleteBoard(userCtx, &v1pb.DeleteBoardRequest{Name: board.Name})
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found")
	})
}

func TestKanbanCards(t *testing.T) {
	ctx := context.Background()

	newMemo := func(t *testing.T, ts *TestService, ctx context.Context, content string) *v1pb.Memo {
		t.Helper()
		memo, err := ts.Service.CreateMemo(ctx, &v1pb.CreateMemoRequest{
			Memo: &v1pb.Memo{Content: content, Visibility: v1pb.Visibility_PRIVATE},
		})
		require.NoError(t, err)
		return memo
	}

	t.Run("assign, move, and clear via UpdateMemo", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)
		board := createTestBoard(t, ts, userCtx, user.Username, "Board")
		memo := newMemo(t, ts, userCtx, "#work first card")

		// Assign to the first column.
		updated, err := ts.Service.UpdateMemo(userCtx, &v1pb.UpdateMemoRequest{
			Memo: &v1pb.Memo{
				Name: memo.Name,
				Kanban: &v1pb.Kanban{
					BoardId:  boardNameID(board.Name),
					ColumnId: board.Columns[0].Id,
					Position: 1.0,
				},
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"kanban"}},
		})
		require.NoError(t, err)
		require.NotNil(t, updated.Kanban)
		require.Equal(t, board.Columns[0].Id, updated.Kanban.ColumnId)
		require.Equal(t, 1.0, updated.Kanban.Position)
		require.Equal(t, memo.Content, updated.Content)

		// Move to the second column with a new position.
		updated, err = ts.Service.UpdateMemo(userCtx, &v1pb.UpdateMemoRequest{
			Memo: &v1pb.Memo{
				Name: memo.Name,
				Kanban: &v1pb.Kanban{
					BoardId:  boardNameID(board.Name),
					ColumnId: board.Columns[1].Id,
					Position: 2.5,
				},
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"kanban"}},
		})
		require.NoError(t, err)
		require.Equal(t, board.Columns[1].Id, updated.Kanban.ColumnId)

		// Clear with an empty kanban message.
		updated, err = ts.Service.UpdateMemo(userCtx, &v1pb.UpdateMemoRequest{
			Memo:       &v1pb.Memo{Name: memo.Name, Kanban: &v1pb.Kanban{}},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"kanban"}},
		})
		require.NoError(t, err)
		require.Nil(t, updated.Kanban)
	})

	t.Run("kanban target validation", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)
		board := createTestBoard(t, ts, userCtx, user.Username, "Board")
		memo := newMemo(t, ts, userCtx, "validation target")

		_, err = ts.Service.UpdateMemo(userCtx, &v1pb.UpdateMemoRequest{
			Memo: &v1pb.Memo{
				Name: memo.Name,
				Kanban: &v1pb.Kanban{
					BoardId:  "nonexistent-board",
					ColumnId: board.Columns[0].Id,
				},
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"kanban"}},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "board not found")

		_, err = ts.Service.UpdateMemo(userCtx, &v1pb.UpdateMemoRequest{
			Memo: &v1pb.Memo{
				Name: memo.Name,
				Kanban: &v1pb.Kanban{
					BoardId:  boardNameID(board.Name),
					ColumnId: "nonexistent-column",
				},
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"kanban"}},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "column not found")

		// kanban mask path without a kanban message is rejected.
		_, err = ts.Service.UpdateMemo(userCtx, &v1pb.UpdateMemoRequest{
			Memo:       &v1pb.Memo{Name: memo.Name},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"kanban"}},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "kanban must be set")
	})

	t.Run("content edit preserves kanban state", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)
		board := createTestBoard(t, ts, userCtx, user.Username, "Board")
		memo := newMemo(t, ts, userCtx, "#work original")

		_, err = ts.Service.UpdateMemo(userCtx, &v1pb.UpdateMemoRequest{
			Memo: &v1pb.Memo{
				Name: memo.Name,
				Kanban: &v1pb.Kanban{
					BoardId:  boardNameID(board.Name),
					ColumnId: board.Columns[0].Id,
					Position: 3.0,
				},
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"kanban"}},
		})
		require.NoError(t, err)

		edited, err := ts.Service.UpdateMemo(userCtx, &v1pb.UpdateMemoRequest{
			Memo:       &v1pb.Memo{Name: memo.Name, Content: "#work edited #urgent"},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"content"}},
		})
		require.NoError(t, err)
		require.NotNil(t, edited.Kanban)
		require.Equal(t, board.Columns[0].Id, edited.Kanban.ColumnId)
		require.Equal(t, 3.0, edited.Kanban.Position)
		require.Equal(t, []string{"work", "urgent"}, edited.Tags)
	})

	t.Run("board delete sweeps kanban state and filters find cards", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateRegularUser(ctx, "testuser")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)
		board := createTestBoard(t, ts, userCtx, user.Username, "Sweep Me")
		boardID := boardNameID(board.Name)

		memo1 := newMemo(t, ts, userCtx, "card one")
		memo2 := newMemo(t, ts, userCtx, "card two")
		for i, memo := range []*v1pb.Memo{memo1, memo2} {
			_, err = ts.Service.UpdateMemo(userCtx, &v1pb.UpdateMemoRequest{
				Memo: &v1pb.Memo{
					Name: memo.Name,
					Kanban: &v1pb.Kanban{
						BoardId:  boardID,
						ColumnId: board.Columns[0].Id,
						Position: float64(i + 1),
					},
				},
				UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"kanban"}},
			})
			require.NoError(t, err)
		}

		// The kanban CEL filter finds the cards through the real SQLite driver.
		filter := fmt.Sprintf("kanban_board == %q && kanban_column == %q", boardID, board.Columns[0].Id)
		listResp, err := ts.Service.ListMemos(userCtx, &v1pb.ListMemosRequest{Filter: filter})
		require.NoError(t, err)
		require.Len(t, listResp.Memos, 2)

		hasKanbanResp, err := ts.Service.ListMemos(userCtx, &v1pb.ListMemosRequest{Filter: "has_kanban"})
		require.NoError(t, err)
		require.Len(t, hasKanbanResp.Memos, 2)

		// Delete the board; cards keep existing but lose kanban state.
		_, err = ts.Service.DeleteBoard(userCtx, &v1pb.DeleteBoardRequest{Name: board.Name})
		require.NoError(t, err)

		swept, err := ts.Service.ListMemos(userCtx, &v1pb.ListMemosRequest{Filter: "has_kanban"})
		require.NoError(t, err)
		require.Empty(t, swept.Memos)

		got, err := ts.Service.GetMemo(userCtx, &v1pb.GetMemoRequest{Name: memo1.Name})
		require.NoError(t, err)
		require.Nil(t, got.Kanban)
		require.Equal(t, "card one", got.Content)
	})
}

// boardNameID extracts the board id from a "users/{user}/boards/{board}" name.
func boardNameID(name string) string {
	parts := splitName(name)
	if len(parts) != 4 {
		return ""
	}
	return parts[3]
}

func splitName(name string) []string {
	var parts []string
	start := 0
	for i := 0; i < len(name); i++ {
		if name[i] == '/' {
			parts = append(parts, name[start:i])
			start = i + 1
		}
	}
	return append(parts, name[start:])
}
