import { create } from "@bufbuild/protobuf";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CalendarIcon,
  CheckCircle2Icon,
  CheckSquareIcon,
  CircleIcon,
  GlobeIcon,
  GripVerticalIcon,
  LockIcon,
  LogOutIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PaperclipIcon,
  TargetIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useUpdateMemoKanban } from "@/hooks/useBoardQueries";
import { useDeleteMemo, useUpdateMemo } from "@/hooks/useMemoQueries";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import { KanbanSchema, type Memo, MemoRelation_Type, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import {
  computeDeadlineProgress,
  getCardCategories,
  getCardMilestone,
  getCategoryColor,
  getMilestoneColor,
  parseCardContent,
  parseTaskLists,
  toggleTaskListItem,
} from "./cardUtils";

interface KanbanCardProps {
  memo: Memo;
  columnId: string;
  parentPage?: string;
  isOverlay?: boolean;
  onSelect?: (memo: Memo) => void;
}

export const KanbanCard = ({ memo, columnId, isOverlay = false, onSelect }: KanbanCardProps) => {
  const t = useTranslate();
  const updateMemoKanban = useUpdateMemoKanban();
  const { mutateAsync: deleteMemo } = useDeleteMemo();
  const { mutateAsync: updateMemo } = useUpdateMemo();
  const [showAllSubtasks, setShowAllSubtasks] = useState(false);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: memo.name,
    data: {
      type: "card",
      memo,
      columnId,
    },
    disabled: isOverlay,
    animateLayoutChanges: () => false,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
  };

  const { title, description } = parseCardContent(memo.content);
  const taskSummary = useMemo(() => parseTaskLists(memo.content), [memo.content]);
  const isClosed = Boolean(memo.kanban?.isClosed);
  const isArchived = memo.state === State.ARCHIVED;
  const categories = getCardCategories(memo.kanban);
  const milestone = getCardMilestone(memo.kanban);

  const createSeconds = memo.createTime ? Number(memo.createTime.seconds) : undefined;
  const dueSeconds = memo.kanban?.dueTime ? Number(memo.kanban.dueTime.seconds) : undefined;
  const deadline = computeDeadlineProgress(createSeconds, dueSeconds);

  const commentsCount = memo.relations.filter((r) => r.type === MemoRelation_Type.COMMENT && r.relatedMemo?.name === memo.name).length;
  const attachmentsCount = memo.attachments.length;

  const handleToggleSubtask = async (e: React.MouseEvent, itemIndex: number, currentChecked: boolean) => {
    e.stopPropagation();
    const updatedContent = toggleTaskListItem(memo.content, itemIndex, !currentChecked);
    try {
      await updateMemo({
        update: {
          name: memo.name,
          content: updatedContent,
        },
        updateMask: ["content"],
      });
    } catch {
      toast.error("Failed to update checklist item");
    }
  };

  const handleToggleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateMemoKanban.mutateAsync({
        name: memo.name,
        kanban: create(KanbanSchema, {
          boardId: memo.kanban?.boardId || "",
          columnId: memo.kanban?.columnId || columnId,
          position: memo.kanban?.position || 0,
          category: memo.kanban?.category,
          categoryColorHex: memo.kanban?.categoryColorHex,
          categories: memo.kanban?.categories ?? [],
          milestone: memo.kanban?.milestone,
          dueTime: memo.kanban?.dueTime,
          isClosed: !isClosed,
        }),
      });
      toast.success(isClosed ? "Card reopened" : "Card completed");
    } catch {
      toast.error("Failed to update card status");
    }
  };

  const handleRemoveFromBoard = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateMemoKanban.mutateAsync({
        name: memo.name,
        kanban: undefined,
      });
      toast.success(t("boards.removed-from-board"));
    } catch {
      toast.error("Failed to remove from board");
    }
  };

  const handleToggleArchiveMemo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = isArchived ? State.NORMAL : State.ARCHIVED;
    const successMsg = isArchived
      ? t("message.restored-successfully") || "Memo restored"
      : t("message.archived-successfully") || "Memo archived";
    try {
      await updateMemo({
        update: {
          name: memo.name,
          state: newState,
        },
        updateMask: ["state"],
      });
      toast.success(successMsg);
    } catch {
      toast.error(isArchived ? "Failed to restore memo" : "Failed to archive memo");
    }
  };

  const handleDeleteMemo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteMemo(memo.name);
      toast.success("Memo deleted");
    } catch {
      toast.error("Failed to delete memo");
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("[role='menuitem']") ||
      target.closest(".memo-action-menu") ||
      target.closest("a")
    ) {
      return;
    }
    onSelect?.(memo);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        "group/card relative rounded-lg border border-border bg-card p-3 shadow-2xs select-none touch-none hover:border-primary/50 transition-all cursor-pointer space-y-2",
        isDragging && "opacity-25",
        isOverlay && "shadow-xl ring-2 ring-primary/50 cursor-grabbing z-50 bg-card opacity-95",
        isClosed && "bg-muted/30 border-dashed border-border/70",
      )}
    >
      {/* Header bar: Category badge + Feature badge + Checkbox + Grip + Menu */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
          <button
            type="button"
            onClick={handleToggleClose}
            className="text-muted-foreground hover:text-primary transition-colors shrink-0 cursor-pointer"
            title={isClosed ? "Mark incomplete" : "Mark complete"}
          >
            {isClosed ? (
              <CheckCircle2Icon className="size-4 text-emerald-500 fill-emerald-500/20" />
            ) : (
              <CircleIcon className="size-4 text-muted-foreground/60 hover:text-foreground" />
            )}
          </button>

          {milestone && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold truncate max-w-[130px] shadow-2xs"
              style={{
                backgroundColor: `${getMilestoneColor(milestone)}20`,
                color: getMilestoneColor(milestone),
                border: `1px solid ${getMilestoneColor(milestone)}50`,
              }}
              title={`Milestone: ${milestone}`}
            >
              <TargetIcon className="size-2.5 shrink-0" />
              <span className="truncate">{milestone}</span>
            </span>
          )}

          {categories.map((cat) => {
            const color = getCategoryColor(cat, memo.kanban?.categoryColorHex);
            return (
              <span
                key={cat}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium truncate max-w-[120px]"
                style={{
                  backgroundColor: `${color}20`,
                  color,
                  border: `1px solid ${color}40`,
                }}
              >
                {cat}
              </span>
            );
          })}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <div
            className="flex size-5 items-center justify-center text-muted-foreground/40 opacity-0 group-hover/card:opacity-100 transition-opacity"
            title="Drag card"
          >
            <GripVerticalIcon className="size-3.5" />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-5 text-muted-foreground/60 hover:text-foreground opacity-0 group-hover/card:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontalIcon className="size-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" size="sm">
              <DropdownMenuItem onClick={handleToggleClose}>
                <CheckCircle2Icon className="size-3.5 mr-2" />
                <span>{isClosed ? "Reopen card" : "Close card"}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleArchiveMemo}>
                {isArchived ? <ArchiveRestoreIcon className="size-3.5 mr-2" /> : <ArchiveIcon className="size-3.5 mr-2" />}
                <span>{isArchived ? t("common.restore") : t("common.archive")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRemoveFromBoard}>
                <LogOutIcon className="size-3.5 mr-2" />
                <span>{t("boards.remove-from-board")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDeleteMemo} className="text-destructive">
                <Trash2Icon className="size-3.5 mr-2" />
                <span>{t("common.delete")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Title & Description */}
      <div className="space-y-0.5">
        <h4
          className={cn(
            "text-sm font-semibold text-foreground line-clamp-2 leading-snug",
            isClosed && "line-through text-muted-foreground/80",
          )}
        >
          {title}
        </h4>
        {description && <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">{description}</p>}
      </div>

      {/* Subtasks Live Checklist */}
      {taskSummary.total > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px]">
            <div className="inline-flex items-center gap-1 font-medium text-muted-foreground">
              <CheckSquareIcon className="size-3 text-primary" />
              <span>Subtasks</span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground font-medium">
              {taskSummary.completed}/{taskSummary.total} ({taskSummary.percent}%)
            </span>
          </div>

          <div className="w-full bg-muted/80 h-1.5 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                taskSummary.percent === 100 ? "bg-emerald-500" : "bg-primary",
              )}
              style={{ width: `${taskSummary.percent}%` }}
            />
          </div>

          <div className="space-y-1 pt-0.5">
            {(showAllSubtasks ? taskSummary.items : taskSummary.items.slice(0, 3)).map((item) => (
              <div
                key={item.index}
                className="flex items-start gap-1.5 text-xs text-foreground/90 group/subtask hover:bg-muted/40 p-0.5 rounded transition-colors cursor-pointer"
                onClick={(e) => void handleToggleSubtask(e, item.index, item.checked)}
                role="checkbox"
                aria-checked={item.checked}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    void handleToggleSubtask(e as unknown as React.MouseEvent, item.index, item.checked);
                  }
                }}
              >
                <button
                  type="button"
                  className="shrink-0 mt-0.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                  title={item.checked ? "Mark uncompleted" : "Mark completed"}
                >
                  {item.checked ? (
                    <CheckCircle2Icon className="size-3.5 text-emerald-500 fill-emerald-500/20" />
                  ) : (
                    <CircleIcon className="size-3.5 text-muted-foreground/60 group-hover/subtask:text-foreground" />
                  )}
                </button>
                <span
                  className={cn(
                    "text-[11px] leading-tight break-all line-clamp-1",
                    item.checked && "line-through text-muted-foreground/70",
                  )}
                >
                  {item.text}
                </span>
              </div>
            ))}

            {taskSummary.total > 3 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAllSubtasks((prev) => !prev);
                }}
                className="text-[10px] text-primary hover:underline font-medium pt-0.5 block cursor-pointer"
              >
                {showAllSubtasks ? "Show less" : `+${taskSummary.total - 3} more subtasks`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Due Date & Progress Bar */}
      {deadline && (
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[11px]">
            <div
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                deadline.isOverdue ? "text-destructive" : "text-muted-foreground",
              )}
            >
              <CalendarIcon className="size-3" />
              <span>{deadline.formattedDue}</span>
            </div>
            <span className={cn("font-mono text-[10px]", deadline.isOverdue ? "text-destructive font-semibold" : "text-muted-foreground")}>
              {deadline.isOverdue ? deadline.remainingText : `${deadline.progress}% (${deadline.remainingText})`}
            </span>
          </div>
          <div className="w-full bg-muted/80 h-1.5 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-300", isClosed ? "bg-emerald-500" : deadline.colorClass)}
              style={{ width: `${deadline.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer metadata counters */}
      <div className="flex items-center justify-between text-xs text-muted-foreground/70 pt-1 border-t border-border/40">
        <div className="flex items-center gap-2.5">
          {taskSummary.total > 0 && (
            <span
              className="inline-flex items-center gap-1 text-[11px]"
              title={`${taskSummary.completed}/${taskSummary.total} subtasks completed`}
            >
              <CheckSquareIcon className="size-3" />
              <span>
                {taskSummary.completed}/{taskSummary.total}
              </span>
            </span>
          )}
          {attachmentsCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px]" title={`${attachmentsCount} attachments`}>
              <PaperclipIcon className="size-3" />
              <span>{attachmentsCount}</span>
            </span>
          )}
          {commentsCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px]" title={`${commentsCount} comments`}>
              <MessageSquareIcon className="size-3" />
              <span>{commentsCount}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {memo.visibility === Visibility.PROTECTED && (
            <span title="Protected">
              <UsersIcon className="size-3" />
            </span>
          )}
          {memo.visibility === Visibility.PUBLIC && (
            <span title="Public">
              <GlobeIcon className="size-3" />
            </span>
          )}
          {memo.visibility === Visibility.PRIVATE && (
            <span title="Private">
              <LockIcon className="size-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default KanbanCard;
