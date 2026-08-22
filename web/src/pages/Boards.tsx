import { KanbanIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { BoardList, CreateBoardDialog, DeleteBoardDialog } from "@/components/Boards";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBoards, useCreateBoard, useDeleteBoard, useUpdateBoard } from "@/hooks/useBoardQueries";
import { handleError } from "@/lib/error";
import type { Board, BoardColumn } from "@/types/proto/api/v1/board_service_pb";
import { useTranslate } from "@/utils/i18n";

export const Boards = () => {
  const t = useTranslate();
  const { data: boards = [], isLoading } = useBoards();
  const createBoard = useCreateBoard();
  const updateBoard = useUpdateBoard();
  const deleteBoard = useDeleteBoard();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<Board>();
  const [editTitle, setEditTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Board>();

  const handleOpenCreate = () => {
    setCreateDialogOpen(true);
  };

  const handleCreate = async ({ title, columns }: { title: string; columns: BoardColumn[] }) => {
    try {
      await createBoard.mutateAsync({ title, columns });
      toast.success(t("boards.create-board"));
    } catch (error) {
      handleError(error, toast.error, { context: "Create board" });
    }
  };

  const handleOpenRename = (board: Board) => {
    setEditingBoard(board);
    setEditTitle(board.title);
  };

  const handleSaveRename = async () => {
    if (!editingBoard || !editTitle.trim()) return;
    try {
      await updateBoard.mutateAsync({
        board: { name: editingBoard.name, title: editTitle.trim() },
        updateMask: ["title"],
      });
      toast.success(t("common.save"));
      setEditingBoard(undefined);
    } catch (error) {
      handleError(error, toast.error, { context: "Rename board" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteBoard.mutateAsync(deleteTarget.name);
      toast.success(t("boards.delete-board"));
    } catch (error) {
      handleError(error, toast.error, { context: "Delete board" });
    } finally {
      setDeleteTarget(undefined);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <KanbanIcon className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{t("boards.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("boards.description")}</p>
          </div>
        </div>

        <Button onClick={handleOpenCreate} size="sm">
          <PlusIcon className="mr-1.5 size-4" />
          {t("boards.new-board")}
        </Button>
      </div>

      <BoardList boards={boards} isLoading={isLoading} onCreate={handleOpenCreate} onRename={handleOpenRename} onDelete={setDeleteTarget} />

      <CreateBoardDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onSubmit={handleCreate} />

      <Dialog open={!!editingBoard} onOpenChange={(open) => !open && setEditingBoard(undefined)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("boards.edit-board")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="edit-board-title">{t("boards.board-title")}</Label>
            <Input
              id="edit-board-title"
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSaveRename();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBoard(undefined)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSaveRename} disabled={!editTitle.trim() || updateBoard.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteBoardDialog
        board={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        onConfirm={handleDelete}
        isPending={deleteBoard.isPending}
      />
    </div>
  );
};

export default Boards;
