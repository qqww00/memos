package v1

import (
	"context"
	stderrors "errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/access"
	"github.com/usememos/memos/server/runner/memopayload"
	"github.com/usememos/memos/store"
)

// suppressSSEKey is a context key used to suppress the SSE broadcast from
// CreateMemo when it is called internally (e.g., from CreateMemoComment).
type suppressSSEKey struct{}

const maxBatchGetLinkMetadata = 10

func withSuppressSSE(ctx context.Context) context.Context {
	return context.WithValue(ctx, suppressSSEKey{}, true)
}

func isSSESuppressed(ctx context.Context) bool {
	v, ok := ctx.Value(suppressSSEKey{}).(bool)
	return ok && v
}

func (s *APIV1Service) checkMemoReadAccess(ctx context.Context, memo *store.Memo) error {
	return s.checkMemoReadAccessWithParent(ctx, memo, nil)
}

func (s *APIV1Service) checkMemoAndParentReadAccess(ctx context.Context, memo *store.Memo) error {
	var parent *store.Memo
	if memo != nil && memo.ParentUID != nil {
		var err error
		parent, err = s.Store.GetMemo(ctx, &store.FindMemo{UID: memo.ParentUID})
		if err != nil {
			return status.Errorf(codes.Internal, "failed to get parent memo")
		}
		if parent == nil {
			return status.Errorf(codes.NotFound, "memo not found")
		}
	}
	return s.checkMemoReadAccessWithParent(ctx, memo, parent)
}

func (s *APIV1Service) checkMemoReadAccessWithParent(ctx context.Context, memo, parent *store.Memo) error {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get user")
	}
	allowAnonymous := false
	if user == nil {
		allowAnonymous, err = s.Store.AllowsAnonymousAccess(ctx)
		if err != nil {
			return status.Errorf(codes.Internal, "failed to resolve instance access policy")
		}
	}
	return memoAccessDecisionError(access.CheckMemoRead(memo, parent, user, allowAnonymous, nil))
}

func memoAccessDecisionError(decision access.MemoReadDecision) error {
	switch decision.Denial {
	case access.MemoReadDenialNone:
		return nil
	case access.MemoReadDenialNotFound:
		return status.Errorf(codes.NotFound, "memo not found")
	case access.MemoReadDenialUnauthenticated:
		return status.Errorf(codes.Unauthenticated, "user not authenticated")
	default:
		return status.Errorf(codes.PermissionDenied, "permission denied")
	}
}

