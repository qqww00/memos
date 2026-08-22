import { AlertTriangleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Board } from "@/types/proto/api/v1/board_service_pb";
import { useTranslate } from "@/utils/i18n";

interface DeleteBoardDialogProps {
  board: Board | undefined;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  isPending?: boolean;
}

/**
 * GitHub-style delete confirmation dialog.
 * The Delete button stays disabled until the user types the board's exact title.
 */
const DeleteBoardDialog = ({ board, onOpenChange, onConfirm, isPending }: DeleteBoardDialogProps) => {
  const t = useTranslate();
  const [confirmInput, setConfirmInput] = useState("");
  const [loading, setLoading] = useState(false);

  const open = !!board;
  const boardTitle = board?.title ?? "";
  const isMatch = confirmInput === boardTitle;

  // Reset input whenever dialog opens for a new board.
  useEffect(() => {
    if (open) setConfirmInput("");
  }, [open, boardTitle]);

  const handleConfirm = async () => {
    if (!isMatch) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && isMatch) {
      e.preventDefault();
      void handleConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && !isPending && onOpenChange(o)}>
      <DialogContent size="sm" className="gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangleIcon className="size-4 shrink-0" />
            {t("boards.delete-board")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning description */}
          <p className="text-sm text-muted-foreground">{t("boards.delete-confirm-description")}</p>

          {/* GitHub-style name confirmation */}
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-3">
            <p className="text-sm text-foreground">
              {t("boards.delete-confirm-prompt") || "Please type"}{" "}
              <strong className="font-semibold text-foreground select-all">{boardTitle}</strong>{" "}
              {t("boards.delete-confirm-to-confirm") || "to confirm."}
            </p>
            <Input
              autoFocus
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("boards.delete-confirm-input-placeholder") || "Enter board title"}
              className="h-8 text-sm font-mono border-destructive/40 focus-visible:ring-destructive/40"
              aria-label={`Type ${boardTitle} to confirm deletion`}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={loading || isPending} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" disabled={!isMatch || loading || isPending} onClick={() => void handleConfirm()}>
            {loading || isPending ? "Deleting..." : t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteBoardDialog;
