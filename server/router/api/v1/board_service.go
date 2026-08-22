package v1

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/util"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

const (
	// boardSweepBatchSize is the number of memos cleared per batch when deleting a board.
	boardSweepBatchSize = 100
	// boardSweepMaxBatches bounds the best-effort kanban sweep on board deletion.
	boardSweepMaxBatches = 1000
)

// extractUserAndBoardIDFromName extracts the user and board ID from a board resource name.
// Format: users/{user}/boards/{board}.
func (s *APIV1Service) extractUserAndBoardIDFromName(ctx context.Context, name string) (*store.User, string, error) {
	parts := strings.Split(name, "/")
	if len(parts) != 4 || parts[0] != "users" || parts[2] != "boards" {
		return nil, "", errors.Errorf("invalid board name format: %s", name)
	}

	user, err := ResolveUserByName(ctx, s.Store, BuildUserName(parts[1]))
	if err != nil {
		return nil, "", err
	}
	if user == nil {
		return nil, "", errors.Errorf("user not found: %s", parts[1])
	}

	boardID := parts[3]
	if boardID == "" {
		return nil, "", errors.Errorf("empty board ID in name: %s", name)
	}

	return user, boardID, nil
}

// constructBoardName builds a board resource name.
func constructBoardName(username string, boardID string) string {
	return fmt.Sprintf("%s/boards/%s", BuildUserName(username), boardID)
}

func convertBoardFromStore(username string, board *storepb.BoardsUserSetting_Board) *v1pb.Board {
	columns := make([]*v1pb.BoardColumn, 0, len(board.GetColumns()))
	for _, column := range board.GetColumns() {
		columns = append(columns, &v1pb.BoardColumn{
			Id:       column.GetId(),
			Title:    column.GetTitle(),
			ColorHex: column.GetColorHex(),
			WipLimit: column.GetWipLimit(),
		})
	}
	boardMessage := &v1pb.Board{
		Name:    constructBoardName(username, board.GetId()),
		Title:   board.GetTitle(),
		Columns: columns,
	}
	if board.GetCreatedAt() != nil {
		boardMessage.CreateTime = board.GetCreatedAt()
	}
	if board.GetUpdatedAt() != nil {
		boardMessage.UpdateTime = board.GetUpdatedAt()
	}
	return boardMessage
}

// authorizeBoardAccess resolves the owner of a board collection and asserts that
// the caller is that owner.
func (s *APIV1Service) authorizeBoardAccess(ctx context.Context, user *store.User) error {
	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.ID != user.ID {
		return status.Errorf(codes.PermissionDenied, "permission denied")
	}
	return nil
}

// ListBoards lists the kanban boards owned by a user.
func (s *APIV1Service) ListBoards(ctx context.Context, request *v1pb.ListBoardsRequest) (*v1pb.ListBoardsResponse, error) {
	user, err := ResolveUserByName(ctx, s.Store, request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}
	if err := s.authorizeBoardAccess(ctx, user); err != nil {
		return nil, err
	}

	storeBoards, err := s.Store.GetUserBoards(ctx, user.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get boards: %v", err)
	}

	boards := []*v1pb.Board{}
	for _, board := range storeBoards {
		boards = append(boards, convertBoardFromStore(user.Username, board))
	}
	return &v1pb.ListBoardsResponse{Boards: boards}, nil
}

// GetBoard returns a kanban board by resource name.
func (s *APIV1Service) GetBoard(ctx context.Context, request *v1pb.GetBoardRequest) (*v1pb.Board, error) {
	user, boardID, err := s.extractUserAndBoardIDFromName(ctx, request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid board name: %v", err)
	}
	if err := s.authorizeBoardAccess(ctx, user); err != nil {
		return nil, err
	}

	board, err := s.Store.GetUserBoard(ctx, user.ID, boardID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get board: %v", err)
	}
	if board == nil {
		return nil, status.Errorf(codes.NotFound, "board not found")
	}
	return convertBoardFromStore(user.Username, board), nil
}

