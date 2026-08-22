import { create } from "@bufbuild/protobuf";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArchiveIcon,
  CalendarIcon,
  CheckCircle2Icon,
  CircleIcon,
  GlobeIcon,
  GripVerticalIcon,
  LockIcon,
  LogOutIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PaperclipIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useUpdateMemoKanban } from "@/hooks/useBoardQueries";
import { useDeleteMemo, useUpdateMemo } from "@/hooks/useMemoQueries";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import { KanbanSchema, type Memo, MemoRelation_Type, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { computeDeadlineProgress, getCardCategories, getCategoryColor, parseCardContent } from "./cardUtils";

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
  const isClosed = Boolean(memo.kanban?.isClosed);
  const categories = getCardCategories(memo.kanban);

  const createSeconds = memo.createTime ? Number(memo.createTime.seconds) : undefined;
  const dueSeconds = memo.kanban?.dueTime ? Number(memo.kanban.dueTime.seconds) : undefined;
  const deadline = computeDeadlineProgress(createSeconds, dueSeconds);

  const commentsCount = memo.relations.filter((r) => r.type === MemoRelation_Type.COMMENT && r.relatedMemo?.name === memo.name).length;
  const attachmentsCount = memo.attachments.length;

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

  const handleArchiveMemo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateMemo({
        update: {
          name: memo.name,
          state: State.ARCHIVED,
        },
        updateMask: ["state"],
      });
      toast.success(t("message.archived-successfully") || "Memo archived");
    } catch {
      toast.error("Failed to archive memo");
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
      {/* Header bar: Category badge + Checkbox + Grip + Menu */}
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
              <DropdownMenuItem onClick={handleArchiveMemo}>
                <ArchiveIcon className="size-3.5 mr-2" />
                <span>{t("common.archive")}</span>
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
