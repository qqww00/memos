import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import MemoView from "@/components/MemoView";
import { cn } from "@/lib/utils";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

interface KanbanCardProps {
  memo: Memo;
  columnId: string;
  parentPage?: string;
  isOverlay?: boolean;
  onSelect?: (memo: Memo) => void;
}

export const KanbanCard = ({ memo, columnId, parentPage, isOverlay = false, onSelect }: KanbanCardProps) => {
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
        "group/card relative rounded-lg border border-border bg-card p-1 shadow-2xs cursor-grab active:cursor-grabbing select-none touch-none hover:border-primary/50 transition-colors",
        isDragging && "opacity-25",
        isOverlay && "shadow-xl ring-2 ring-primary/50 cursor-grabbing z-50 bg-card opacity-95",
      )}
    >
      <div
        className="absolute right-8 top-3 z-10 flex size-5 items-center justify-center rounded text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground group-hover/card:opacity-100 pointer-events-none"
        title="Drag card"
      >
        <GripVerticalIcon className="size-3.5" />
      </div>

      <MemoView
        memo={memo}
        compact
        parentPage={parentPage}
        showVisibility
        showPinned
        onGotoDetail={() => onSelect?.(memo)}
        className="mb-0 border-none bg-transparent p-2 shadow-none pointer-events-auto"
      />
    </div>
  );
};

export default KanbanCard;
