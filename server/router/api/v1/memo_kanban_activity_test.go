package v1

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"

	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestGenerateKanbanActivities(t *testing.T) {
	s := &APIV1Service{}
	ctx := context.Background()

	t.Run("Category updated from A to B", func(t *testing.T) {
		catA := "Bug"
		catB := "Feature"
		oldK := &storepb.MemoPayload_KanbanPayload{
			BoardId:  "board-1",
			ColumnId: "col-1",
			Category: &catA,
		}
		newK := &storepb.MemoPayload_KanbanPayload{
			BoardId:  "board-1",
			ColumnId: "col-1",
			Category: &catB,
		}

		activities := s.generateKanbanActivities(ctx, 1, oldK, newK, "alice")
		require.Len(t, activities, 1)
		require.Equal(t, "UPDATE_CATEGORY", activities[0].Type)
		require.Equal(t, "Changed category from 'Bug' to 'Feature'", activities[0].Description)
		require.Equal(t, "users/alice", activities[0].Creator)
	})

	t.Run("Category removed", func(t *testing.T) {
		catA := "Bug"
		oldK := &storepb.MemoPayload_KanbanPayload{
			BoardId:  "board-1",
			ColumnId: "col-1",
			Category: &catA,
		}
		newK := &storepb.MemoPayload_KanbanPayload{
			BoardId:  "board-1",
			ColumnId: "col-1",
		}

		activities := s.generateKanbanActivities(ctx, 1, oldK, newK, "alice")
		require.Len(t, activities, 1)
		require.Equal(t, "UPDATE_CATEGORY", activities[0].Type)
		require.Equal(t, "Removed category 'Bug'", activities[0].Description)
	})

	t.Run("Category added", func(t *testing.T) {
		catA := "Urgent"
		oldK := &storepb.MemoPayload_KanbanPayload{
			BoardId:  "board-1",
			ColumnId: "col-1",
		}
		newK := &storepb.MemoPayload_KanbanPayload{
			BoardId:    "board-1",
			ColumnId:   "col-1",
			Categories: []string{catA},
		}

		activities := s.generateKanbanActivities(ctx, 1, oldK, newK, "bob")
		require.Len(t, activities, 1)
		require.Equal(t, "UPDATE_CATEGORY", activities[0].Type)
		require.Equal(t, "Added category 'Urgent'", activities[0].Description)
	})

	t.Run("Milestone set, changed and removed", func(t *testing.T) {
		m1 := "v1.0"
		m2 := "v2.0"
		oldK := &storepb.MemoPayload_KanbanPayload{BoardId: "b", ColumnId: "c"}
		newK := &storepb.MemoPayload_KanbanPayload{BoardId: "b", ColumnId: "c", Milestone: &m1}

		act1 := s.generateKanbanActivities(ctx, 1, oldK, newK, "alice")
		require.Len(t, act1, 1)
		require.Equal(t, "Set milestone to 'v1.0'", act1[0].Description)

		act2 := s.generateKanbanActivities(ctx, 1, newK, &storepb.MemoPayload_KanbanPayload{BoardId: "b", ColumnId: "c", Milestone: &m2}, "alice")
		require.Len(t, act2, 1)
		require.Equal(t, "Changed milestone from 'v1.0' to 'v2.0'", act2[0].Description)

		act3 := s.generateKanbanActivities(ctx, 1, newK, oldK, "alice")
		require.Len(t, act3, 1)
		require.Equal(t, "Removed milestone 'v1.0'", act3[0].Description)
	})

	t.Run("Status closed and reopened", func(t *testing.T) {
		closed := true
		open := false
		oldK := &storepb.MemoPayload_KanbanPayload{BoardId: "b", ColumnId: "c", IsClosed: &open}
		newK := &storepb.MemoPayload_KanbanPayload{BoardId: "b", ColumnId: "c", IsClosed: &closed}

		actClosed := s.generateKanbanActivities(ctx, 1, oldK, newK, "alice")
		require.Len(t, actClosed, 1)
		require.Equal(t, "UPDATE_STATUS", actClosed[0].Type)
		require.Equal(t, "Marked card as completed", actClosed[0].Description)

		actReopen := s.generateKanbanActivities(ctx, 1, newK, oldK, "alice")
		require.Len(t, actReopen, 1)
		require.Equal(t, "Reopened card", actReopen[0].Description)
	})

	t.Run("Due date changes", func(t *testing.T) {
		d1 := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
		oldK := &storepb.MemoPayload_KanbanPayload{BoardId: "b", ColumnId: "c"}
		newK := &storepb.MemoPayload_KanbanPayload{BoardId: "b", ColumnId: "c", DueTime: timestamppb.New(d1)}

		actDue := s.generateKanbanActivities(ctx, 1, oldK, newK, "alice")
		require.Len(t, actDue, 1)
		require.Equal(t, "UPDATE_DUE_TIME", actDue[0].Type)
		require.Equal(t, "Set due date to 2026-09-01", actDue[0].Description)
	})
}
