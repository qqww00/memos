import { KanbanIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Board } from "@/types/proto/api/v1/board_service_pb";
import { useTranslate } from "@/utils/i18n";
import BoardCard from "./BoardCard";

interface BoardListProps {
  boards: Board[];
  isLoading: boolean;
  onCreate: () => void;
  onRename: (board: Board) => void;
  onDelete: (board: Board) => void;
}

export const BoardList = ({ boards, isLoading, onCreate, onRename, onDelete }: BoardListProps) => {
  const t = useTranslate();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl border border-border/70 bg-muted/30 p-4" />
        ))}
      </div>
    );
  }

  if (boards.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/10 p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <KanbanIcon className="size-6" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-foreground">{t("boards.empty-state-title")}</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("boards.empty-state-description")}</p>
        <Button onClick={onCreate} className="mt-5">
          <PlusIcon className="mr-1.5 size-4" />
          {t("boards.create-board")}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {boards.map((board) => (
        <BoardCard key={board.name} board={board} onRename={onRename} onDelete={onDelete} />
      ))}
    </div>
  );
};

export default BoardList;
