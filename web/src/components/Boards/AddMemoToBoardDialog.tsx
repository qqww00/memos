import { create } from "@bufbuild/protobuf";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { memoServiceClient } from "@/connect";
import { useUpdateMemoKanban } from "@/hooks/useBoardQueries";
import useCurrentUser from "@/hooks/useCurrentUser";
import type { BoardColumn } from "@/types/proto/api/v1/board_service_pb";
import { KanbanSchema, ListMemosRequestSchema, type Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

interface AddMemoToBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  columns: BoardColumn[];
  initialColumnId?: string;
  existingColumnCards?: Map<string, Memo[]>;
}

export const AddMemoToBoardDialog = ({
  open,
  onOpenChange,
  boardId,
  columns,
  initialColumnId,
  existingColumnCards,
}: AddMemoToBoardDialogProps) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [selectedColumnId, setSelectedColumnId] = useState(initialColumnId || columns[0]?.id || "");
  const [searchQuery, setSearchQuery] = useState("");
  const updateMemoKanban = useUpdateMemoKanban();

  // Reset selected column when initialColumnId or columns change
  const currentColumnId = selectedColumnId || initialColumnId || columns[0]?.id || "";

  const { data: memos = [], isLoading } = useQuery({
    queryKey: ["memos-to-add", currentUser?.name, searchQuery],
    queryFn: async () => {
      const filterParts = ["!has_kanban"];
      if (searchQuery.trim()) {
        filterParts.push(`content.contains("${searchQuery.trim()}")`);
      }
      const filter = filterParts.join(" && ");
      const response = await memoServiceClient.listMemos(
        create(ListMemosRequestSchema, {
          filter,
          pageSize: 50,
        } as Record<string, unknown>),
      );
      return response.memos;
    },
    enabled: open && !!currentUser,
  });

  const handleAddMemo = async (memo: Memo) => {
    if (!currentColumnId) return;

    const columnCards = existingColumnCards?.get(currentColumnId) ?? [];
    const lastPosition = columnCards.at(-1)?.kanban?.position ?? 0;
    const newPosition = lastPosition + 1.0;

    try {
      await updateMemoKanban.mutateAsync({
        name: memo.name,
        kanban: create(KanbanSchema, {
          boardId,
          columnId: currentColumnId,
          position: newPosition,
        }),
      });
      toast.success(t("boards.added-to-board"));
      onOpenChange(false);
    } catch {
      toast.error("Failed to add memo to board");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default" className="max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("boards.add-memo-to-board")}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 py-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("boards.search-memos")}
              className="pl-8"
              autoFocus
            />
          </div>

          <div className="w-44 shrink-0">
            <Select value={currentColumnId} onValueChange={setSelectedColumnId}>
              <SelectTrigger>
                <SelectValue placeholder={t("boards.select-column")} />
              </SelectTrigger>
              <SelectContent>
                {columns.map((col) => (
                  <SelectItem key={col.id} value={col.id}>
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: col.colorHex || "#64748b" }} />
                      <span className="truncate">{col.title}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[200px] max-h-[400px]">
          {isLoading && (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg border border-border/60 bg-muted/20" />
              ))}
            </div>
          )}

          {!isLoading && memos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground">
              {t("boards.no-memos-found")}
            </div>
          )}

          {!isLoading &&
            memos.map((memo) => (
              <div
                key={memo.name}
                className="group flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card p-3 transition-colors hover:bg-accent/40"
              >
                <p className="line-clamp-2 text-sm text-foreground flex-1">{memo.content || "(Empty memo)"}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0 text-xs"
                  onClick={() => handleAddMemo(memo)}
                  disabled={updateMemoKanban.isPending}
                >
                  <PlusIcon className="mr-1 size-3.5" />
                  {t("boards.add-memo")}
                </Button>
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddMemoToBoardDialog;
