import { timestampDate } from "@bufbuild/protobuf/wkt";
import { KanbanIcon, MoreVerticalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Link } from "react-router-dom";
import RelativeTime from "@/components/RelativeTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { boardIdFromName } from "@/hooks/useBoardQueries";
import type { Board } from "@/types/proto/api/v1/board_service_pb";
import { useTranslate } from "@/utils/i18n";

interface BoardCardProps {
  board: Board;
  onRename: (board: Board) => void;
  onDelete: (board: Board) => void;
}

export const BoardCard = ({ board, onRename, onDelete }: BoardCardProps) => {
  const t = useTranslate();
  const boardId = boardIdFromName(board.name);
  const updateDate = board.updateTime ? timestampDate(board.updateTime) : undefined;

  return (
    <div className="group/board relative flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 shadow-2xs transition-all hover:border-ring/40 hover:shadow-md">
      <div>
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/boards/${boardId}`}
            className="flex min-w-0 items-center gap-2 font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <KanbanIcon className="size-4" />
            </div>
            <h3 className="truncate text-base font-semibold">{board.title}</h3>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 text-muted-foreground hover:text-foreground opacity-0 group-hover/board:opacity-100 data-popup-open:opacity-100 transition-opacity"
                  aria-label={t("common.more")}
                />
              }
            >
              <MoreVerticalIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" size="sm">
              <DropdownMenuItem onClick={() => onRename(board)}>
                <PencilIcon className="size-3.5" />
                {t("common.rename")}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(board)}>
                <Trash2Icon className="size-3.5" />
                {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {board.columns.map((col) => (
            <Badge
              key={col.id}
              variant="outline"
              className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-normal text-muted-foreground"
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: col.colorHex || "#64748b" }} />
              <span className="truncate max-w-[120px]">{col.title}</span>
            </Badge>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
        <span>{t("boards.columns-count", { count: board.columns.length })}</span>
        {updateDate && (
          <span>
            {t("common.last-updated-at")} <RelativeTime date={updateDate} />
          </span>
        )}
      </div>
    </div>
  );
};

export default BoardCard;
