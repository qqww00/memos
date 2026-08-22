import { create } from "@bufbuild/protobuf";
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ArrowLeftIcon, KanbanIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AddMemoToBoardDialog, BOARD_COLUMN_COLORS, KanbanCard, KanbanColumn, MemoDetailDialog } from "@/components/Boards";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  boardIdFromName,
  computeDropPosition,
  groupCardsByColumn,
  isPositionRepresentable,
  useBoardCards,
  useBoards,
  useUpdateBoard,
  useUpdateMemoKanban,
} from "@/hooks/useBoardQueries";
import { handleError } from "@/lib/error";
import { ROUTES } from "@/router/routes";
import { BoardColumn, BoardColumnSchema } from "@/types/proto/api/v1/board_service_pb";
import { KanbanSchema, type Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

export const BoardDetail = () => {
  const t = useTranslate();
  const navigate = useNavigate();
  const { boardId = "" } = useParams();

  const { data: boards = [], isLoading: isBoardsLoading } = useBoards();
  const { data: cards = [], isLoading: isCardsLoading } = useBoardCards(boardId);

  const updateBoard = useUpdateBoard();
  const updateMemoKanban = useUpdateMemoKanban();

  const board = useMemo(() => boards.find((b) => boardIdFromName(b.name) === boardId), [boards, boardId]);

  // Dialog states
  const [addColumnDialogOpen, setAddColumnDialogOpen] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [newColumnColor, setNewColumnColor] = useState<string>(BOARD_COLUMN_COLORS[0].value);
  const [addMemoDialogOpen, setAddMemoDialogOpen] = useState(false);
  const [addMemoColumnId, setAddMemoColumnId] = useState<string>("");
  const [selectedMemoName, setSelectedMemoName] = useState<string | null>(null);

  // Dragging state
  const [activeCard, setActiveCard] = useState<Memo | null>(null);
  const [activeColumn, setActiveColumn] = useState<BoardColumn | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const columnCardsMap = useMemo(() => {
    const columnIds = board?.columns.map((c) => c.id) || [];
    return groupCardsByColumn(cards, columnIds);
  }, [cards, board?.columns]);

  if (isBoardsLoading || isCardsLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">Board not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate(ROUTES.BOARDS)}>
          <ArrowLeftIcon className="mr-1.5 size-4" />
          Back to Boards
        </Button>
      </div>
    );
  }

  const handleDragStart = (event: DragStartEvent) => {
    const activeData = event.active.data.current;
    if (activeData?.type === "column") {
      const col = board.columns.find((c) => c.id === event.active.id);
      setActiveColumn(col || null);
      setActiveCard(null);
    } else {
      const memoName = String(event.active.id);
      const card = cards.find((c) => c.name === memoName);
      setActiveCard(card || null);
      setActiveColumn(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);
    setActiveColumn(null);

    if (!over) return;

    const activeData = active.data.current;

    // Handle column reorder drag
    if (activeData?.type === "column") {
      const activeColId = String(active.id);
      const overColId = over.data.current?.columnId || String(over.id);
      if (activeColId && overColId && activeColId !== overColId) {
        const oldIndex = board.columns.findIndex((c) => c.id === activeColId);
        const newIndex = board.columns.findIndex((c) => c.id === overColId);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = arrayMove(board.columns, oldIndex, newIndex);
          void handleUpdateColumns(reordered);
        }
      }
      return;
    }

    const activeMemoName = String(active.id);
    const activeMemo = cards.find((c) => c.name === activeMemoName);
    if (!activeMemo) return;

    const sourceColumnId = activeMemo.kanban?.columnId;
    const overData = over.data.current;

    let targetColumnId = "";
    let targetOverMemoName = "";

    if (overData?.type === "column") {
      targetColumnId = overData.columnId;
    } else if (overData?.type === "card") {
      targetColumnId = overData.columnId;
      targetOverMemoName = String(over.id);
    } else if (board.columns.some((col) => col.id === over.id)) {
      targetColumnId = String(over.id);
    } else {
      const overMemo = cards.find((c) => c.name === over.id);
      if (overMemo?.kanban?.columnId) {
        targetColumnId = overMemo.kanban.columnId;
        targetOverMemoName = overMemo.name;
      }
    }

    if (!targetColumnId) return;

    const targetColumnCards = columnCardsMap.get(targetColumnId) || [];
    const targetListWithoutActive = targetColumnCards.filter((c) => c.name !== activeMemoName);

    let targetIndex = targetListWithoutActive.length;
    if (targetOverMemoName) {
      const idx = targetListWithoutActive.findIndex((c) => c.name === targetOverMemoName);
      if (idx !== -1) {
        targetIndex = idx;
      }
    }

    let newPosition = computeDropPosition(targetListWithoutActive, targetIndex);
    const representable = isPositionRepresentable(targetListWithoutActive, targetIndex, newPosition);

    if (!representable) {
      const rebalancedList = [...targetListWithoutActive];
      rebalancedList.splice(targetIndex, 0, activeMemo);

      for (let i = 0; i < rebalancedList.length; i++) {
        const item = rebalancedList[i];
        const normalizedPos = (i + 1) * 1.0;
        if (item.name === activeMemoName) {
          newPosition = normalizedPos;
        } else if (item.kanban?.position !== normalizedPos) {
          void updateMemoKanban.mutateAsync({
            name: item.name,
            kanban: create(KanbanSchema, {
              boardId,
              columnId: targetColumnId,
              position: normalizedPos,
            }),
          });
        }
      }
    }

    // Skip if dropped in same position and column
    if (sourceColumnId === targetColumnId && activeMemo.kanban?.position === newPosition && targetOverMemoName === activeMemoName) {
      return;
    }

    try {
      await updateMemoKanban.mutateAsync({
        name: activeMemoName,
        kanban: create(KanbanSchema, {
          boardId,
          columnId: targetColumnId,
          position: newPosition,
        }),
      });
    } catch {
      toast.error("Failed to move card");
    }
  };

  const handleUpdateColumns = async (newColumns: BoardColumn[]) => {
    try {
      await updateBoard.mutateAsync({
        board: { name: board.name, columns: newColumns },
        updateMask: ["columns"],
      });
    } catch (error) {
      handleError(error, toast.error, { context: "Update columns" });
    }
  };

  const handleRenameColumn = (columnId: string, newTitle: string) => {
    const newColumns = board.columns.map((col) => (col.id === columnId ? create(BoardColumnSchema, { ...col, title: newTitle }) : col));
    void handleUpdateColumns(newColumns);
  };

  const handleRecolorColumn = (columnId: string, newColor: string) => {
    const newColumns = board.columns.map((col) => (col.id === columnId ? create(BoardColumnSchema, { ...col, colorHex: newColor }) : col));
    void handleUpdateColumns(newColumns);
  };

  const handleMoveColumn = (index: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= board.columns.length) return;

    const newColumns = [...board.columns];
    const [moved] = newColumns.splice(index, 1);
    newColumns.splice(targetIndex, 0, moved);
    void handleUpdateColumns(newColumns);
  };

  const handleDeleteColumn = (columnId: string) => {
    if (board.columns.length <= 1) {
      toast.error(t("boards.cannot-delete-last-column"));
      return;
    }
    const newColumns = board.columns.filter((c) => c.id !== columnId);
    void handleUpdateColumns(newColumns);
  };

  const handleAddColumnSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newColumnTitle.trim();
    if (!trimmed) return;

    const newCol = create(BoardColumnSchema, {
      title: trimmed,
      colorHex: newColumnColor,
    });
    void handleUpdateColumns([...board.columns, newCol]);
    setNewColumnTitle("");
    setAddColumnDialogOpen(false);
  };

  const handleOpenAddMemo = (columnId?: string) => {
    setAddMemoColumnId(columnId || board.columns[0]?.id || "");
    setAddMemoDialogOpen(true);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Top Header Bar */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            to={ROUTES.BOARDS}
            className="flex size-8 items-center justify-center rounded-lg border border-border/80 bg-card text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Back to boards"
          >
            <ArrowLeftIcon className="size-4" />
          </Link>

          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <KanbanIcon className="size-4" />
            </div>
            <h1 className="text-lg font-bold text-foreground">{board.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleOpenAddMemo()}>
            <PlusIcon className="mr-1.5 size-3.5" />
            {t("boards.add-memo")}
          </Button>

          <Button size="sm" onClick={() => setAddColumnDialogOpen(true)}>
            <PlusIcon className="mr-1.5 size-3.5" />
            {t("boards.add-column")}
          </Button>
        </div>
      </div>

      {/* Horizontal Board Columns Container */}
      <div className="flex flex-1 items-start gap-4 overflow-x-auto p-4 sm:p-6 [scrollbar-width:thin]">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <SortableContext items={board.columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            {board.columns.map((column, idx) => (
              <KanbanColumn
                key={column.id}
                boardId={boardId}
                column={column}
                cards={columnCardsMap.get(column.id) || []}
                canMoveLeft={idx > 0}
                canMoveRight={idx < board.columns.length - 1}
                canDelete={board.columns.length > 1}
                onRename={(title) => handleRenameColumn(column.id, title)}
                onRecolor={(color) => handleRecolorColumn(column.id, color)}
                onMoveLeft={() => handleMoveColumn(idx, "left")}
                onMoveRight={() => handleMoveColumn(idx, "right")}
                onDelete={() => handleDeleteColumn(column.id)}
                onAddMemo={() => handleOpenAddMemo(column.id)}
                onSelectCard={(memo) => setSelectedMemoName(memo.name)}
                parentPage={`/boards/${boardId}`}
              />
            ))}
          </SortableContext>

          {/* New Column Button Placeholder */}
          <div className="flex w-80 shrink-0 flex-col">
            <Button
              variant="outline"
              className="h-12 w-full justify-start rounded-xl border-dashed text-muted-foreground hover:border-primary hover:text-primary"
              onClick={() => setAddColumnDialogOpen(true)}
            >
              <PlusIcon className="mr-2 size-4" />
              {t("boards.add-column")}
            </Button>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeColumn ? (
              <KanbanColumn
                column={activeColumn}
                cards={columnCardsMap.get(activeColumn.id) || []}
                canMoveLeft={false}
                canMoveRight={false}
                canDelete={false}
                onRename={() => {}}
                onRecolor={() => {}}
                onMoveLeft={() => {}}
                onMoveRight={() => {}}
                onDelete={() => {}}
                onAddMemo={() => {}}
                isOverlay
              />
            ) : activeCard ? (
              <KanbanCard memo={activeCard} columnId={activeCard.kanban?.columnId || ""} isOverlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Add Column Dialog */}
      <Dialog open={addColumnDialogOpen} onOpenChange={setAddColumnDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("boards.add-column")}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddColumnSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="column-title">{t("boards.column-title")}</Label>
              <Input
                id="column-title"
                autoFocus
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                placeholder={t("boards.column-title")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("boards.column-color")}</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {BOARD_COLUMN_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className="flex size-7 items-center justify-center rounded-full border border-border transition-transform hover:scale-110"
                    style={{
                      backgroundColor: color.value,
                      boxShadow:
                        newColumnColor === color.value ? "0 0 0 2px var(--color-background), 0 0 0 4px var(--color-primary)" : undefined,
                    }}
                    onClick={() => setNewColumnColor(color.value)}
                    aria-label={color.label}
                  />
                ))}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setAddColumnDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={!newColumnTitle.trim()}>
                {t("boards.add-column")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Memo Dialog */}
      <AddMemoToBoardDialog
        open={addMemoDialogOpen}
        onOpenChange={setAddMemoDialogOpen}
        boardId={boardId}
        columns={board.columns}
        initialColumnId={addMemoColumnId}
        existingColumnCards={columnCardsMap}
      />

      {/* Memo Detail Popup Modal */}
      <MemoDetailDialog
        memoName={selectedMemoName}
        open={!!selectedMemoName}
        onOpenChange={(open) => {
          if (!open) setSelectedMemoName(null);
        }}
        parentPage={`/boards/${boardId}`}
      />
    </div>
  );
};

export default BoardDetail;
