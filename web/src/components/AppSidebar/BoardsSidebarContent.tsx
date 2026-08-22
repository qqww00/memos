import { AlertCircleIcon, CheckCircle2Icon, ClockIcon, KanbanIcon, LayersIcon, MoreHorizontalIcon, PlusIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { matchPath, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CreateBoardDialog } from "@/components/Boards";
import { getCardCategories, getCategoryColor } from "@/components/Boards/cardUtils";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { boardIdFromName, useBoardCards, useBoards, useCreateBoard, useDeleteBoard, useUpdateBoard } from "@/hooks/useBoardQueries";
import { handleError } from "@/lib/error";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/router/routes";
import type { Board, BoardColumn } from "@/types/proto/api/v1/board_service_pb";
import { State } from "@/types/proto/api/v1/common_pb";
import { useTranslate } from "@/utils/i18n";
import SidebarRow, { SIDEBAR_ROW_CLASSES, SIDEBAR_ROW_COUNT_CLASSES, sidebarRowStateClasses } from "./SidebarRow";
import SidebarSection, {
  SIDEBAR_SECTION_ACTION_BUTTON_CLASSES,
  SIDEBAR_SECTION_ACTION_ICON_CLASSES,
  SIDEBAR_SECTION_STACK_CLASSES,
} from "./SidebarSection";

const ActiveBoardOverview = ({ boardId, board }: { boardId: string; board: Board }) => {
  const t = useTranslate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setMobileOpen } = useAppSidebar();
  const { data: cards = [] } = useBoardCards(boardId, { state: State.NORMAL });

  const activeDueFilter = searchParams.get("due");
  const activeStatusFilter = searchParams.get("status");

  // Calculate statistics
  const totalCards = cards.length;
  const closedCards = cards.filter((c) => c.kanban?.isClosed).length;
  const completionRate = totalCards > 0 ? Math.round((closedCards / totalCards) * 100) : 0;

  const nowSec = Math.floor(Date.now() / 1000);
  const todayEndSec = Math.floor(new Date().setHours(23, 59, 59, 999) / 1000);

  const overdueCards = useMemo(() => {
    return cards.filter((c) => {
      if (c.kanban?.isClosed) return false;
      const due = c.kanban?.dueTime ? Number(c.kanban.dueTime.seconds) : 0;
      return due > 0 && due < nowSec;
    });
  }, [cards, nowSec]);

  const dueTodayCards = useMemo(() => {
    return cards.filter((c) => {
      if (c.kanban?.isClosed) return false;
      const due = c.kanban?.dueTime ? Number(c.kanban.dueTime.seconds) : 0;
      return due >= nowSec && due <= todayEndSec;
    });
  }, [cards, nowSec, todayEndSec]);

  // Card count by column
  const columnCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const col of board.columns) {
      counts.set(col.id, 0);
    }
    for (const card of cards) {
      const colId = card.kanban?.columnId;
      if (colId && counts.has(colId)) {
        counts.set(colId, (counts.get(colId) ?? 0) + 1);
      }
    }
    return counts;
  }, [board.columns, cards]);

  const toggleDueFilter = (type: "overdue" | "today") => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (next.get("due") === type) {
        next.delete("due");
      } else {
        next.set("due", type);
      }
      return next;
    });
    setMobileOpen(false);
  };

  const toggleStatusFilter = (status: "active" | "completed") => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (next.get("status") === status) {
        next.delete("status");
      } else {
        next.set("status", status);
      }
      return next;
    });
    setMobileOpen(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <SidebarSection label={t("boards.progress") || "Board Progress"}>
        <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/60 p-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">{completionRate}% Completed</span>
            <span className="text-muted-foreground tabular-nums">
              {closedCards}/{totalCards}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/80">
            <div className="h-full rounded-full bg-primary transition-all duration-300 ease-out" style={{ width: `${completionRate}%` }} />
          </div>
        </div>

        {/* Column breakdown */}
        <div className="mt-1 flex flex-col gap-1">
          {board.columns.map((column) => {
            const count = columnCounts.get(column.id) ?? 0;
            return (
              <div
                key={column.id}
                className="flex items-center justify-between rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: column.colorHex || "#64748b" }} />
                  <span className="truncate">{column.title}</span>
                </div>
                <span className={SIDEBAR_ROW_COUNT_CLASSES}>{count}</span>
              </div>
            );
          })}
        </div>
      </SidebarSection>

      {/* Deadlines & Attention Alerts */}
      <SidebarSection label={t("boards.attention") || "Deadlines"}>
        <SidebarRow
          active={activeDueFilter === "overdue"}
          icon={AlertCircleIcon}
          label={t("boards.overdue") || "Overdue"}
          count={overdueCards.length}
          onClick={() => toggleDueFilter("overdue")}
        />
        <SidebarRow
          active={activeDueFilter === "today"}
          icon={ClockIcon}
          label={t("boards.due-today") || "Due Today"}
          count={dueTodayCards.length}
          onClick={() => toggleDueFilter("today")}
        />
        <SidebarRow
          active={activeStatusFilter === "completed"}
          icon={CheckCircle2Icon}
          label={t("boards.completed") || "Completed"}
          count={closedCards}
          onClick={() => toggleStatusFilter("completed")}
        />
      </SidebarSection>
    </div>
  );
};