// validateBoardColumns normalizes requested columns into store columns,
// assigning server-generated ids for columns that do not carry one.
func validateBoardColumns(columns []*v1pb.BoardColumn) ([]*storepb.BoardsUserSetting_BoardColumn, error) {
	if len(columns) == 0 {
		return nil, errors.New("board must have at least one column")
	}
	storeColumns := make([]*storepb.BoardsUserSetting_BoardColumn, 0, len(columns))
	seenIDs := make(map[string]bool, len(columns))
	for _, column := range columns {
		if column.GetTitle() == "" {
			return nil, errors.New("column title is required")
		}
		id := column.GetId()
		if id == "" {
			id = util.GenUUID()
		}
		if seenIDs[id] {
			return nil, errors.Errorf("duplicate column id: %s", id)
		}
		seenIDs[id] = true
		storeColumns = append(storeColumns, &storepb.BoardsUserSetting_BoardColumn{
			Id:       id,
			Title:    column.GetTitle(),
			ColorHex: column.GetColorHex(),
			WipLimit: column.GetWipLimit(),
		})
	}
	return storeColumns, nil
}

// defaultBoardColumns returns the default "Todo", "In Progress", "Done" columns.
func defaultBoardColumns() []*storepb.BoardsUserSetting_BoardColumn {
	return []*storepb.BoardsUserSetting_BoardColumn{
		{Id: util.GenUUID(), Title: "Todo"},
		{Id: util.GenUUID(), Title: "In Progress"},
		{Id: util.GenUUID(), Title: "Done"},
	}
}

// ensureBoardTitleUnique rejects titles that collide (case-insensitive) with
// another board owned by the same user.
func (s *APIV1Service) ensureBoardTitleUnique(ctx context.Context, userID int32, title, excludeBoardID string) error {
	boards, err := s.Store.GetUserBoards(ctx, userID)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get boards: %v", err)
	}
	for _, board := range boards {
		if board.GetId() == excludeBoardID {
			continue
		}
		if strings.EqualFold(board.GetTitle(), title) {
			return status.Errorf(codes.InvalidArgument, "board title already exists")
		}
	}
	return nil
}

// CreateBoard creates a kanban board for a user.
func (s *APIV1Service) CreateBoard(ctx context.Context, request *v1pb.CreateBoardRequest) (*v1pb.Board, error) {
	user, err := ResolveUserByName(ctx, s.Store, request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}
	if err := s.authorizeBoardAccess(ctx, user); err != nil {
		return nil, err
	}

	title := strings.TrimSpace(request.GetBoard().GetTitle())
	if title == "" {
		return nil, status.Errorf(codes.InvalidArgument, "title is required")
	}
	if err := s.ensureBoardTitleUnique(ctx, user.ID, title, ""); err != nil {
		return nil, err
	}

	columns := []*storepb.BoardsUserSetting_BoardColumn{}
	if len(request.GetBoard().GetColumns()) > 0 {
		columns, err = validateBoardColumns(request.GetBoard().GetColumns())
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid columns: %v", err)
		}
	} else {
		columns = defaultBoardColumns()
	}

	now := timestamppb.Now()
	newBoard := &storepb.BoardsUserSetting_Board{
		Id:        util.GenUUID(),
		Title:     title,
		Columns:   columns,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if request.ValidateOnly {
		return convertBoardFromStore(user.Username, newBoard), nil
	}

	if err := s.Store.UpsertUserBoard(ctx, user.ID, newBoard); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create board: %v", err)
	}
	return convertBoardFromStore(user.Username, newBoard), nil
}

