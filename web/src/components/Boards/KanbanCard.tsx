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
}

export const KanbanCard = ({ memo, columnId, parentPage, isOverlay = false }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: memo.name,
    data: {
      type: "card",
      memo,
      columnId,
    },
    disabled: isOverlay,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/card relative rounded-lg border border-border bg-card p-1 shadow-2xs transition-[opacity,box-shadow]",
        isDragging && "opacity-30",
        isOverlay && "rotate-2 scale-102 shadow-xl ring-2 ring-primary/40 cursor-grabbing z-50",
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute right-8 top-3 z-10 flex size-5 items-center justify-center rounded text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground group-hover/card:opacity-100 cursor-grab active:cursor-grabbing"
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
        className="mb-0 border-none bg-transparent p-2 shadow-none"
      />
    </div>
  );
};

export default KanbanCard;