const ActiveBoardCategories = ({ boardId }: { boardId: string }) => {
  const t = useTranslate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setMobileOpen } = useAppSidebar();
  const { data: cards = [] } = useBoardCards(boardId, { state: State.NORMAL });
  const activeCategory = searchParams.get("category");

  const categoriesWithCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const card of cards) {
      for (const cat of getCardCategories(card.kanban)) {
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).map(([name, count]) => ({
      name,
      count,
      color: getCategoryColor(name),
    }));
  }, [cards]);

  const toggleCategory = (categoryName: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (next.get("category") === categoryName) {
        next.delete("category");
      } else {
        next.set("category", categoryName);
      }
      return next;
    });
    setMobileOpen(false);
  };

  const clearCategory = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("category");
      return next;
    });
  };

  if (categoriesWithCount.length === 0) {
    return null;
  }

  return (
    <SidebarSection
      label={t("boards.categories") || "Categories"}
      action={
        activeCategory && (
          <Button
            variant="ghost"
            size="icon-sm"
            className={SIDEBAR_SECTION_ACTION_BUTTON_CLASSES}
            onClick={clearCategory}
            title={t("common.clear") || "Clear filter"}
          >
            <XIcon className={SIDEBAR_SECTION_ACTION_ICON_CLASSES} />
          </Button>
        )
      }
    >
      {categoriesWithCount.map(({ name, count, color }) => {
        const isActive = activeCategory === name;
        return (
          <button
            key={name}
            type="button"
            onClick={() => toggleCategory(name)}
            aria-pressed={isActive || undefined}
            className={cn(SIDEBAR_ROW_CLASSES, sidebarRowStateClasses(isActive))}
          >
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="min-w-0 flex-1 truncate text-left">{name}</span>
            <span className={SIDEBAR_ROW_COUNT_CLASSES}>{count}</span>
          </button>
        );
      })}
    </SidebarSection>
  );
};

const GlobalBoardsOverview = ({ boards }: { boards: Board[] }) => {
  const t = useTranslate();

  return (
    <SidebarSection label={t("boards.overview") || "Overview"}>
      <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/60 p-3 shadow-2xs">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <LayersIcon className="size-4 text-primary" />
          <span>{boards.length} Boards available</span>
        </div>
        <p className="text-xs text-muted-foreground/80 leading-relaxed">
          Select a board above to view progress, columns breakdown, deadlines, and filter by categories.
        </p>
      </div>
    </SidebarSection>
  );
};