func (s *APIV1Service) CreateMemo(ctx context.Context, request *v1pb.CreateMemoRequest) (*v1pb.Memo, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if request.Memo == nil {
		return nil, status.Errorf(codes.InvalidArgument, "memo is required")
	}

	memoUID, err := ValidateAndGenerateUID(request.MemoId)
	if err != nil {
		return nil, err
	}

	create := &store.Memo{
		UID:        memoUID,
		CreatorID:  user.ID,
		Content:    request.Memo.Content,
		Visibility: convertVisibilityToStore(request.Memo.Visibility),
	}

	// Set custom timestamps if provided in the request.
	if request.Memo.CreateTime != nil && request.Memo.CreateTime.IsValid() {
		createdTs := request.Memo.CreateTime.AsTime().Unix()
		create.CreatedTs = createdTs
	}
	if request.Memo.UpdateTime != nil && request.Memo.UpdateTime.IsValid() {
		updatedTs := request.Memo.UpdateTime.AsTime().Unix()
		create.UpdatedTs = updatedTs
	}

	contentLengthLimit, err := s.getContentLengthLimit(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get content length limit")
	}
	if len(create.Content) > contentLengthLimit {
		return nil, status.Errorf(codes.InvalidArgument, "content too long (max %d characters)", contentLengthLimit)
	}
	if err := memopayload.RebuildMemoPayload(ctx, create, s.MarkdownService); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to rebuild memo payload: %v", err)
	}
	if request.Memo.Location != nil {
		create.Payload.Location = convertLocationToStore(request.Memo.Location)
	}
	if request.Memo.Kanban != nil && request.Memo.Kanban.GetBoardId() != "" {
		if err := s.validateKanbanTarget(ctx, user.ID, request.Memo.Kanban); err != nil {
			return nil, err
		}
		create.Payload.Kanban = convertKanbanToStore(request.Memo.Kanban)
	}

	preparedAttachments, err := s.prepareMemoAttachments(ctx, user, create, request.Memo.Attachments)
	if err != nil {
		return nil, err
	}
	requiredAttachmentIDs, err := s.resolveMemoAttachmentReferences(create.Content, preparedAttachments.normalized)
	if err != nil {
		return nil, err
	}
	preparedRelations, err := s.prepareMemoRelations(ctx, create, request.Memo.Relations)
	if err != nil {
		return nil, err
	}

	memo, err := s.Store.CreateMemo(ctx, create)
	if err != nil {
		// Check for unique constraint violation (AIP-133 compliance)
		errMsg := err.Error()
		if strings.Contains(errMsg, "UNIQUE constraint failed") ||
			strings.Contains(errMsg, "duplicate key") ||
			strings.Contains(errMsg, "Duplicate entry") {
			return nil, status.Errorf(codes.AlreadyExists, "memo with ID %q already exists", memoUID)
		}
		return nil, err
	}

	attachments := []*store.Attachment{}
	if len(preparedAttachments.normalized) > 0 || len(preparedRelations) > 0 {
		var relations *[]*store.MemoRelation
		if len(preparedRelations) > 0 {
			relations = &preparedRelations
		}
		if err := s.applyMemoMutation(ctx, memo, preparedAttachments, nil, requiredAttachmentIDs, relations); err != nil {
			return nil, err
		}
		a, err := s.Store.ListAttachments(ctx, &store.FindAttachment{
			MemoID: &memo.ID,
		})
		if err != nil {
			return nil, errors.Wrap(err, "failed to get memo attachments")
		}
		attachments = a
	}

	relations, err := s.loadMemoRelations(ctx, memo)
	if err != nil {
		return nil, errors.Wrap(err, "failed to load memo relations")
	}
	memoMessage, err := s.convertMemoFromStore(ctx, memo, nil, attachments, relations)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert memo")
	}
	// Try to dispatch webhook when memo is created.
	if err := s.DispatchMemoCreatedWebhook(ctx, memoMessage); err != nil {
		slog.Warn("Failed to dispatch memo created webhook", slog.Any("err", err))
	}

	// Broadcast live refresh event (skipped when called from CreateMemoComment).
	if !isSSESuppressed(ctx) {
		s.SSEHub.Broadcast(&SSEEvent{
			Type:       SSEEventMemoCreated,
			Name:       memoMessage.Name,
			Visibility: memo.Visibility,
			CreatorID:  resolveSSECreatorID(memo, nil),
		})
	}

	if !isMentionNotificationSuppressed(ctx) {
		s.dispatchMemoMentionNotificationsBestEffort(ctx, memo, nil, "")
	}

	return memoMessage, nil
}

