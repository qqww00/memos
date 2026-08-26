import { create } from "@bufbuild/protobuf";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  BookmarkMinusIcon,
  BookmarkPlusIcon,
  CheckCheckIcon,
  CopyIcon,
  Edit3Icon,
  FileTextIcon,
  KanbanIcon,
  LinkIcon,
  ListChecksIcon,
  ListRestartIcon,
  MoreVerticalIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { boardIdFromName, useBoards, useUpdateMemoKanban } from "@/hooks/useBoardQueries";
import type { Board, BoardColumn } from "@/types/proto/api/v1/board_service_pb";
import { State } from "@/types/proto/api/v1/common_pb";
import { KanbanSchema } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { useMemoActionHandlers } from "./hooks";
import type { MemoActionMenuProps } from "./types";

const MemoActionMenu = (props: MemoActionMenuProps) => {
  const { memo, readonly } = props;
  const t = useTranslate();

  // Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Derived state
  const isComment = Boolean(memo.parent);
  const isArchived = memo.state === State.ARCHIVED;
  const canMutateTasks = !readonly && !isArchived && Boolean(memo.property?.hasTaskList);
  const hasOpenTasks = Boolean(memo.property?.hasIncompleteTasks);

  // Board state
  const { data: boards = [] } = useBoards();
  const updateMemoKanban = useUpdateMemoKanban();

  const handleAssignToBoard = async (board: Board, col: BoardColumn) => {
    try {
      const boardId = boardIdFromName(board.name);
      await updateMemoKanban.mutateAsync({
        name: memo.name,
        kanban: create(KanbanSchema, {
          boardId,
          columnId: col.id,
          position: Date.now(),
          category: memo.kanban?.category,
          categoryColorHex: memo.kanban?.categoryColorHex,
          categories: memo.kanban?.categories ?? (memo.kanban?.category ? [memo.kanban.category] : []),
          milestone: memo.kanban?.milestone,
          dueTime: memo.kanban?.dueTime,
          isClosed: memo.kanban?.isClosed,
        }),
      });
      toast.success(t("boards.added-to-board"));
    } catch {
      toast.error("Failed to add memo to board");
    }
  };

  const handleRemoveFromBoard = async () => {
    try {
      await updateMemoKanban.mutateAsync({
        name: memo.name,
        kanban: undefined,
      });
      toast.success(t("boards.removed-from-board"));
    } catch {
      toast.error("Failed to remove memo from board");
    }
  };

  // Action handlers
  const {
    handleTogglePinMemoBtnClick,
    handleEditMemoClick,
    handleToggleMemoStatusClick,
    handleCopyLink,
    handleCopyContent,
    handleCheckAllTaskListItemsClick,
    handleUncheckAllTaskListItemsClick,
    handleDeleteMemoClick,
    confirmDeleteMemo,
  } = useMemoActionHandlers({
    memo,
    onEdit: props.onEdit,
    setDeleteDialogOpen,
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-4" />}>
        <MoreVerticalIcon className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={2}>
        {/* Edit actions (non-readonly, non-archived) */}
        {!readonly && !isArchived && (
          <>
            {!isComment && (
              <DropdownMenuItem onClick={handleTogglePinMemoBtnClick}>
                {memo.pinned ? <BookmarkMinusIcon className="w-4 h-auto" /> : <BookmarkPlusIcon className="w-4 h-auto" />}
                {memo.pinned ? t("common.unpin") : t("common.pin")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleEditMemoClick}>
              <Edit3Icon className="w-4 h-auto" />
              {t("common.edit")}
            </DropdownMenuItem>
          </>
        )}

        {/* Board submenu (non-readonly, non-archived, non-comment) */}
        {!readonly && !isArchived && !isComment && boards.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <KanbanIcon className="w-4 h-auto" />
              {memo.kanban?.boardId ? t("boards.move-to-board") : t("boards.add-memo-to-board")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {memo.kanban?.boardId && (
                <>
                  <DropdownMenuItem onClick={handleRemoveFromBoard}>
                    <XIcon className="w-4 h-auto" />
                    {t("boards.remove-from-board")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {boards.map((board) => {
                const boardId = boardIdFromName(board.name);
                return (
                  <DropdownMenuSub key={board.name}>
                    <DropdownMenuSubTrigger>
                      <span className="truncate max-w-[140px]">{board.title}</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {board.columns.map((col) => {
                        const isCurrent = memo.kanban?.boardId === boardId && memo.kanban?.columnId === col.id;
                        return (
                          <DropdownMenuItem key={col.id} disabled={isCurrent} onClick={() => handleAssignToBoard(board, col)}>
                            <span className="size-2 rounded-full mr-1 shrink-0" style={{ backgroundColor: col.colorHex || "#64748b" }} />
                            <span className="truncate">{col.title}</span>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                );
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* Copy submenu (non-archived) */}
        {!isArchived && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <CopyIcon className="w-4 h-auto" />
              {t("common.copy")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={handleCopyLink}>
                <LinkIcon className="w-4 h-auto" />
                {t("memo.copy-link")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyContent}>
                <FileTextIcon className="w-4 h-auto" />
                {t("memo.copy-content")}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* Task submenu (writable task memos) */}
        {canMutateTasks && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ListChecksIcon className="w-4 h-auto" />
              {t("memo.task-actions.title")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem disabled={!hasOpenTasks} onClick={handleCheckAllTaskListItemsClick}>
                <CheckCheckIcon className="w-4 h-auto" />
                {t("memo.task-actions.check-all")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleUncheckAllTaskListItemsClick}>
                <ListRestartIcon className="w-4 h-auto" />
                {t("memo.task-actions.uncheck-all")}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* Write actions (non-readonly) */}
        {!readonly && (
          <>
            {/* Archive/Restore (non-comment) */}
            {!isComment && (
              <DropdownMenuItem onClick={handleToggleMemoStatusClick}>
                {isArchived ? <ArchiveRestoreIcon className="w-4 h-auto" /> : <ArchiveIcon className="w-4 h-auto" />}
                {isArchived ? t("common.restore") : t("common.archive")}
              </DropdownMenuItem>
            )}

            {/* Delete */}
            <DropdownMenuItem onClick={handleDeleteMemoClick}>
              <TrashIcon className="w-4 h-auto" />
              {t("common.delete")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t("memo.delete-confirm")}
        confirmLabel={t("common.delete")}
        description={t("memo.delete-confirm-description")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmDeleteMemo}
        confirmVariant="destructive"
      />
    </DropdownMenu>
  );
};

export default MemoActionMenu;
