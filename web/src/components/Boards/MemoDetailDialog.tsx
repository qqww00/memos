import { create } from "@bufbuild/protobuf";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowUpLeftFromCircleIcon,
  CalendarIcon,
  CheckCircle2Icon,
  CheckIcon,
  CircleIcon,
  ExternalLinkIcon,
  PlusIcon,
  RotateCcwIcon,
  SaveIcon,
  TagIcon,
  TargetIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import MemoCommentSection from "@/components/MemoCommentSection";
import { MentionResolutionProvider } from "@/components/MemoContent/MentionResolutionContext";
import MemoView from "@/components/MemoView";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useBoardCards, useUpdateMemoKanban } from "@/hooks/useBoardQueries";
import { useInfiniteMemoComments, useMemo as useMemoQuery, useUpdateMemo } from "@/hooks/useMemoQueries";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import { KanbanSchema } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import {
  CATEGORY_PALETTE,
  computeDeadlineProgress,
  getCardCategories,
  getCardMilestone,
  getCategoryColor,
  getMilestoneColor,
} from "./cardUtils";

interface MemoDetailDialogProps {
  memoName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentPage?: string;
}

export const MemoDetailDialog = ({ memoName, open, onOpenChange, parentPage }: MemoDetailDialogProps) => {
  const t = useTranslate();
  const [shareImageDialogOpen, setShareImageDialogOpen] = useState(false);
  const updateMemoKanban = useUpdateMemoKanban();
  const { mutateAsync: updateMemo } = useUpdateMemo();
  const [isArchiving, setIsArchiving] = useState(false);

  const { data: memo } = useMemoQuery(memoName || "", {
    enabled: open && !!memoName,
  });

  const { data: parentMemo } = useMemoQuery(memo?.parent || "", {
    enabled: open && !!memo?.parent,
  });

  const {
    data: comments = [],
    fetchNextPage: fetchNextComments,
    hasNextPage: hasNextComments,
    isFetchingNextPage: isFetchingNextComments,
  } = useInfiniteMemoComments(memoName || "", {
    enabled: open && !!memoName,
  });

  const boardId = memo?.kanban?.boardId || "";
  const { data: boardCards = [] } = useBoardCards(boardId, {
    enabled: !!boardId && open,
  });

  // Local draft states for live editing
  const [isClosedDraft, setIsClosedDraft] = useState(false);
  const [categoriesDraft, setCategoriesDraft] = useState<string[]>([]);
  const [milestoneDraft, setMilestoneDraft] = useState("");
  const [newMilestoneInput, setNewMilestoneInput] = useState("");
  const [newCatInput, setNewCatInput] = useState("");
  const [newCatColor, setNewCatColor] = useState(CATEGORY_PALETTE[0].value);
  const [categoryColorMap, setCategoryColorMap] = useState<Record<string, string>>({});
  const [dueDateDraft, setDueDateDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Extract all categories already used across this board
  const availableBoardCategories = useMemo(() => {
    const map = new Map<string, string>();
    for (const card of boardCards) {
      if (card.kanban) {
        for (const c of getCardCategories(card.kanban)) {
          if (!map.has(c)) {
            const cardColor =
              card.kanban.category === c && card.kanban.categoryColorHex ? card.kanban.categoryColorHex : getCategoryColor(c);
            map.set(c, cardColor);
          }
        }
      }
    }
    return Array.from(map.entries()).map(([name, color]) => ({ name, color }));
  }, [boardCards]);

  // Extract all milestones across this board
  const availableBoardMilestones = useMemo(() => {
    const set = new Set<string>();
    for (const card of boardCards) {
      if (card.kanban?.milestone?.trim()) {
        set.add(card.kanban.milestone.trim());
      }
    }
    return Array.from(set).sort();
  }, [boardCards]);

  // Sync draft states when memo changes
  useEffect(() => {
    if (!memo) return;
    setIsClosedDraft(Boolean(memo.kanban?.isClosed));
    const cats = getCardCategories(memo.kanban);
    setCategoriesDraft(cats);
    setMilestoneDraft(getCardMilestone(memo.kanban) || "");

    const initialColors: Record<string, string> = {};
    for (const item of availableBoardCategories) {
      initialColors[item.name] = item.color;
    }
    if (memo.kanban?.category && memo.kanban.categoryColorHex) {
      initialColors[memo.kanban.category] = memo.kanban.categoryColorHex;
      setNewCatColor(memo.kanban.categoryColorHex);
    } else if (cats[0]) {
      const col = initialColors[cats[0]] || getCategoryColor(cats[0]);
      setNewCatColor(col);
    }
    setCategoryColorMap(initialColors);

    const dueSec = memo.kanban?.dueTime ? Number(memo.kanban.dueTime.seconds) : undefined;
    if (dueSec) {
      const date = new Date(dueSec * 1000);
      // Format to local YYYY-MM-DDTHH:mm
      const pad = (n: number) => n.toString().padStart(2, "0");
      const localIso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
      setDueDateDraft(localIso);
    } else {
      setDueDateDraft("");
    }
  }, [memo, availableBoardCategories]);

  const resolveCategoryColor = (cat: string) => {
    return (
      categoryColorMap[cat] ||
      (memo?.kanban?.category === cat && memo?.kanban?.categoryColorHex ? memo.kanban.categoryColorHex : getCategoryColor(cat))
    );
  };

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    if (!memo?.kanban) return false;
    const origClosed = Boolean(memo.kanban.isClosed);
    if (isClosedDraft !== origClosed) return true;

    const origMilestone = getCardMilestone(memo.kanban) || "";
    if (milestoneDraft !== origMilestone) return true;

    const origCategories = getCardCategories(memo.kanban);
    if (origCategories.length !== categoriesDraft.length) return true;
    for (const c of categoriesDraft) {
      if (!origCategories.includes(c)) return true;
    }

    const origColor = memo.kanban.categoryColorHex || "";
    const primaryCat = categoriesDraft[0];
    const currentColor = primaryCat ? categoryColorMap[primaryCat] || newCatColor : "";
    if (origColor !== currentColor) return true;

    const origDueSec = memo.kanban.dueTime ? Number(memo.kanban.dueTime.seconds) : 0;
    const draftDueSec = dueDateDraft ? Math.floor(new Date(dueDateDraft).getTime() / 1000) : 0;
    if (origDueSec !== draftDueSec) return true;

    return false;
  }, [memo?.kanban, isClosedDraft, milestoneDraft, categoriesDraft, categoryColorMap, newCatColor, dueDateDraft]);

  if (!memo) return null;

  const handleToggleCategory = (cat: string, defaultColor?: string) => {
    setCategoriesDraft((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
    if (defaultColor) {
      setCategoryColorMap((prev) => ({ ...prev, [cat]: prev[cat] || defaultColor }));
    }
  };

  const handleSelectPaletteColor = (color: string) => {
    setNewCatColor(color);
    if (categoriesDraft.length > 0) {
      const targetCat = categoriesDraft[0];
      setCategoryColorMap((prev) => ({ ...prev, [targetCat]: color }));
    }
  };

  const handleAddNewCategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCatInput.trim();
    if (!trimmed) return;
    if (!categoriesDraft.includes(trimmed)) {
      setCategoriesDraft((prev) => [...prev, trimmed]);
    }
    setCategoryColorMap((prev) => ({ ...prev, [trimmed]: newCatColor }));
    setNewCatInput("");
  };

  const handleResetDraft = () => {
    if (!memo) return;
    setIsClosedDraft(Boolean(memo.kanban?.isClosed));
    const cats = getCardCategories(memo.kanban);
    setCategoriesDraft(cats);
    setMilestoneDraft(getCardMilestone(memo.kanban) || "");
    const initialColors: Record<string, string> = {};
    for (const item of availableBoardCategories) {
      initialColors[item.name] = item.color;
    }
    if (memo.kanban?.category && memo.kanban.categoryColorHex) {
      initialColors[memo.kanban.category] = memo.kanban.categoryColorHex;
      setNewCatColor(memo.kanban.categoryColorHex);
    }
    setCategoryColorMap(initialColors);

    const dueSec = memo.kanban?.dueTime ? Number(memo.kanban.dueTime.seconds) : undefined;
    if (dueSec) {
      const date = new Date(dueSec * 1000);
      const pad = (n: number) => n.toString().padStart(2, "0");
      setDueDateDraft(
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`,
      );
    } else {
      setDueDateDraft("");
    }
  };

  const handleSaveChanges = async () => {
    if (!memo.kanban) return;
    setIsSaving(true);

    let dueTimestamp: { seconds: bigint; nanos: number } | undefined;
    if (dueDateDraft) {
      const ms = new Date(dueDateDraft).getTime();
      if (!Number.isNaN(ms)) {
        dueTimestamp = { seconds: BigInt(Math.floor(ms / 1000)), nanos: 0 };
      }
    }

    const primaryCategory = categoriesDraft[0];
    const primaryColor = primaryCategory ? categoryColorMap[primaryCategory] || newCatColor : undefined;

    try {
      await updateMemoKanban.mutateAsync({
        name: memo.name,
        kanban: create(KanbanSchema, {
          boardId: memo.kanban.boardId,
          columnId: memo.kanban.columnId,
          position: memo.kanban.position,
          categories: categoriesDraft,
          category: primaryCategory || undefined,
          categoryColorHex: primaryColor,
          milestone: milestoneDraft || undefined,
          dueTime: dueTimestamp,
          isClosed: isClosedDraft,
        }),
      });
      toast.success("Board changes saved");
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const isArchived = memo.state === State.ARCHIVED;

  const handleToggleArchiveMemo = async () => {
    if (!memo) return;
    setIsArchiving(true);
    const newState = isArchived ? State.NORMAL : State.ARCHIVED;
    const successMsg = isArchived
      ? t("message.restored-successfully") || "Memo restored"
      : t("message.archived-successfully") || "Memo archived";
    try {
      await updateMemo({
        update: {
          name: memo.name,
          state: newState,
        },
        updateMask: ["state"],
      });
      toast.success(successMsg);
      onOpenChange(false);
    } catch {
      toast.error(isArchived ? "Failed to restore memo" : "Failed to archive memo");
    } finally {
      setIsArchiving(false);
    }
  };

  const draftDueSec = dueDateDraft ? Math.floor(new Date(dueDateDraft).getTime() / 1000) : undefined;
  const createSec = memo.createTime ? Number(memo.createTime.seconds) : undefined;
  const deadline = computeDeadlineProgress(createSec, draftDueSec);

  const mentionResolutionContents = [memo.content, ...comments.map((comment) => comment.content)];
  const userResolutionNames = Array.from(
    new Set([memo, ...comments].flatMap((item) => [item.creator, ...(item.reactions ?? []).map((reaction) => reaction.creator)])),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="full"
        className="w-[96vw] sm:w-[94vw] md:w-[92vw] lg:w-[90vw] !max-w-6xl xl:!max-w-7xl h-[88vh] max-h-[92vh] p-0 gap-0 overflow-hidden [&>div:first-child]:h-full [&>div:first-child]:p-0 [&>div:first-child]:gap-0 [&>div:first-child]:overflow-hidden"
      >
        <div className="flex flex-row w-full h-full min-h-0 overflow-hidden">
          {/* Left Side: Memo Content, View & Comments */}
          <div className="flex-1 flex flex-col min-w-0 h-full border-r border-border">
            <DialogHeader className="px-6 py-3.5 border-b border-border/70 flex flex-row items-center justify-between shrink-0">
              <DialogTitle className="text-sm font-medium text-muted-foreground">{t("common.memo")}</DialogTitle>
              <div className="flex items-center gap-2 pr-6">
                <Link
                  to={`/${memo.name}`}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>Open in page</span>
                  <ExternalLinkIcon className="size-3" />
                </Link>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 [scrollbar-width:thin]">
              <MentionResolutionProvider contents={mentionResolutionContents} userNames={userResolutionNames}>
                {parentMemo && (
                  <div className="w-auto inline-block mb-2">
                    <Link
                      className="px-3 py-1 border border-border rounded-lg max-w-xs w-auto text-sm flex flex-row justify-start items-center flex-nowrap text-muted-foreground hover:shadow hover:opacity-80"
                      to={`/${parentMemo.name}`}
                      target="_blank"
                    >
                      <ArrowUpLeftFromCircleIcon className="w-4 h-auto shrink-0 opacity-60 mr-2" />
                      <span className="truncate">{parentMemo.content}</span>
                    </Link>
                  </div>
                )}

                <MemoView
                  key={memo.name}
                  memo={memo}
                  compact={false}
                  parentPage={parentPage}
                  shareImageDialogOpen={shareImageDialogOpen}
                  showCreator
                  showVisibility
                  showPinned
                  onShareImageDialogOpenChange={setShareImageDialogOpen}
                />

                <MemoCommentSection
                  memo={memo}
                  comments={comments}
                  parentPage={parentPage}
                  hasMoreComments={hasNextComments}
                  isFetchingMoreComments={isFetchingNextComments}
                  onLoadMoreComments={fetchNextComments}
                />
              </MentionResolutionProvider>
            </div>
          </div>

          {/* Right Side: INFO Panel */}
          {memo.kanban ? (
            <div className="w-84 sm:w-88 shrink-0 h-full bg-card/40 flex flex-col justify-between overflow-hidden border-l border-border/60">
              {/* Properties form fields */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5 [scrollbar-width:thin]">
                <div className="border-b border-border/60 pb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">INFO</h3>
                </div>

                {/* Status Section */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground block">Card Status</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-full justify-start text-xs gap-2 transition-colors",
                      isClosedDraft && "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                    )}
                    onClick={() => setIsClosedDraft(!isClosedDraft)}
                  >
                    {isClosedDraft ? (
                      <>
                        <CheckCircle2Icon className="size-4 text-emerald-500 fill-emerald-500/20" />
                        <span className="font-semibold">Completed</span>
                      </>
                    ) : (
                      <>
                        <CircleIcon className="size-4 text-muted-foreground" />
                        <span>Active / In Progress</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Categories Section (Multiple & Reusable) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <TagIcon className="size-3.5 text-muted-foreground" />
                      <span>Categories ({categoriesDraft.length})</span>
                    </label>
                  </div>

                  {/* Selected categories */}
                  <div className="flex flex-wrap gap-1.5 min-h-7 p-1.5 rounded-md border border-border/60 bg-muted/20">
                    {categoriesDraft.length === 0 && <span className="text-[11px] text-muted-foreground/60 p-0.5">No categories</span>}
                    {categoriesDraft.map((cat) => {
                      const color = resolveCategoryColor(cat);
                      return (
                        <span
                          key={cat}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: `${color}25`,
                            color,
                            border: `1px solid ${color}50`,
                          }}
                        >
                          <span>{cat}</span>
                          <button
                            type="button"
                            onClick={() => handleToggleCategory(cat)}
                            className="hover:opacity-75 transition-opacity cursor-pointer ml-0.5"
                          >
                            <XIcon className="size-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>

                  {/* Reusable categories from board */}
                  {availableBoardCategories.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="text-[11px] text-muted-foreground">Board categories (click to toggle):</div>
                      <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                        {availableBoardCategories.map((item) => {
                          const isSelected = categoriesDraft.includes(item.name);
                          const color = resolveCategoryColor(item.name) || item.color;
                          return (
                            <button
                              key={item.name}
                              type="button"
                              onClick={() => handleToggleCategory(item.name, item.color)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-all cursor-pointer"
                              style={{
                                backgroundColor: isSelected ? color : `${color}15`,
                                color: isSelected ? "#ffffff" : color,
                                border: `1px solid ${color}40`,
                              }}
                            >
                              {isSelected && <CheckIcon className="size-3" />}
                              <span>{item.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Add new custom category */}
                  <form onSubmit={handleAddNewCategory} className="space-y-2 pt-1 border-t border-border/40">
                    <div className="text-[11px] text-muted-foreground">Add new category:</div>
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={newCatInput}
                        onChange={(e) => setNewCatInput(e.target.value)}
                        placeholder="Category name..."
                        className="h-7 text-xs flex-1"
                      />
                      <Button type="submit" size="sm" variant="secondary" className="h-7 px-2.5 text-xs" disabled={!newCatInput.trim()}>
                        <PlusIcon className="size-3 mr-0.5" />
                        Add
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {CATEGORY_PALETTE.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => handleSelectPaletteColor(c.value)}
                          className="size-4 rounded-full border transition-transform hover:scale-110"
                          style={{
                            backgroundColor: c.value,
                            borderColor: newCatColor === c.value ? "var(--color-primary)" : "transparent",
                            boxShadow:
                              newCatColor === c.value ? "0 0 0 2px var(--color-background), 0 0 0 3px var(--color-primary)" : undefined,
                          }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </form>
                </div>

                {/* Milestone Section */}
                <div className="space-y-2.5 pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <TargetIcon className="size-3.5 text-muted-foreground" />
                      <span>Card Milestone</span>
                    </span>
                    {milestoneDraft && (
                      <button
                        type="button"
                        onClick={() => setMilestoneDraft("")}
                        className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Active Milestone Badge */}
                  {milestoneDraft && (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold shadow-2xs"
                        style={{
                          backgroundColor: `${getMilestoneColor(milestoneDraft)}20`,
                          color: getMilestoneColor(milestoneDraft),
                          border: `1px solid ${getMilestoneColor(milestoneDraft)}50`,
                        }}
                      >
                        <TargetIcon className="size-3" />
                        <span>{milestoneDraft}</span>
                        <button
                          type="button"
                          onClick={() => setMilestoneDraft("")}
                          className="hover:opacity-75 transition-opacity cursor-pointer ml-1"
                        >
                          <XIcon className="size-3" />
                        </button>
                      </span>
                    </div>
                  )}

                  {/* Board Milestones Suggestions */}
                  {availableBoardMilestones.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[11px] text-muted-foreground">Board milestones:</div>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {availableBoardMilestones.map((m) => {
                          const isSelected = milestoneDraft === m;
                          const color = getMilestoneColor(m);
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setMilestoneDraft(isSelected ? "" : m)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors cursor-pointer"
                              style={{
                                backgroundColor: isSelected ? color : `${color}15`,
                                color: isSelected ? "#ffffff" : color,
                                border: `1px solid ${color}40`,
                              }}
                            >
                              {isSelected && <CheckIcon className="size-3" />}
                              <span>{m}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Custom Milestone Input */}
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={newMilestoneInput}
                      onChange={(e) => setNewMilestoneInput(e.target.value)}
                      placeholder="e.g. v1.0, Sprint 24..."
                      className="h-7 text-xs flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 px-2.5 text-xs"
                      disabled={!newMilestoneInput.trim()}
                      onClick={() => {
                        setMilestoneDraft(newMilestoneInput.trim());
                        setNewMilestoneInput("");
                      }}
                    >
                      <PlusIcon className="size-3 mr-0.5" />
                      Set
                    </Button>
                  </div>
                </div>

                {/* Due Date Section */}
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <label htmlFor="detail-due-date-input" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <CalendarIcon className="size-3.5 text-muted-foreground" />
                      <span>Due Date & Time</span>
                    </label>
                    {dueDateDraft && (
                      <button
                        type="button"
                        onClick={() => setDueDateDraft("")}
                        className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <Input
                    id="detail-due-date-input"
                    type="datetime-local"
                    value={dueDateDraft}
                    onChange={(e) => setDueDateDraft(e.target.value)}
                    className="h-8 text-xs"
                  />

                  {deadline && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={cn("font-medium", deadline.isOverdue ? "text-destructive" : "text-muted-foreground")}>
                          {deadline.formattedDue}
                        </span>
                        <span
                          className={cn(
                            "font-mono text-[10px]",
                            deadline.isOverdue ? "text-destructive font-semibold" : "text-muted-foreground",
                          )}
                        >
                          {deadline.isOverdue ? deadline.remainingText : `${deadline.progress}% (${deadline.remainingText})`}
                        </span>
                      </div>
                      <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            isClosedDraft ? "bg-emerald-500" : deadline.colorClass,
                          )}
                          style={{ width: `${deadline.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions Footer (Save / Reset / Archive) */}
              <div className="p-4 border-t border-border/70 bg-card/90 space-y-2">
                <Button
                  type="button"
                  className="w-full gap-1.5 text-xs h-8"
                  variant={hasChanges ? "default" : "secondary"}
                  disabled={!hasChanges || isSaving}
                  onClick={() => void handleSaveChanges()}
                >
                  <SaveIcon className="size-3.5" />
                  <span>{isSaving ? "Saving..." : hasChanges ? "Save Changes" : "Saved"}</span>
                </Button>

                {hasChanges && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground hover:text-foreground h-7 gap-1"
                    onClick={handleResetDraft}
                    disabled={isSaving}
                  >
                    <RotateCcwIcon className="size-3" />
                    <span>Discard changes</span>
                  </Button>
                )}

                <div className="pt-2 border-t border-border/40">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-full gap-1.5 text-xs h-8 transition-colors",
                      isArchived ? "text-primary border-primary/50 hover:bg-primary/10" : "text-muted-foreground hover:text-foreground",
                    )}
                    disabled={isArchiving}
                    onClick={() => void handleToggleArchiveMemo()}
                  >
                    {isArchived ? <ArchiveRestoreIcon className="size-3.5" /> : <ArchiveIcon className="size-3.5" />}
                    <span>
                      {isArchiving
                        ? isArchived
                          ? "Restoring..."
                          : "Archiving..."
                        : isArchived
                          ? t("common.restore") || "Restore"
                          : t("common.archive") || "Archive"}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MemoDetailDialog;