func (s *APIV1Service) ListMemos(ctx context.Context, request *v1pb.ListMemosRequest) (*v1pb.ListMemosResponse, error) {
	memoFind := &store.FindMemo{
		// Exclude comments by default.
		ExcludeComments: true,
	}
	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if currentUser == nil {
		allowAnonymous, err := s.Store.AllowsAnonymousAccess(ctx)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to resolve instance access policy")
		}
		if !allowAnonymous {
			return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
		}
	}

	if request.State == v1pb.State_ARCHIVED {
		state := store.Archived
		memoFind.RowStatus = &state
		// Archived memos are only visible to their creator.
		if currentUser == nil {
			return &v1pb.ListMemosResponse{}, nil
		}
		memoFind.CreatorID = &currentUser.ID
	} else {
		state := store.Normal
		memoFind.RowStatus = &state
	}

	// Parse order_by field (replaces the old sort and direction fields)
	if request.OrderBy != "" {
		if err := s.parseMemoOrderBy(request.OrderBy, memoFind); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid order_by: %v", err)
		}
	} else {
		// Default ordering by create_time desc.
		memoFind.OrderByTimeAsc = false
	}

	if request.Filter != "" {
		if err := s.validateFilter(ctx, request.Filter); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
		}
		memoFind.Filters = append(memoFind.Filters, request.Filter)
	}

	if currentUser == nil {
		memoFind.VisibilityList = []store.Visibility{store.Public}
	} else {
		if memoFind.CreatorID == nil {
			filter := fmt.Sprintf(`creator_id == %d || visibility in ["PUBLIC", "PROTECTED"]`, currentUser.ID)
			memoFind.Filters = append(memoFind.Filters, filter)
		} else if *memoFind.CreatorID != currentUser.ID {
			memoFind.VisibilityList = []store.Visibility{store.Public, store.Protected}
		}
	}

	var limit, offset int
	if request.PageToken != "" {
		var pageToken v1pb.PageToken
		if err := unmarshalPageToken(request.PageToken, &pageToken); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid page token: %v", err)
		}
		limit = normalizePageSize(pageToken.Limit)
		offset = max(int(pageToken.Offset), 0)
	} else {
		limit = normalizePageSize(request.PageSize)
	}
	limit = min(limit, MaxPageSize)
	limitPlusOne := limit + 1
	memoFind.Limit = &limitPlusOne
	memoFind.Offset = &offset
	memos, err := s.Store.ListMemos(ctx, memoFind)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memos: %v", err)
	}

	memoMessages := []*v1pb.Memo{}
	nextPageToken := ""
	if len(memos) == limitPlusOne {
		memos = memos[:limit]
		nextPageToken, err = getPageToken(limit, offset+limit)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get next page token, error: %v", err)
		}
	}

	if len(memos) == 0 {
		response := &v1pb.ListMemosResponse{
			Memos:         memoMessages,
			NextPageToken: nextPageToken,
		}
		return response, nil
	}

	reactionMap := make(map[int32][]*store.Reaction)

	attachmentMap := make(map[int32][]*store.Attachment)
	memoIDs := make([]int32, 0, len(memos))

	for _, m := range memos {
		memoIDs = append(memoIDs, m.ID)
	}

	// REACTIONS
	reactions, err := s.Store.ListReactions(ctx, &store.FindReaction{MemoIDList: memoIDs})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list reactions")
	}
	for _, reaction := range reactions {
		reactionMap[reaction.MemoID] = append(reactionMap[reaction.MemoID], reaction)
	}

	// ATTACHMENTS
	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{MemoIDList: memoIDs})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list attachments")
	}
	for _, attachment := range attachments {
		attachmentMap[*attachment.MemoID] = append(attachmentMap[*attachment.MemoID], attachment)
	}

	// RELATIONS (batch load to avoid N+1)
	relationMap, err := s.batchConvertMemoRelations(ctx, memos, false)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to batch load memo relations")
	}
	creatorIDs := make([]int32, 0, len(memos)+len(reactions))
	for _, memo := range memos {
		creatorIDs = append(creatorIDs, memo.CreatorID)
	}
	for _, reaction := range reactions {
		creatorIDs = append(creatorIDs, reaction.CreatorID)
	}
	creatorMap, err := s.listUsersByID(ctx, creatorIDs)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memo creators: %v", err)
	}
	for _, memo := range memos {
		reactions := reactionMap[memo.ID]
		attachments := attachmentMap[memo.ID]
		relations := relationMap[memo.ID]

		memoMessage, err := s.convertMemoFromStoreWithCreators(ctx, memo, reactions, attachments, relations, creatorMap)
		if err != nil {
			if stderrors.Is(err, errMemoCreatorNotFound) {
				slog.Warn("Skipping memo with missing creator",
					slog.Int64("memo_id", int64(memo.ID)),
					slog.String("memo_uid", memo.UID),
					slog.Int64("creator_id", int64(memo.CreatorID)),
				)
				continue
			}
			return nil, errors.Wrap(err, "failed to convert memo")
		}

		memoMessages = append(memoMessages, memoMessage)
	}

	response := &v1pb.ListMemosResponse{
		Memos:         memoMessages,
		NextPageToken: nextPageToken,
	}
	return response, nil
}