const BoardRowItem = ({
  board,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  board: Board;
  active: boolean;
  onSelect: (boardId: string) => void;
  onRename: (board: Board) => void;
  onDelete: (board: Board) => void;
}) => {
  const t = useTranslate();
  const boardId = boardIdFromName(board.name);
  const { data: cards = [] } = useBoardCards(boardId, { state: State.NORMAL });

  return (
    <div className={cn(SIDEBAR_ROW_CLASSES, "group/board", sidebarRowStateClasses(active))}>
      <button
        type="button"
        onClick={() => onSelect(boardId)}
        aria-pressed={active || undefined}
        className="flex h-full min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="min-w-0 flex-1 truncate">{board.title}</span>
        {cards.length > 0 && <span className={SIDEBAR_ROW_COUNT_CLASSES}>{cards.length}</span>}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          nativeButton={false}
          render={
            <span
              role="button"
              tabIndex={0}
              aria-label={`${t("common.edit")} ${board.title}`}
              className="-mr-1 flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-opacity hover:bg-background/70 md:opacity-0 md:group-hover/board:opacity-100 md:focus-visible:opacity-100 data-popup-open:opacity-100"
            />
          }
        >
          <MoreHorizontalIcon className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={2} size="sm">
          <DropdownMenuItem onClick={() => onRename(board)}>{t("common.rename") || "Rename"}</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(board)}>
            {t("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export const BoardsSidebarContent = () => {
  const t = useTranslate();
  const location = useLocation();
  const navigate = useNavigate();
  const { setMobileOpen } = useAppSidebar();
  const { data: boards = [] } = useBoards();

  const createBoard = useCreateBoard();
  const updateBoard = useUpdateBoard();
  const deleteBoard = useDeleteBoard();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<Board>();
  const [editTitle, setEditTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Board>();

  // Determine active board ID from URL path "/boards/:boardId"
  const boardMatch = matchPath("/boards/:boardId", location.pathname);
  const activeBoardId = boardMatch?.params.boardId;
  const activeBoard = useMemo(() => {
    if (!activeBoardId) return undefined;
    return boards.find((b) => boardIdFromName(b.name) === activeBoardId);
  }, [boards, activeBoardId]);

  const handleSelectBoard = (boardId: string) => {
    navigate(`/boards/${boardId}`);
    setMobileOpen(false);
  };

  const handleCreate = async ({ title, columns }: { title: string; columns: BoardColumn[] }) => {
    try {
      const created = await createBoard.mutateAsync({ title, columns });
      toast.success(t("boards.create-board"));
      const newBoardId = boardIdFromName(created.name);
      if (newBoardId) {
        navigate(`/boards/${newBoardId}`);
      }
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
      const deletedId = boardIdFromName(deleteTarget.name);
      await deleteBoard.mutateAsync(deleteTarget.name);
      toast.success(t("boards.delete-board"));
      if (activeBoardId === deletedId) {
        navigate(ROUTES.BOARDS);
      }
    } catch (error) {
      handleError(error, toast.error, { context: "Delete board" });
    } finally {
      setDeleteTarget(undefined);
    }
  };

  return (
    <div className={SIDEBAR_SECTION_STACK_CLASSES}>
      <SidebarSection
        label={t("boards.title") || "Boards"}
        action={
          <Button
            variant="ghost"
            size="icon-sm"
            className={SIDEBAR_SECTION_ACTION_BUTTON_CLASSES}
            onClick={() => setCreateDialogOpen(true)}
            aria-label={t("boards.new-board") || "New board"}
            title={t("boards.new-board") || "New board"}
          >
            <PlusIcon className={SIDEBAR_SECTION_ACTION_ICON_CLASSES} strokeWidth={1.8} />
          </Button>
        }
      >
        <SidebarRow
          active={location.pathname === ROUTES.BOARDS}
          icon={KanbanIcon}
          label={t("common.all") || "All Boards"}
          onClick={() => {
            navigate(ROUTES.BOARDS);
            setMobileOpen(false);
          }}
        />

        {boards.map((board) => {
          const boardId = boardIdFromName(board.name);
          const active = activeBoardId === boardId;

          return (
            <BoardRowItem
              key={board.name}
              board={board}
              active={active}
              onSelect={handleSelectBoard}
              onRename={(b) => {
                handleOpenRename(b);
                setMobileOpen(false);
              }}
              onDelete={(b) => {
                setDeleteTarget(b);
                setMobileOpen(false);
              }}
            />
          );
        })}
      </SidebarSection>

      {/* Adaptive context: Active board progress & filters vs Global overview */}
      {activeBoardId && activeBoard ? (
        <>
          <ActiveBoardOverview boardId={activeBoardId} board={activeBoard} />
          <ActiveBoardCategories boardId={activeBoardId} />
        </>
      ) : (
        <GlobalBoardsOverview boards={boards} />
      )}

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
                  void handleSaveRename();
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

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t("boards.delete-confirm", { title: deleteTarget?.title ?? "" })}
        description={t("boards.delete-confirm-description")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleDelete}
        confirmVariant="destructive"
      />
    </div>
  );
};

export default BoardsSidebarContent;
