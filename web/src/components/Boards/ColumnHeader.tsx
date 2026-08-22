import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  GripVerticalIcon,
  MoreHorizontalIcon,
  PaletteIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { BoardColumn } from "@/types/proto/api/v1/board_service_pb";
import { useTranslate } from "@/utils/i18n";
import { BOARD_COLUMN_COLORS } from "./constants";

interface ColumnHeaderProps {
  column: BoardColumn;
  cardCount: number;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  canDelete: boolean;
  dragHandleProps?: Record<string, unknown>;
  onRename: (title: string) => void;
  onRecolor: (colorHex: string) => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDelete: () => void;
  onAddMemo: () => void;
  onCreateMemo?: () => void;
}

export const ColumnHeader = ({
  column,
  cardCount,
  canMoveLeft,
  canMoveRight,
  canDelete,
  dragHandleProps,
  onRename,
  onRecolor,
  onMoveLeft,
  onMoveRight,
  onDelete,
  onAddMemo,
  onCreateMemo,
}: ColumnHeaderProps) => {
  const t = useTranslate();
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState(column.title);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const handleOpenRename = () => {
    setRenameTitle(column.title);
    setRenameDialogOpen(true);
  };

  const handleSaveRename = () => {
    const trimmed = renameTitle.trim();
    if (trimmed && trimmed !== column.title) {
      onRename(trimmed);
    }
    setRenameDialogOpen(false);
  };

  return (
    <div className="flex items-center justify-between gap-2 px-1 py-1">
      <div
        {...dragHandleProps}
        className="flex min-w-0 flex-1 items-center gap-1.5 cursor-grab active:cursor-grabbing select-none touch-none rounded-md px-1 py-0.5 -mx-1 hover:bg-background/50 transition-colors"
      >
        <GripVerticalIcon className="size-3.5 shrink-0 text-muted-foreground/40 hover:text-foreground" />
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: column.colorHex || "#64748b" }} />
        <h3 className="truncate text-sm font-semibold text-foreground" title={column.title}>
          {column.title}
        </h3>
        <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-medium text-muted-foreground">
          {cardCount}
        </Badge>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-6 text-muted-foreground hover:text-foreground"
          onClick={onCreateMemo || onAddMemo}
          aria-label={t("boards.add-memo")}
        >
          <PlusIcon className="size-3.5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6 text-muted-foreground hover:text-foreground"
                aria-label={t("common.more")}
              >
                <MoreHorizontalIcon className="size-3.5" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" size="sm">
            <DropdownMenuItem onClick={handleOpenRename}>
              <PencilIcon className="size-3.5" />
              {t("boards.rename-column")}
            </DropdownMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <PaletteIcon className="size-3.5" />
                {t("boards.column-color")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {BOARD_COLUMN_COLORS.map((color) => (
                  <DropdownMenuItem
                    key={color.value}
                    onClick={() => onRecolor(color.value)}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="size-3 rounded-full" style={{ backgroundColor: color.value }} />
                      <span>{color.label}</span>
                    </div>
                    {column.colorHex === color.value && <CheckIcon className="size-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />

            <DropdownMenuItem disabled={!canMoveLeft} onClick={onMoveLeft}>
              <ArrowLeftIcon className="size-3.5" />
              {t("boards.move-left")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canMoveRight} onClick={onMoveRight}>
              <ArrowRightIcon className="size-3.5" />
              {t("boards.move-right")}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem variant="destructive" disabled={!canDelete} onClick={() => setDeleteConfirmOpen(true)}>
              <Trash2Icon className="size-3.5" />
              {t("boards.delete-column")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("boards.rename-column")}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              autoFocus
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSaveRename();
                }
              }}
              placeholder={t("boards.column-title")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSaveRename} disabled={!renameTitle.trim()}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={t("boards.delete-column-confirm", { title: column.title })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={onDelete}
        confirmVariant="destructive"
      />
    </div>
  );
};

export default ColumnHeader;