func (s *APIV1Service) GetMemo(ctx context.Context, request *v1pb.GetMemoRequest) (*v1pb.Memo, error) {
	memoUID, err := ExtractMemoUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
		UID: &memoUID,
	})
	if err != nil {
		return nil, err
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}

	if err := s.checkMemoAndParentReadAccess(ctx, memo); err != nil {
		return nil, err
	}

	reactions, err := s.Store.ListReactions(ctx, &store.FindReaction{
		MemoID: &memo.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list reactions")
	}

	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{
		MemoID: &memo.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list attachments")
	}

	relations, err := s.loadMemoRelations(ctx, memo)
	if err != nil {
		return nil, errors.Wrap(err, "failed to load memo relations")
	}
	memoMessage, err := s.convertMemoFromStore(ctx, memo, reactions, attachments, relations)
	if err != nil {
		if stderrors.Is(err, errMemoCreatorNotFound) {
			return nil, status.Errorf(codes.NotFound, "memo creator not found")
		}
		return nil, errors.Wrap(err, "failed to convert memo")
	}
	if memo.ParentUID != nil {
		parent, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: memo.ParentUID})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get parent memo")
		}
		if parent == nil {
			return nil, status.Errorf(codes.NotFound, "memo not found")
		}
		memoMessage.Visibility = convertVisibilityFromStore(parent.Visibility)
	}
	return memoMessage, nil
}

