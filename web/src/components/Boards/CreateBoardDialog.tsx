import { create } from "@bufbuild/protobuf";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BoardColumn, BoardColumnSchema } from "@/types/proto/api/v1/board_service_pb";
import { useTranslate } from "@/utils/i18n";
import { BOARD_COLUMN_COLORS, DEFAULT_BOARD_COLUMNS } from "./constants";

interface CreateBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; columns: BoardColumn[] }) => Promise<void>;
}

export const CreateBoardDialog = ({ open, onOpenChange, onSubmit }: CreateBoardDialogProps) => {
  const t = useTranslate();
  const [title, setTitle] = useState("");
  const [columns, setColumns] = useState<Array<{ id: string; title: string; colorHex: string; wipLimit?: number }>>(() =>
    DEFAULT_BOARD_COLUMNS.map((col, idx) => ({ id: `col-${idx}`, title: col.title, colorHex: col.colorHex })),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddColumn = () => {
    const nextIndex = columns.length;
    const color = BOARD_COLUMN_COLORS[nextIndex % BOARD_COLUMN_COLORS.length]?.value ?? "#64748b";
    setColumns([...columns, { id: `col-${Date.now()}`, title: `Column ${nextIndex + 1}`, colorHex: color }]);
  };

  const handleRemoveColumn = (index: number) => {
    if (columns.length <= 1) return;
    setColumns(columns.filter((_, i) => i !== index));
  };

  const handleUpdateColumnTitle = (index: number, newTitle: string) => {
    setColumns(columns.map((col, i) => (i === index ? { ...col, title: newTitle } : col)));
  };

  const handleUpdateColumnWip = (index: number, wipLimitStr: string) => {
    const parsed = Number.parseInt(wipLimitStr.trim(), 10);
    const wipLimit = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
    setColumns(columns.map((col, i) => (i === index ? { ...col, wipLimit } : col)));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || isSubmitting) return;

    const boardColumns = columns
      .filter((c) => c.title.trim())
      .map((c) => create(BoardColumnSchema, { title: c.title.trim(), colorHex: c.colorHex, wipLimit: c.wipLimit ?? 0 }));

    if (boardColumns.length === 0) return;

    try {
      setIsSubmitting(true);
      await onSubmit({ title: trimmedTitle, columns: boardColumns });
      setTitle("");
      setColumns(DEFAULT_BOARD_COLUMNS.map((col, idx) => ({ id: `col-${idx}`, title: col.title, colorHex: col.colorHex })));
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>{t("boards.create-board")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="board-title">{t("boards.board-title")}</Label>
            <Input
              id="board-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("boards.board-title-placeholder")}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("boards.columns")}</Label>
              <Button type="button" variant="ghost" size="sm" onClick={handleAddColumn} className="h-7 text-xs">
                <PlusIcon className="mr-1 size-3" />
                {t("boards.add-column")}
              </Button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {columns.map((col, idx) => (
                <div key={col.id} className="flex items-center gap-2">
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: col.colorHex }} />
                  <Input
                    value={col.title}
                    onChange={(e) => handleUpdateColumnTitle(idx, e.target.value)}
                    placeholder={t("boards.column-title")}
                    className="h-8 text-sm flex-1"
                  />
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={col.wipLimit ? String(col.wipLimit) : ""}
                    onChange={(e) => handleUpdateColumnWip(idx, e.target.value)}
                    placeholder="WIP"
                    title="Work-in-progress limit (0 = unlimited)"
                    className="h-8 w-16 text-xs text-center"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-8 text-muted-foreground hover:text-destructive shrink-0"
                    disabled={columns.length <= 1}
                    onClick={() => handleRemoveColumn(idx)}
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!title.trim() || isSubmitting}>
              {t("boards.create-board")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateBoardDialog;
