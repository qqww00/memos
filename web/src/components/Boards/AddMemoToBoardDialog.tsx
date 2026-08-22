import { create } from "@bufbuild/protobuf";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon, CheckIcon, GlobeIcon, LockIcon, PlusIcon, SearchIcon, TagIcon, UsersIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { memoServiceClient } from "@/connect";
import { useBoardCards, useCreateBoardMemo, useUpdateMemoKanban } from "@/hooks/useBoardQueries";
import useCurrentUser from "@/hooks/useCurrentUser";
import type { BoardColumn } from "@/types/proto/api/v1/board_service_pb";
import { KanbanSchema, ListMemosRequestSchema, type Memo, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { CATEGORY_PALETTE, getCardCategories, getCategoryColor } from "./cardUtils";

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
  const [activeTab, setActiveTab] = useState<"create" | "search">("create");
  const [selectedColumnId, setSelectedColumnId] = useState(initialColumnId || columns[0]?.id || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [newContent, setNewContent] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [newCatInput, setNewCatInput] = useState("");
  const [newCatColor, setNewCatColor] = useState(CATEGORY_PALETTE[0].value);
  const [newDueDate, setNewDueDate] = useState("");
  const [newVisibility, setNewVisibility] = useState<Visibility>(Visibility.PRIVATE);

  const { data: boardCards = [] } = useBoardCards(boardId, { enabled: !!boardId && open });
  const availableBoardCategories = useMemo(() => {
    const set = new Set<string>();
    for (const card of boardCards) {
      for (const c of getCardCategories(card.kanban)) {
        set.add(c);
      }
    }
    return Array.from(set);
  }, [boardCards]);

  const updateMemoKanban = useUpdateMemoKanban();
  const createBoardMemo = useCreateBoardMemo(boardId);

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
    enabled: open && activeTab === "search" && !!currentUser,
  });

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  const handleAddNewCategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCatInput.trim();
    if (!trimmed) return;
    if (!selectedCategories.includes(trimmed)) {
      setSelectedCategories((prev) => [...prev, trimmed]);
    }
    setNewCatInput("");
  };

  const handleCreateMemo = async () => {
    const trimmed = newContent.trim();
    if (!trimmed || !currentColumnId) return;

    const columnCards = existingColumnCards?.get(currentColumnId) ?? [];
    const lastPosition = columnCards.at(-1)?.kanban?.position ?? 0;
    const newPosition = lastPosition + 1.0;

    let dueTimestamp: { seconds: bigint; nanos: number } | undefined;
    if (newDueDate) {
      const ms = new Date(newDueDate).getTime();
      if (!Number.isNaN(ms)) {
        dueTimestamp = { seconds: BigInt(Math.floor(ms / 1000)), nanos: 0 };
      }
    }

    try {
      await createBoardMemo.mutateAsync({
        content: trimmed,
        visibility: newVisibility,
        columnId: currentColumnId,
        position: newPosition,
        categories: selectedCategories,
        category: selectedCategories[0] || undefined,
        categoryColorHex: selectedCategories[0] ? newCatColor : undefined,
        dueTime: dueTimestamp,
      });
      setNewContent("");
      setSelectedCategories([]);
      setNewDueDate("");
      toast.success("Memo created");
      onOpenChange(false);
    } catch {
      toast.error("Failed to create memo");
    }
  };

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

  const getVisibilityIcon = (v: Visibility) => {
    switch (v) {
      case Visibility.PROTECTED:
        return <UsersIcon className="size-3.5" />;
      case Visibility.PUBLIC:
        return <GlobeIcon className="size-3.5" />;
      default:
        return <LockIcon className="size-3.5" />;
    }
  };

  const getVisibilityLabel = (v: Visibility) => {
    switch (v) {
      case Visibility.PROTECTED:
        return t("memo.visibility.protected");
      case Visibility.PUBLIC:
        return t("memo.visibility.public");
      default:
        return t("memo.visibility.private");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default" className="max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("boards.add-memo-to-board")}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "create" | "search")} className="w-full">
          <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
            <TabsList className="grid grid-cols-2 w-56">
              <TabsTrigger value="create" className="text-xs">
                {t("common.create")}
              </TabsTrigger>
              <TabsTrigger value="search" className="text-xs">
                {t("boards.add-existing-memo")}
              </TabsTrigger>
            </TabsList>

            <div className="w-48 shrink-0">
              <Select value={currentColumnId} onValueChange={setSelectedColumnId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={t("boards.select-column")} />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col.id} value={col.id} className="text-xs">
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

          {activeTab === "create" && (
            <div className="mt-3 space-y-3">
              <Textarea
                autoFocus
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Write a memo or task..."
                rows={4}
                className="resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handleCreateMemo();
                  }
                }}
              />

              {/* Selected Categories Tags */}
              {selectedCategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  {selectedCategories.map((cat) => {
                    const color = getCategoryColor(cat);
                    return (
                      <span
                        key={cat}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: `${color}25`,
                          color,
                          border: `1px solid ${color}40`,
                        }}
                      >
                        <span>{cat}</span>
                        <button type="button" onClick={() => toggleCategory(cat)} className="hover:opacity-75 cursor-pointer ml-0.5">
                          <XIcon className="size-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Category & Due date options */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40 text-xs">
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <TagIcon className="size-3.5" />
                        <span>{selectedCategories.length > 0 ? `${selectedCategories.length} categories` : "Categories"}</span>
                      </Button>
                    }
                  />
                  <PopoverContent align="start" className="w-64 p-3 space-y-2.5">
                    <div className="text-xs font-semibold text-foreground">Categories</div>

                    {/* Reusable categories list */}
                    {availableBoardCategories.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[11px] text-muted-foreground">Board categories:</div>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                          {availableBoardCategories.map((cat) => {
                            const isSelected = selectedCategories.includes(cat);
                            const color = getCategoryColor(cat);
                            return (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => toggleCategory(cat)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors cursor-pointer"
                                style={{
                                  backgroundColor: isSelected ? color : `${color}15`,
                                  color: isSelected ? "#ffffff" : color,
                                  border: `1px solid ${color}40`,
                                }}
                              >
                                {isSelected && <CheckIcon className="size-3" />}
                                <span>{cat}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleAddNewCategory} className="space-y-2 pt-1 border-t border-border/40">
                      <div className="text-[11px] text-muted-foreground">Add new:</div>
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={newCatInput}
                          onChange={(e) => setNewCatInput(e.target.value)}
                          placeholder="Category name..."
                          className="h-7 text-xs flex-1"
                        />
                        <Button type="submit" size="sm" variant="secondary" className="h-7 px-2 text-xs" disabled={!newCatInput.trim()}>
                          <PlusIcon className="size-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {CATEGORY_PALETTE.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => setNewCatColor(c.value)}
                            className="size-4 rounded-full border transition-transform hover:scale-110"
                            style={{
                              backgroundColor: c.value,
                              borderColor: newCatColor === c.value ? "var(--color-primary)" : "transparent",
                            }}
                            title={c.label}
                          />
                        ))}
                      </div>
                    </form>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <CalendarIcon className="size-3.5" />
                        <span>{newDueDate ? new Date(newDueDate).toLocaleDateString() : "Due Date"}</span>
                      </Button>
                    }
                  />
                  <PopoverContent align="start" className="w-64 p-3 space-y-2">
                    <label htmlFor="modal-due-date-input" className="text-xs font-medium text-foreground block">
                      Due Date & Time
                    </label>
                    <Input
                      id="modal-due-date-input"
                      type="datetime-local"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="h-8 text-xs"
                    />
                    {newDueDate && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-muted-foreground w-full"
                        onClick={() => setNewDueDate("")}
                      >
                        Clear due date
                      </Button>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs text-muted-foreground gap-1.5">
                        {getVisibilityIcon(newVisibility)}
                        <span>{getVisibilityLabel(newVisibility)}</span>
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="start" size="sm">
                    <DropdownMenuItem onClick={() => setNewVisibility(Visibility.PRIVATE)} className="gap-2">
                      <LockIcon className="size-3.5" />
                      <span>{t("memo.visibility.private")}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewVisibility(Visibility.PROTECTED)} className="gap-2">
                      <UsersIcon className="size-3.5" />
                      <span>{t("memo.visibility.protected")}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewVisibility(Visibility.PUBLIC)} className="gap-2">
                      <GlobeIcon className="size-3.5" />
                      <span>{t("memo.visibility.public")}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button size="sm" disabled={!newContent.trim() || createBoardMemo.isPending} onClick={() => void handleCreateMemo()}>
                    <PlusIcon className="mr-1 size-3.5" />
                    {t("common.create")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "search" && (
            <div className="mt-3 space-y-2">
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("boards.search-memos")}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px] max-h-[320px]">
                {isLoading && (
                  <div className="space-y-2 py-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 animate-pulse rounded-lg border border-border/60 bg-muted/20" />
                    ))}
                  </div>
                )}

                {!isLoading && memos.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
                    {t("boards.no-memos-found")}
                  </div>
                )}

                {!isLoading &&
                  memos.map((memo) => (
                    <div
                      key={memo.name}
                      className="group flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card p-2.5 transition-colors hover:bg-accent/40"
                    >
                      <p className="line-clamp-2 text-xs text-foreground flex-1">{memo.content || "(Empty memo)"}</p>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 shrink-0 text-xs"
                        onClick={() => handleAddMemo(memo)}
                        disabled={updateMemoKanban.isPending}
                      >
                        <PlusIcon className="mr-1 size-3" />
                        {t("boards.add-memo")}
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AddMemoToBoardDialog;