// UpdateMemo updates an existing memo.
func (s *APIV1Service) UpdateMemo(ctx context.Context, request *v1pb.UpdateMemoRequest) (*v1pb.Memo, error) {
	if request.Memo == nil {
		return nil, status.Errorf(codes.InvalidArgument, "memo is required")
	}
	memoUID, err := ExtractMemoUIDFromName(request.Memo.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo: %v", err)
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}

	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	// Only the creator or admin can update the memo.
	if memo.CreatorID != user.ID && !isSuperUser(user) {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	update := &store.UpdateMemo{
		ID: memo.ID,
	}
	previousContent := memo.Content
	contentUpdated := false
	attachmentsUpdated := false
	relationsUpdated := false
	nextMemo := *memo
	if memo.Payload != nil {
		nextMemo.Payload = &storepb.MemoPayload{}
		proto.Merge(nextMemo.Payload, memo.Payload)
	}

	for _, path := range request.UpdateMask.Paths {
		if path == "content" {
			contentUpdated = true
			contentLengthLimit, err := s.getContentLengthLimit(ctx)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get content length limit")
			}
			if len(request.Memo.Content) > contentLengthLimit {
				return nil, status.Errorf(codes.InvalidArgument, "content too long (max %d characters)", contentLengthLimit)
			}
			nextMemo.Content = request.Memo.Content
			if err := memopayload.RebuildMemoPayload(ctx, &nextMemo, s.MarkdownService); err != nil {
				return nil, status.Errorf(codes.Internal, "failed to rebuild memo payload: %v", err)
			}
			update.Content = &nextMemo.Content
			update.Payload = nextMemo.Payload
		} else if path == "visibility" {
			visibility := convertVisibilityToStore(request.Memo.Visibility)
			if memo.ParentUID != nil {
				parentMemo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: memo.ParentUID})
				if err != nil {
					return nil, status.Errorf(codes.Internal, "failed to get parent memo")
				}
				if parentMemo == nil {
					return nil, status.Errorf(codes.NotFound, "memo not found")
				}
				visibility = parentMemo.Visibility
			}
			update.Visibility = &visibility
		} else if path == "pinned" {
			update.Pinned = &request.Memo.Pinned
		} else if path == "state" {
			rowStatus := convertStateToStore(request.Memo.State)
			update.RowStatus = &rowStatus
		} else if path == "create_time" {
			if request.Memo.CreateTime == nil || !request.Memo.CreateTime.IsValid() {
				return nil, status.Errorf(codes.InvalidArgument, "create_time is invalid")
			}
			createdTs := request.Memo.CreateTime.AsTime().Unix()
			update.CreatedTs = &createdTs
		} else if path == "update_time" {
			updatedTs := time.Now().Unix()
			if request.Memo.UpdateTime != nil {
				updatedTs = request.Memo.UpdateTime.AsTime().Unix()
			}
			update.UpdatedTs = &updatedTs
		} else if path == "display_time" {
			return nil, status.Errorf(codes.InvalidArgument, "display_time is not supported")
		} else if path == "location" {
			if nextMemo.Payload == nil {
				nextMemo.Payload = &storepb.MemoPayload{}
			}
			nextMemo.Payload.Location = convertLocationToStore(request.Memo.Location)
			update.Payload = nextMemo.Payload
		} else if path == "kanban" {
			if nextMemo.Payload == nil {
				nextMemo.Payload = &storepb.MemoPayload{}
			}
			kanban := request.Memo.GetKanban()
			if kanban == nil {
				return nil, status.Errorf(codes.InvalidArgument, "kanban must be set when the kanban mask path is used")
			}
			oldKanban := memo.Payload.GetKanban()
			var newKanban *storepb.MemoPayload_KanbanPayload
			if kanban.GetBoardId() == "" {
				// An empty kanban message clears the card state.
				newKanban = nil
			} else {
				if err := s.validateKanbanTarget(ctx, memo.CreatorID, kanban); err != nil {
					return nil, err
				}
				newKanban = convertKanbanToStore(kanban)
			}
			newActivities := s.generateKanbanActivities(ctx, memo.CreatorID, oldKanban, newKanban, user.Username)
			if len(newActivities) > 0 {
				nextMemo.Payload.Activities = append(nextMemo.Payload.Activities, newActivities...)
			}
			nextMemo.Payload.Kanban = newKanban
			update.Payload = nextMemo.Payload
		} else if path == "attachments" {
			attachmentsUpdated = true
		} else if path == "relations" {
			relationsUpdated = true
		}
	}

	var preparedAttachments *preparedMemoAttachments
	if attachmentsUpdated {
		preparedAttachments, err = s.prepareMemoAttachments(ctx, user, memo, request.Memo.Attachments)
		if err != nil {
			return nil, err
		}
	}
	var preparedRelations []*store.MemoRelation
	if relationsUpdated {
		preparedRelations, err = s.prepareMemoRelations(ctx, memo, request.Memo.Relations)
		if err != nil {
			return nil, err
		}
	}
	var requiredAttachmentIDs []int32
	if contentUpdated || attachmentsUpdated {
		var finalAttachments []*store.Attachment
		if preparedAttachments != nil {
			finalAttachments = preparedAttachments.normalized
		} else {
			finalAttachments, err = s.Store.ListAttachments(ctx, &store.FindAttachment{MemoID: &memo.ID})
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to list attachments")
			}
		}
		requiredAttachmentIDs, err = s.resolveMemoAttachmentReferences(nextMemo.Content, finalAttachments)
		if err != nil {
			return nil, err
		}
	}

	if contentUpdated || attachmentsUpdated || relationsUpdated {
		var relations *[]*store.MemoRelation
		if relationsUpdated {
			relations = &preparedRelations
		}
		if err := s.applyMemoMutation(ctx, memo, preparedAttachments, update, requiredAttachmentIDs, relations); err != nil {
			return nil, err
		}
	} else if err = s.Store.UpdateMemo(ctx, update); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update memo")
	}

	memo, err = s.Store.GetMemo(ctx, &store.FindMemo{
		ID: &memo.ID,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get memo")
	}
	memo, parentMemo, memoMessage, err := s.buildUpdatedMemoState(ctx, memo.ID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to build updated memo state")
	}
	if contentUpdated {
		s.dispatchMemoMentionNotificationsBestEffort(ctx, memo, parentMemo, previousContent)
	}
	s.dispatchMemoUpdatedSideEffects(ctx, memo, parentMemo, memoMessage)

	return memoMessage, nil
}

