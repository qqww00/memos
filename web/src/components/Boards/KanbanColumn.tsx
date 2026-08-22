import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BoardColumn } from "@/types/proto/api/v1/board_service_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import ColumnHeader from "./ColumnHeader";
import KanbanCard from "./KanbanCard";

interface KanbanColumnProps {
  column: BoardColumn;
  cards: Memo[];
  canMoveLeft: boolean;
  canMoveRight: boolean;
  canDelete: boolean;
  isOverlay?: boolean;
  onRename: (title: string) => void;
  onRecolor: (colorHex: string) => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDelete: () => void;
  onAddMemo: () => void;
  parentPage?: string;
}

export const KanbanColumn = ({
  column,
  cards,
  canMoveLeft,
  canMoveRight,
  canDelete,
  isOverlay = false,
  onRename,
  onRecolor,
  onMoveLeft,
  onMoveRight,
  onDelete,
  onAddMemo,
  parentPage,
}: KanbanColumnProps) => {
  const t = useTranslate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: column.id,
    data: {
      type: "column",
      column,
      columnId: column.id,
    },
    disabled: isOverlay,
    animateLayoutChanges: () => false,
  });

  const cardIds = cards.map((c) => c.name);
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex h-full w-80 shrink-0 flex-col rounded-xl border border-border/70 bg-muted/40 p-2.5",
        isDragging && "opacity-30 border-primary/50",
        isOverlay && "shadow-2xl ring-2 ring-primary/50 bg-muted z-50 opacity-95",
      )}
    >
      <ColumnHeader
        column={column}
        cardCount={cards.length}
        canMoveLeft={canMoveLeft}
        canMoveRight={canMoveRight}
        canDelete={canDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
        onRename={onRename}
        onRecolor={onRecolor}
        onMoveLeft={onMoveLeft}
        onMoveRight={onMoveRight}
        onDelete={onDelete}
        onAddMemo={onAddMemo}
      />

      <div className="mt-2 flex min-h-[100px] flex-1 flex-col gap-2 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((memo) => (
            <KanbanCard key={memo.name} memo={memo} columnId={column.id} parentPage={parentPage} />
          ))}
        </SortableContext>

        {cards.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border/60 p-4 text-center">
            <p className="text-xs text-muted-foreground">{t("boards.no-cards-in-column")}</p>
            <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs text-muted-foreground hover:text-foreground" onClick={onAddMemo}>
              <PlusIcon className="mr-1 size-3" />
              {t("boards.add-memo")}
            </Button>
          </div>
        )}
      </div>

      {cards.length > 0 && (
        <div className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs text-muted-foreground hover:text-foreground"
            onClick={onAddMemo}
          >
            <PlusIcon className="mr-1.5 size-3.5" />
            {t("boards.add-memo")}
          </Button>
        </div>
      )}
    </div>
  );
};

export default KanbanColumn;
