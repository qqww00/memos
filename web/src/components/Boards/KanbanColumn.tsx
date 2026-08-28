import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PlusIcon } from "lucide-react";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BoardColumn } from "@/types/proto/api/v1/board_service_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import ColumnHeader from "./ColumnHeader";
import InlineCardCreator from "./InlineCardCreator";
import KanbanCard from "./KanbanCard";

interface KanbanColumnProps {
  boardId?: string;
  column: BoardColumn;
  cards: Memo[];
  dropIndicatorIndex?: number | null;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  canDelete: boolean;
  isOverlay?: boolean;
  onRename: (title: string) => void;
  onRecolor: (colorHex: string) => void;
  onSetWipLimit?: (wipLimit: number) => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDelete: () => void;
  onAddMemo: () => void;
  onSelectCard?: (memo: Memo) => void;
  parentPage?: string;
}

export const KanbanColumn = ({
  boardId,
  column,
  cards,
  dropIndicatorIndex,
  canMoveLeft,
  canMoveRight,
  canDelete,
  isOverlay = false,
  onRename,
  onRecolor,
  onSetWipLimit,
  onMoveLeft,
  onMoveRight,
  onDelete,
  onAddMemo,
  onSelectCard,
  parentPage,
}: KanbanColumnProps) => {
  const t = useTranslate();
  const [isCreating, setIsCreating] = useState(false);

  const isWipExceeded = Boolean(column.wipLimit && column.wipLimit > 0 && cards.length > column.wipLimit);

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
  const lastPosition = cards.at(-1)?.kanban?.position ?? 0;
  const nextPosition = lastPosition + 1.0;

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex h-full w-80 shrink-0 flex-col rounded-xl border bg-muted/40 p-2.5 transition-colors",
        isWipExceeded ? "border-destructive/40 bg-destructive/5" : "border-border/70",
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
        onSetWipLimit={onSetWipLimit}
        onMoveLeft={onMoveLeft}
        onMoveRight={onMoveRight}
        onDelete={onDelete}
        onAddMemo={onAddMemo}
        onCreateMemo={() => setIsCreating(true)}
      />

      <div className="mt-2 flex min-h-[100px] flex-1 flex-col gap-2 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {dropIndicatorIndex === 0 && (
            <div className="h-16 w-full shrink-0 rounded-xl border-2 border-dashed border-primary/60 bg-primary/10 transition-all duration-200" />
          )}
          {cards.map((memo, idx) => (
            <Fragment key={memo.name}>
              <KanbanCard memo={memo} columnId={column.id} parentPage={parentPage} onSelect={onSelectCard} />
              {dropIndicatorIndex === idx + 1 && (
                <div className="h-16 w-full shrink-0 rounded-xl border-2 border-dashed border-primary/60 bg-primary/10 transition-all duration-200" />
              )}
            </Fragment>
          ))}
        </SortableContext>

        {isCreating && (
          <InlineCardCreator
            boardId={boardId || ""}
            columnId={column.id}
            nextPosition={nextPosition}
            onClose={() => setIsCreating(false)}
          />
        )}

        {cards.length === 0 && !isCreating && (
          <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border/60 p-4 text-center">
            <p className="text-xs text-muted-foreground">{t("boards.no-cards-in-column")}</p>
            <div className="mt-2 flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setIsCreating(true)}
              >
                <PlusIcon className="mr-1 size-3" />
                {t("common.create")}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={onAddMemo}>
                {t("boards.add-memo")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {cards.length > 0 && !isCreating && (
        <div className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setIsCreating(true)}
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