func (s *APIV1Service) DeleteMemo(ctx context.Context, request *v1pb.DeleteMemoRequest) (*emptypb.Empty, error) {
	memoUID, err := ExtractMemoUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
	}
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
		UID: &memoUID,
	})
	if err != nil {
		return nil, err
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}

	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	// Only the creator or admin can update the memo.
	if memo.CreatorID != user.ID && !isSuperUser(user) {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	reactions, err := s.Store.ListReactions(ctx, &store.FindReaction{
		MemoID: &memo.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list reactions")
	}

	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{
		MemoID: &memo.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list attachments")
	}

	deleteRelations, _ := s.loadMemoRelations(ctx, memo)
	if memoMessage, err := s.convertMemoFromStore(ctx, memo, reactions, attachments, deleteRelations); err == nil {
		// Try to dispatch webhook when memo is deleted.
		if err := s.DispatchMemoDeletedWebhook(ctx, memoMessage); err != nil {
			slog.Warn("Failed to dispatch memo deleted webhook", slog.Any("err", err))
		}
	}

	// Delete memo comments first (store.DeleteMemo handles their reactions, relations and attachments)
	commentType := store.MemoRelationComment
	relations, err := s.Store.ListMemoRelations(ctx, &store.FindMemoRelation{RelatedMemoID: &memo.ID, Type: &commentType})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memo comments")
	}
	for _, relation := range relations {
		if err := s.Store.DeleteMemo(ctx, &store.DeleteMemo{ID: relation.MemoID}); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to delete memo comment")
		}
	}

	// Delete the memo (store.DeleteMemo handles reaction, relation and attachment cleanup)
	if err = s.Store.DeleteMemo(ctx, &store.DeleteMemo{ID: memo.ID}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete memo")
	}

	// Broadcast live refresh event.
	s.SSEHub.Broadcast(&SSEEvent{
		Type:       SSEEventMemoDeleted,
		Name:       request.Name,
		Visibility: memo.Visibility,
		CreatorID:  resolveSSECreatorID(memo, nil),
	})

	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) getContentLengthLimit(ctx context.Context) (int, error) {
	instanceMemoRelatedSetting, err := s.Store.GetInstanceMemoRelatedSetting(ctx)
	if err != nil {
		return 0, status.Errorf(codes.Internal, "failed to get instance memo related setting")
	}
	return int(instanceMemoRelatedSetting.ContentLengthLimit), nil
}

func getKanbanCategoriesList(k *storepb.MemoPayload_KanbanPayload) []string {
	if k == nil {
		return []string{}
	}
	res := make([]string, 0, len(k.Categories)+1)
	seen := make(map[string]bool)
	if k.Category != nil && strings.TrimSpace(*k.Category) != "" {
		c := strings.TrimSpace(*k.Category)
		res = append(res, c)
		seen[c] = true
	}
	for _, c := range k.Categories {
		c = strings.TrimSpace(c)
		if c != "" && !seen[c] {
			res = append(res, c)
			seen[c] = true
		}
	}
	return res
}