// UpdateBoard updates the selected fields of a kanban board.
func (s *APIV1Service) UpdateBoard(ctx context.Context, request *v1pb.UpdateBoardRequest) (*v1pb.Board, error) {
	user, boardID, err := s.extractUserAndBoardIDFromName(ctx, request.GetBoard().GetName())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid board name: %v", err)
	}
	if err := s.authorizeBoardAccess(ctx, user); err != nil {
		return nil, err
	}
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	existing, err := s.Store.GetUserBoard(ctx, user.ID, boardID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get board: %v", err)
	}
	if existing == nil {
		return nil, status.Errorf(codes.NotFound, "board not found")
	}

	for _, field := range request.UpdateMask.Paths {
		switch field {
		case "title":
			title := strings.TrimSpace(request.GetBoard().GetTitle())
			if title == "" {
				return nil, status.Errorf(codes.InvalidArgument, "title is required")
			}
			if err := s.ensureBoardTitleUnique(ctx, user.ID, title, boardID); err != nil {
				return nil, err
			}
			existing.Title = title
		case "columns":
			columns, err := validateBoardColumns(request.GetBoard().GetColumns())
			if err != nil {
				return nil, status.Errorf(codes.InvalidArgument, "invalid columns: %v", err)
			}
			existing.Columns = columns
		default:
			return nil, status.Errorf(codes.InvalidArgument, "unsupported update mask path: %s", field)
		}
	}
	existing.UpdatedAt = timestamppb.Now()

	if err := s.Store.UpsertUserBoard(ctx, user.ID, existing); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update board: %v", err)
	}
	return convertBoardFromStore(user.Username, existing), nil
}

// DeleteBoard deletes a kanban board and clears the kanban state of memos on it.
func (s *APIV1Service) DeleteBoard(ctx context.Context, request *v1pb.DeleteBoardRequest) (*emptypb.Empty, error) {
	user, boardID, err := s.extractUserAndBoardIDFromName(ctx, request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid board name: %v", err)
	}
	if err := s.authorizeBoardAccess(ctx, user); err != nil {
		return nil, err
	}

	found, err := s.Store.RemoveUserBoard(ctx, user.ID, boardID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete board: %v", err)
	}
	if !found {
		return nil, status.Errorf(codes.NotFound, "board not found")
	}

	s.sweepBoardKanbanState(ctx, user.ID, boardID)
	return &emptypb.Empty{}, nil
}

// validateKanbanTarget checks that the kanban board and column exist and are
// owned by the given user. It returns a gRPC status error when invalid.
func (s *APIV1Service) validateKanbanTarget(ctx context.Context, userID int32, kanban *v1pb.Kanban) error {
	if kanban.GetColumnId() == "" {
		return status.Errorf(codes.InvalidArgument, "kanban column_id is required")
	}
	board, err := s.Store.GetUserBoard(ctx, userID, kanban.GetBoardId())
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get board: %v", err)
	}
	if board == nil {
		return status.Errorf(codes.InvalidArgument, "board not found: %s", kanban.GetBoardId())
	}
	for _, column := range board.GetColumns() {
		if column.GetId() == kanban.GetColumnId() {
			return nil
		}
	}
	return status.Errorf(codes.InvalidArgument, "column not found on board: %s", kanban.GetColumnId())
}

// sweepBoardKanbanState clears the kanban payload of the user's memos that still
// reference the deleted board. It is best-effort: failures are logged and skipped.
func (s *APIV1Service) sweepBoardKanbanState(ctx context.Context, userID int32, boardID string) {
	boardFilter := fmt.Sprintf("kanban_board == %q", boardID)
	offset := 0
	for range boardSweepMaxBatches {
		limit := boardSweepBatchSize
		memos, err := s.Store.ListMemos(ctx, &store.FindMemo{
			CreatorID: &userID,
			Filters:   []string{boardFilter},
			Limit:     &limit,
			Offset:    &offset,
		})
		if err != nil {
			slog.Error("failed to list memos during board kanban sweep", "err", err, "boardID", boardID)
			return
		}
		if len(memos) == 0 {
			return
		}
		for _, memo := range memos {
			if memo.Payload == nil || memo.Payload.Kanban == nil {
				continue
			}
			memo.Payload.Kanban = nil
			if err := s.Store.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, Payload: memo.Payload}); err != nil {
				slog.Error("failed to clear kanban state during board sweep", "err", err, "memoID", memo.ID)
			}
		}
		offset += len(memos)
		if len(memos) < boardSweepBatchSize {
			return
		}
	}
	slog.Warn("board kanban sweep hit batch limit", "boardID", boardID, "batches", boardSweepMaxBatches)
}
