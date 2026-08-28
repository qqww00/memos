import { create } from "@bufbuild/protobuf";
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  ArrowLeftIcon,
  CalendarIcon,
  CheckIcon,
  FilterIcon,
  KanbanIcon,
  PlusIcon,
  RocketIcon,
  RotateCcwIcon,
  TagIcon,
  TargetIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AddMemoToBoardDialog, BOARD_COLUMN_COLORS, KanbanCard, KanbanColumn, MemoDetailDialog } from "@/components/Boards";
import { getCardCategories, getCardMilestone, getCategoryColor, getMilestoneColor } from "@/components/Boards/cardUtils";
import { MilestonesRoadmapView } from "@/components/Boards/MilestonesRoadmapView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { cn } from "@/lib/utils";
import { ROUTES } from "@/router/routes";
import { BoardColumn, BoardColumnSchema } from "@/types/proto/api/v1/board_service_pb";
import { State } from "@/types/proto/api/v1/common_pb";
import { KanbanSchema, type Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

export const BoardDetail = () => {
  const t = useTranslate();
  const navigate = useNavigate();
  const { boardId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeView, setActiveView] = useState<"kanban" | "milestones">("kanban");

  // Filters state synchronized via URL search parameters
  const filterStatus = (searchParams.get("status") as "all" | "active" | "completed" | "archived") || "all";
  const filterCategory = searchParams.get("category");
  const filterMilestone = searchParams.get("milestone");
  const filterDue = searchParams.get("due");
  const dueDateFrom = searchParams.get("dueFrom") || "";
  const dueDateTo = searchParams.get("dueTo") || "";

  const setFilterMilestone = (milestone: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!milestone) next.delete("milestone");
      else next.set("milestone", milestone);
      return next;
    });
  };

  const setFilterStatus = (status: "all" | "active" | "completed" | "archived") => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (status === "all") next.delete("status");
      else next.set("status", status);
      return next;
    });
  };

  const setFilterCategory = (category: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!category) next.delete("category");
      else next.set("category", category);
      return next;
    });
  };

  const setDueDateFrom = (from: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!from) next.delete("dueFrom");
      else next.set("dueFrom", from);
      return next;
    });
  };

  const setDueDateTo = (to: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!to) next.delete("dueTo");
      else next.set("dueTo", to);
      return next;
    });
  };

  const { data: boards = [], isLoading: isBoardsLoading } = useBoards();
  const { data: cards = [], isLoading: isCardsLoading } = useBoardCards(boardId, {
    state: filterStatus === "archived" ? State.ARCHIVED : State.NORMAL,
  });

  const updateBoard = useUpdateBoard();
  const updateMemoKanban = useUpdateMemoKanban();

  const board = useMemo(() => boards.find((b) => boardIdFromName(b.name) === boardId), [boards, boardId]);

  // Extract unique categories across cards for filtering
  const availableCategories = useMemo(() => {
    const map = new Map<string, string>();
    for (const card of cards) {
      if (card.kanban) {
        for (const c of getCardCategories(card.kanban)) {
          if (!map.has(c)) {
            const cardColor =
              card.kanban.category === c && card.kanban.categoryColorHex
                ? card.kanban.categoryColorHex
                : getCategoryColor(c, undefined, board?.categoryColors);
            map.set(c, cardColor);
          }
        }
      }
    }
    return Array.from(map.entries()).map(([name, color]) => ({ name, color }));
  }, [cards, board?.categoryColors]);

  // Extract unique milestones across cards for filtering & milestone tracking
  const allMilestones = useMemo(() => {
    const set = new Set<string>();
    for (const card of cards) {
      const m = getCardMilestone(card.kanban);
      if (m) {
        set.add(m);
      }
    }
    return Array.from(set).sort();
  }, [cards]);

  // Active milestone summary
  const activeMilestoneSummary = useMemo(() => {
    if (!filterMilestone) return null;
    const milestoneCards = cards.filter((c) => getCardMilestone(c.kanban) === filterMilestone);
    const total = milestoneCards.length;
    const closedCount = milestoneCards.filter((c) => c.kanban?.isClosed).length;
    const percent = total > 0 ? Math.round((closedCount / total) * 100) : 0;
    return {
      name: filterMilestone,
      total,
      closedCount,
      inProgressCount: total - closedCount,
      percent,
      color: getMilestoneColor(filterMilestone),
    };
  }, [cards, filterMilestone]);

  // Dialog states
  const [addColumnDialogOpen, setAddColumnDialogOpen] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [newColumnColor, setNewColumnColor] = useState<string>(BOARD_COLUMN_COLORS[0].value);
  const [newColumnWipLimit, setNewColumnWipLimit] = useState("");
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

  const hasActiveFilters =
    filterStatus !== "all" ||
    filterCategory !== null ||
    filterMilestone !== null ||
    Boolean(filterDue) ||
    Boolean(dueDateFrom) ||
    Boolean(dueDateTo);

  const handleClearAllFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const columnCardsMap = useMemo(() => {
    const columnIds = board?.columns.map((c) => c.id) || [];
    const fromSec = dueDateFrom ? Math.floor(new Date(`${dueDateFrom}T00:00:00`).getTime() / 1000) : null;
    const toSec = dueDateTo ? Math.floor(new Date(`${dueDateTo}T23:59:59`).getTime() / 1000) : null;
    const nowSec = Math.floor(Date.now() / 1000);
    const todayEndSec = Math.floor(new Date().setHours(23, 59, 59, 999) / 1000);

    const filteredCards = cards.filter((memo) => {
      // 1. Status Filter
      if (filterStatus === "active") {
        if (memo.kanban?.isClosed) return false;
      } else if (filterStatus === "completed") {
        if (!memo.kanban?.isClosed) return false;
      }

      // 2. Category Filter
      if (filterCategory) {
        const cats = getCardCategories(memo.kanban);
        if (!cats.includes(filterCategory)) return false;
      }

      // 3. Milestone Filter
      if (filterMilestone) {
        const m = getCardMilestone(memo.kanban);
        if (m !== filterMilestone) return false;
      }

      // 4. Due Preset Filter (Overdue / Today)
      if (filterDue === "overdue") {
        if (memo.kanban?.isClosed) return false;
        const dueSec = memo.kanban?.dueTime ? Number(memo.kanban.dueTime.seconds) : 0;
        if (dueSec === 0 || dueSec >= nowSec) return false;
      } else if (filterDue === "today") {
        if (memo.kanban?.isClosed) return false;
        const dueSec = memo.kanban?.dueTime ? Number(memo.kanban.dueTime.seconds) : 0;
        if (dueSec < nowSec || dueSec > todayEndSec) return false;
      }

      // 5. Due Date Range Filter
      if (fromSec !== null || toSec !== null) {
        const dueSec = memo.kanban?.dueTime ? Number(memo.kanban.dueTime.seconds) : null;
        if (dueSec === null) return false;
        if (fromSec !== null && dueSec < fromSec) return false;
        if (toSec !== null && dueSec > toSec) return false;
      }

      return true;
    });

    return groupCardsByColumn(filteredCards, columnIds);
  }, [cards, board?.columns, filterStatus, filterCategory, filterMilestone, filterDue, dueDateFrom, dueDateTo]);

  const [overTargetState, setOverTargetState] = useState<{
    cardName: string;
    targetColumnId: string;
    targetIndex: number;
  } | null>(null);

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

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setOverTargetState(null);
      return;
    }
    const activeData = active.data.current;
    if (activeData?.type !== "card") return;

    const activeMemoName = String(active.id);
    const overData = over.data.current;

    let targetColumnId = "";
    let targetOverMemoName = "";

    if (overData?.type === "column") {
      targetColumnId = overData.columnId;
    } else if (overData?.type === "card") {
      targetColumnId = overData.columnId;
      targetOverMemoName = String(over.id);
    } else if (board?.columns.some((col) => col.id === over.id)) {
      targetColumnId = String(over.id);
    } else {
      const overMemo = cards.find((c) => c.name === over.id);
      if (overMemo?.kanban?.columnId) {
        targetColumnId = overMemo.kanban.columnId;
        targetOverMemoName = overMemo.name;
      }
    }

    if (!targetColumnId) {
      setOverTargetState(null);
      return;
    }

    const colCards = columnCardsMap.get(targetColumnId) || [];
    const listWithout = colCards.filter((c) => c.name !== activeMemoName);
    let targetIndex = listWithout.length;
    if (targetOverMemoName) {
      const idx = listWithout.findIndex((c) => c.name === targetOverMemoName);
      if (idx !== -1) {
        targetIndex = idx;
      }
    }

    setOverTargetState((prev) => {
      if (prev && prev.cardName === activeMemoName && prev.targetColumnId === targetColumnId && prev.targetIndex === targetIndex) {
        return prev;
      }
      return {
        cardName: activeMemoName,
        targetColumnId,
        targetIndex,
      };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);
    setActiveColumn(null);
    setOverTargetState(null);

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

    // If card was dropped back onto itself in the same column, no-op.
    if (sourceColumnId === targetColumnId && (targetOverMemoName === activeMemoName || String(active.id) === String(over.id))) {
      return;
    }

    const targetColumnCards = columnCardsMap.get(targetColumnId) || [];
    const targetListWithoutActive = targetColumnCards.filter((c) => c.name !== activeMemoName);

    let targetIndex = targetListWithoutActive.length;
    if (targetOverMemoName) {
      const idx = targetListWithoutActive.findIndex((c) => c.name === targetOverMemoName);
      if (idx !== -1) {
        // When dragging within the same column, we need to determine the drop direction:
        // - Dragging DOWN (source was above target): insert AFTER the target card.
        // - Dragging UP (source was below target): insert BEFORE the target card.
        // Without this, dragging a card from top to bottom always ends up before the
        // hovered card (i.e., it never actually moves down).
        const sourceIndex = targetColumnCards.findIndex((c) => c.name === activeMemoName);
        const targetInOriginal = targetColumnCards.findIndex((c) => c.name === targetOverMemoName);
        const isDraggingDown = sourceColumnId === targetColumnId && sourceIndex < targetInOriginal;
        targetIndex = isDraggingDown ? idx + 1 : idx;
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
            // Preserve all existing kanban fields; only update columnId and position.
            kanban: create(KanbanSchema, {
              boardId,
              columnId: targetColumnId,
              position: normalizedPos,
              category: item.kanban?.category,
              categoryColorHex: item.kanban?.categoryColorHex,
              categories: item.kanban?.categories ?? (item.kanban?.category ? [item.kanban.category] : []),
              milestone: item.kanban?.milestone,
              dueTime: item.kanban?.dueTime,
              isClosed: item.kanban?.isClosed,
            }),
          });
        }
      }
    }

    // Skip if card was dropped back onto the same column at the same position.
    if (sourceColumnId === targetColumnId && activeMemo.kanban?.position === newPosition) {
      return;
    }

    try {
      await updateMemoKanban.mutateAsync({
        name: activeMemoName,
        // Preserve all existing kanban fields; only override columnId and position.
        kanban: create(KanbanSchema, {
          boardId,
          columnId: targetColumnId,
          position: newPosition,
          category: activeMemo.kanban?.category,
          categoryColorHex: activeMemo.kanban?.categoryColorHex,
          categories: activeMemo.kanban?.categories ?? (activeMemo.kanban?.category ? [activeMemo.kanban.category] : []),
          milestone: activeMemo.kanban?.milestone,
          dueTime: activeMemo.kanban?.dueTime,
          isClosed: activeMemo.kanban?.isClosed,
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

  const handleSetWipLimit = (columnId: string, wipLimit: number) => {
    const newColumns = board.columns.map((col) => (col.id === columnId ? create(BoardColumnSchema, { ...col, wipLimit }) : col));
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

    const parsedWip = Number.parseInt(newColumnWipLimit.trim(), 10);
    const wipLimit = Number.isNaN(parsedWip) || parsedWip < 0 ? 0 : parsedWip;

    const newCol = create(BoardColumnSchema, {
      title: trimmed,
      colorHex: newColumnColor,
      wipLimit,
    });
    void handleUpdateColumns([...board.columns, newCol]);
    setNewColumnTitle("");
    setNewColumnWipLimit("");
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

          {/* View Switcher Tabs */}
          <div className="flex items-center rounded-lg border border-border/80 bg-muted/40 p-0.5 ml-2 hidden md:flex">
            <button
              type="button"
              onClick={() => setActiveView("kanban")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                activeView === "kanban" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <KanbanIcon className="size-3.5" />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView("milestones")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                activeView === "milestones" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <RocketIcon className="size-3.5" />
              <span>Milestones Roadmap</span>
            </button>
          </div>
        </div>

        {/* Filters & Actions Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Milestone Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "gap-1.5 text-xs text-muted-foreground hover:text-foreground",
                    filterMilestone && "border-primary/60 text-primary bg-primary/5 font-semibold",
                  )}
                >
                  <TargetIcon className="size-3.5" />
                  <span className="truncate max-w-[100px]">{filterMilestone ? filterMilestone : "Milestone"}</span>
                  {filterMilestone && (
                    <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: getMilestoneColor(filterMilestone) }} />
                  )}
                </Button>
              }
            />
            <DropdownMenuContent align="end" size="sm" className="w-48 max-h-64 overflow-y-auto">
              <DropdownMenuItem onClick={() => setFilterMilestone(null)}>All milestones</DropdownMenuItem>
              {allMilestones.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">No milestones assigned</div>
              ) : (
                allMilestones.map((m) => {
                  const color = getMilestoneColor(m);
                  const isSelected = filterMilestone === m;
                  return (
                    <DropdownMenuItem
                      key={m}
                      onClick={() => setFilterMilestone(isSelected ? null : m)}
                      className="flex items-center justify-between gap-1"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="truncate">{m}</span>
                      </div>
                      {isSelected && <CheckIcon className="size-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  );
                })
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 1. Status Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "gap-1.5 text-xs text-muted-foreground hover:text-foreground",
                    filterStatus !== "all" && "border-primary/60 text-primary bg-primary/5",
                  )}
                >
                  <FilterIcon className="size-3.5" />
                  <span className="capitalize">
                    {filterStatus === "all"
                      ? "All cards"
                      : filterStatus === "active"
                        ? "Active only"
                        : filterStatus === "completed"
                          ? "Completed only"
                          : "Archived"}
                  </span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" size="sm">
              <DropdownMenuItem onClick={() => setFilterStatus("all")}>All cards</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("active")}>Active only</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("completed")}>Completed only</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("archived")}>Archived</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 2. Category Filter Dropdown (Separate) */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "gap-1.5 text-xs text-muted-foreground hover:text-foreground",
                    filterCategory && "border-primary/60 text-primary bg-primary/5",
                  )}
                >
                  <TagIcon className="size-3.5" />
                  <span className="truncate max-w-[110px]">{filterCategory ? filterCategory : "Category"}</span>
                  {filterCategory && (
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          availableCategories.find((c) => c.name === filterCategory)?.color || getCategoryColor(filterCategory),
                      }}
                    />
                  )}
                </Button>
              }
            />
            <DropdownMenuContent align="end" size="sm" className="w-48 max-h-64 overflow-y-auto">
              <DropdownMenuItem onClick={() => setFilterCategory(null)}>All categories</DropdownMenuItem>
              {availableCategories.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">No categories</div>
              ) : (
                availableCategories.map((item) => {
                  const isSelected = filterCategory === item.name;
                  return (
                    <DropdownMenuItem
                      key={item.name}
                      onClick={() => setFilterCategory(isSelected ? null : item.name)}
                      className="flex items-center justify-between gap-1"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="truncate">{item.name}</span>
                      </div>
                      {isSelected && <CheckIcon className="size-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  );
                })
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 3. Due Date Range Filter Popover (Separate) */}
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "gap-1.5 text-xs text-muted-foreground hover:text-foreground",
                    (dueDateFrom || dueDateTo || filterDue) && "border-primary/60 text-primary bg-primary/5",
                  )}
                >
                  <CalendarIcon className="size-3.5" />
                  <span className="truncate max-w-[130px]">
                    {filterDue === "overdue"
                      ? "Overdue"
                      : filterDue === "today"
                        ? "Due Today"
                        : dueDateFrom || dueDateTo
                          ? `${dueDateFrom || "..."} → ${dueDateTo || "..."}`
                          : "Due Date"}
                  </span>
                </Button>
              }
            />
            <PopoverContent align="end" className="w-72 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Due Date Range</span>
                {(dueDateFrom || dueDateTo || filterDue) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDueDateFrom("");
                      setDueDateTo("");
                      setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.delete("due");
                        return next;
                      });
                    }}
                    className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <Label htmlFor="filter-due-from" className="text-[11px] text-muted-foreground">
                    From
                  </Label>
                  <Input
                    id="filter-due-from"
                    type="date"
                    value={dueDateFrom}
                    onChange={(e) => setDueDateFrom(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="filter-due-to" className="text-[11px] text-muted-foreground">
                    To
                  </Label>
                  <Input
                    id="filter-due-to"
                    type="date"
                    value={dueDateTo}
                    onChange={(e) => setDueDateTo(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1 pt-1 border-t border-border/40">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    setDueDateFrom(today);
                    setDueDateTo(today);
                  }}
                >
                  Today
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => {
                    const now = new Date();
                    const day = now.getDay();
                    const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
                    const monday = new Date(now.setDate(diffToMonday));
                    const sunday = new Date(monday);
                    sunday.setDate(monday.getDate() + 6);
                    setDueDateFrom(monday.toISOString().slice(0, 10));
                    setDueDateTo(sunday.toISOString().slice(0, 10));
                  }}
                >
                  This week
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => {
                    const now = new Date();
                    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    setDueDateFrom(startOfMonth.toISOString().slice(0, 10));
                    setDueDateTo(endOfMonth.toISOString().slice(0, 10));
                  }}
                >
                  This month
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] text-destructive hover:text-destructive"
                  onClick={() => {
                    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
                    setDueDateFrom("2000-01-01");
                    setDueDateTo(yesterday);
                  }}
                >
                  Overdue
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Reset Filters button if any active */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8 text-muted-foreground hover:text-foreground"
              onClick={handleClearAllFilters}
              title="Reset all filters"
            >
              <RotateCcwIcon className="size-3.5" />
            </Button>
          )}

          <div className="h-4 w-px bg-border mx-0.5 hidden sm:block" />

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

      {/* Milestone Progress Banner (when milestone filter active in Kanban) */}
      {filterMilestone && activeMilestoneSummary && activeView === "kanban" && (
        <div className="mx-4 sm:mx-6 mt-3 flex items-center justify-between gap-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: activeMilestoneSummary.color }} />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-foreground truncate">Milestone: {activeMilestoneSummary.name}</h4>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  {activeMilestoneSummary.closedCount}/{activeMilestoneSummary.total} Tasks Completed ({activeMilestoneSummary.percent}%)
                </Badge>
              </div>
              <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-primary/20">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${activeMilestoneSummary.percent}%` }}
                />
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setFilterMilestone(null)}
          >
            Clear Filter
          </Button>
        </div>
      )}

      {/* Main View Area: Either Milestones Roadmap OR Horizontal Kanban Columns */}
      {activeView === "milestones" ? (
        <MilestonesRoadmapView
          board={board}
          cards={cards}
          onSelectCard={(memo) => setSelectedMemoName(memo.name)}
          onFilterMilestone={(m) => {
            setFilterMilestone(m);
            setActiveView("kanban");
          }}
        />
      ) : (
        <div className="flex flex-1 items-start gap-4 overflow-x-auto p-4 sm:p-6 [scrollbar-width:thin]">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={() => {
              setActiveCard(null);
              setActiveColumn(null);
              setOverTargetState(null);
            }}
          >
            <SortableContext items={board.columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
              {board.columns.map((column, idx) => {
                const isCrossColumnTarget =
                  activeCard && activeCard.kanban?.columnId !== column.id && overTargetState?.targetColumnId === column.id;
                const dropIndicatorIndex = isCrossColumnTarget ? overTargetState.targetIndex : null;

                return (
                  <KanbanColumn
                    key={column.id}
                    boardId={boardId}
                    column={column}
                    cards={columnCardsMap.get(column.id) || []}
                    dropIndicatorIndex={dropIndicatorIndex}
                    canMoveLeft={idx > 0}
                    canMoveRight={idx < board.columns.length - 1}
                    canDelete={board.columns.length > 1}
                    onRename={(title) => handleRenameColumn(column.id, title)}
                    onRecolor={(color) => handleRecolorColumn(column.id, color)}
                    onSetWipLimit={(limit) => handleSetWipLimit(column.id, limit)}
                    onMoveLeft={() => handleMoveColumn(idx, "left")}
                    onMoveRight={() => handleMoveColumn(idx, "right")}
                    onDelete={() => handleDeleteColumn(column.id)}
                    onAddMemo={() => handleOpenAddMemo(column.id)}
                    onSelectCard={(memo) => setSelectedMemoName(memo.name)}
                    parentPage={`/boards/${boardId}`}
                  />
                );
              })}
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
      )}

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
              <Label htmlFor="column-wip-limit">WIP Limit (optional)</Label>
              <Input
                id="column-wip-limit"
                type="number"
                min="0"
                max="100"
                value={newColumnWipLimit}
                onChange={(e) => setNewColumnWipLimit(e.target.value)}
                placeholder="e.g. 3 (0 = Unlimited)"
                className="h-8 text-sm"
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