func (s *APIV1Service) generateKanbanActivities(ctx context.Context, creatorID int32, oldKanban, newKanban *storepb.MemoPayload_KanbanPayload, username string) []*storepb.MemoPayload_ActivityPayload {
	var activities []*storepb.MemoPayload_ActivityPayload
	now := timestamppb.Now()
	creator := BuildUserName(username)

	if oldKanban == nil && newKanban == nil {
		return activities
	}

	addActivity := func(activityType, description string, oldValue, newValue *string) {
		activities = append(activities, &storepb.MemoPayload_ActivityPayload{
			Type:        activityType,
			Description: description,
			CreateTime:  now,
			Creator:     creator,
			OldValue:    oldValue,
			NewValue:    newValue,
		})
	}

	// 1. Column changes
	if oldKanban != nil && newKanban != nil && oldKanban.ColumnId != newKanban.ColumnId {
		oldColTitle := oldKanban.ColumnId
		newColTitle := newKanban.ColumnId
		if board, err := s.Store.GetUserBoard(ctx, creatorID, newKanban.BoardId); err == nil && board != nil {
			for _, col := range board.Columns {
				if col.Id == oldKanban.ColumnId {
					oldColTitle = col.Title
				}
				if col.Id == newKanban.ColumnId {
					newColTitle = col.Title
				}
			}
		}
		desc := fmt.Sprintf("Moved card from '%s' to '%s'", oldColTitle, newColTitle)
		addActivity("MOVE_COLUMN", desc, &oldColTitle, &newColTitle)
	}

	// 2. Category changes
	oldCats := getKanbanCategoriesList(oldKanban)
	newCats := getKanbanCategoriesList(newKanban)
	oldCatSet := make(map[string]bool)
	for _, c := range oldCats {
		oldCatSet[c] = true
	}
	newCatSet := make(map[string]bool)
	for _, c := range newCats {
		newCatSet[c] = true
	}

	if len(oldCats) == 1 && len(newCats) == 1 && oldCats[0] != newCats[0] {
		desc := fmt.Sprintf("Changed category from '%s' to '%s'", oldCats[0], newCats[0])
		addActivity("UPDATE_CATEGORY", desc, &oldCats[0], &newCats[0])
	} else {
		for _, c := range oldCats {
			if !newCatSet[c] {
				cCopy := c
				desc := fmt.Sprintf("Removed category '%s'", c)
				addActivity("UPDATE_CATEGORY", desc, &cCopy, nil)
			}
		}
		for _, c := range newCats {
			if !oldCatSet[c] {
				cCopy := c
				desc := fmt.Sprintf("Added category '%s'", c)
				addActivity("UPDATE_CATEGORY", desc, nil, &cCopy)
			}
		}
	}

	// 3. Milestone changes
	oldMilestone := ""
	if oldKanban != nil && oldKanban.Milestone != nil {
		oldMilestone = strings.TrimSpace(*oldKanban.Milestone)
	}
	newMilestone := ""
	if newKanban != nil && newKanban.Milestone != nil {
		newMilestone = strings.TrimSpace(*newKanban.Milestone)
	}
	if oldMilestone != newMilestone {
		if oldMilestone == "" && newMilestone != "" {
			desc := fmt.Sprintf("Set milestone to '%s'", newMilestone)
			addActivity("UPDATE_MILESTONE", desc, nil, &newMilestone)
		} else if oldMilestone != "" && newMilestone == "" {
			desc := fmt.Sprintf("Removed milestone '%s'", oldMilestone)
			addActivity("UPDATE_MILESTONE", desc, &oldMilestone, nil)
		} else if oldMilestone != "" && newMilestone != "" {
			desc := fmt.Sprintf("Changed milestone from '%s' to '%s'", oldMilestone, newMilestone)
			addActivity("UPDATE_MILESTONE", desc, &oldMilestone, &newMilestone)
		}
	}

	// 4. Closed / Completed status
	oldClosed := oldKanban != nil && oldKanban.IsClosed != nil && *oldKanban.IsClosed
	newClosed := newKanban != nil && newKanban.IsClosed != nil && *newKanban.IsClosed
	if oldClosed != newClosed {
		if newClosed {
			desc := "Marked card as completed"
			addActivity("UPDATE_STATUS", desc, nil, nil)
		} else {
			desc := "Reopened card"
			addActivity("UPDATE_STATUS", desc, nil, nil)
		}
	}

	// 5. Due date changes
	oldDue := int64(0)
	if oldKanban != nil && oldKanban.DueTime != nil {
		oldDue = oldKanban.DueTime.Seconds
	}
	newDue := int64(0)
	if newKanban != nil && newKanban.DueTime != nil {
		newDue = newKanban.DueTime.Seconds
	}
	if oldDue != newDue {
		if oldDue == 0 && newDue != 0 {
			newFormatted := time.Unix(newDue, 0).Format("2006-01-02")
			desc := fmt.Sprintf("Set due date to %s", newFormatted)
			addActivity("UPDATE_DUE_TIME", desc, nil, &newFormatted)
		} else if oldDue != 0 && newDue == 0 {
			desc := "Removed due date"
			addActivity("UPDATE_DUE_TIME", desc, nil, nil)
		} else if oldDue != 0 && newDue != 0 {
			oldFormatted := time.Unix(oldDue, 0).Format("2006-01-02")
			newFormatted := time.Unix(newDue, 0).Format("2006-01-02")
			desc := fmt.Sprintf("Changed due date from %s to %s", oldFormatted, newFormatted)
			addActivity("UPDATE_DUE_TIME", desc, &oldFormatted, &newFormatted)
		}
	}

	return activities
}

// DispatchMemoCreatedWebhook dispatches webhook when memo is created.
