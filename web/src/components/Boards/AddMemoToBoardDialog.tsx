import { create } from "@bufbuild/protobuf";
import { useQuery } from "@tanstack/react-query";
import {
  BoldIcon,
  CalendarIcon,
  CheckCircle2Icon,
  CheckIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  CircleIcon,
  CodeIcon,
  EyeIcon,
  FileCode2Icon,
  GlobeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  LockIcon,
  PenLineIcon,
  PlusIcon,
  QuoteIcon,
  RotateCcwIcon,
  SearchIcon,
  SquareCodeIcon,
  StrikethroughIcon,
  TableIcon,
  TagIcon,
  TargetIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import MemoContent from "@/components/MemoContent";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { memoServiceClient } from "@/connect";
import { useBoardCards, useCreateBoardMemo, useUpdateMemoKanban } from "@/hooks/useBoardQueries";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import type { BoardColumn } from "@/types/proto/api/v1/board_service_pb";
import { KanbanSchema, ListMemosRequestSchema, type Memo, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { CATEGORY_PALETTE, computeDeadlineProgress, getCardCategories, getCategoryColor, getMilestoneColor } from "./cardUtils";
import { ENGINEERING_TEMPLATES, type EngineeringTemplate } from "./engineeringTemplates";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [activeTab, setActiveTab] = useState<"create" | "search">("create");
  const [previewMode, setPreviewMode] = useState<"write" | "preview">("write");
  const [selectedColumnId, setSelectedColumnId] = useState(initialColumnId || columns[0]?.id || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isClosedDraft, setIsClosedDraft] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [newCatInput, setNewCatInput] = useState("");
  const [newCatColor, setNewCatColor] = useState(CATEGORY_PALETTE[0].value);
  const [categoryColorMap, setCategoryColorMap] = useState<Record<string, string>>({});
  const [selectedMilestone, setSelectedMilestone] = useState("");
  const [newMilestoneInput, setNewMilestoneInput] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newVisibility, setNewVisibility] = useState<Visibility>(Visibility.PRIVATE);
  const [isSaving, setIsSaving] = useState(false);

  const { data: boardCards = [] } = useBoardCards(boardId, { enabled: !!boardId && open });

  // Extract all categories used across this board
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

  const updateMemoKanban = useUpdateMemoKanban();
  const createBoardMemo = useCreateBoardMemo(boardId);

  const currentColumnId = selectedColumnId || initialColumnId || columns[0]?.id || "";
  const selectedColumn = useMemo(() => columns.find((c) => c.id === currentColumnId), [columns, currentColumnId]);

  // Reset or initialize column selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedColumnId(initialColumnId || columns[0]?.id || "");
    }
  }, [open, initialColumnId, columns]);

  const { data: searchMemos = [], isLoading: isSearchLoading } = useQuery({
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

  const resolveCategoryColor = (cat: string) => {
    return categoryColorMap[cat] || getCategoryColor(cat);
  };

  const handleToggleCategory = (cat: string, defaultColor?: string) => {
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
    if (defaultColor) {
      setCategoryColorMap((prev) => ({ ...prev, [cat]: prev[cat] || defaultColor }));
    }
  };

  const handleSelectPaletteColor = (color: string) => {
    setNewCatColor(color);
    if (selectedCategories.length > 0) {
      const targetCat = selectedCategories[0];
      setCategoryColorMap((prev) => ({ ...prev, [targetCat]: color }));
    }
  };

  const handleAddNewCategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCatInput.trim();
    if (!trimmed) return;
    if (!selectedCategories.includes(trimmed)) {
      setSelectedCategories((prev) => [...prev, trimmed]);
    }
    setCategoryColorMap((prev) => ({ ...prev, [trimmed]: newCatColor }));
    setNewCatInput("");
  };

  const handleSelectTemplate = (tmpl: EngineeringTemplate) => {
    setNewContent(tmpl.templateContent);
    if (!selectedCategories.includes(tmpl.category)) {
      setSelectedCategories((prev) => [...prev, tmpl.category]);
    }
    setCategoryColorMap((prev) => ({ ...prev, [tmpl.category]: tmpl.categoryColorHex }));
    toast.success(`Loaded ${tmpl.category} template`);
  };

  const insertMarkdown = (prefix: string, suffix = "", defaultText = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end) || defaultText;
    const replacement = `${prefix}${selected}${suffix}`;
    const updated = text.substring(0, start) + replacement + text.substring(end);
    setNewContent(updated);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 0);
  };

  const handleReset = () => {
    setNewContent("");
    setSelectedCategories([]);
    setSelectedMilestone("");
    setNewMilestoneInput("");
    setNewDueDate("");
    setIsClosedDraft(false);
    setNewCatInput("");
    setPreviewMode("write");
  };

  const handleCreateMemo = async () => {
    const trimmed = newContent.trim();
    if (!trimmed || !currentColumnId) return;

    const columnCards = existingColumnCards?.get(currentColumnId) ?? [];
    const lastPosition = columnCards.at(-1)?.kanban?.position ?? 0;
    const newPosition = lastPosition + 1.0;

    let dueTimestamp: { seconds: bigint; nanos: number } | undefined;
    if (newDueDate) {
      const [year, month, day] = newDueDate.split("-").map(Number);
      const targetDate = new Date(year, month - 1, day, 23, 59, 59);
      const ms = targetDate.getTime();
      if (!Number.isNaN(ms)) {
        dueTimestamp = { seconds: BigInt(Math.floor(ms / 1000)), nanos: 0 };
      }
    }

    const primaryCategory = selectedCategories[0];
    const primaryColor = primaryCategory ? categoryColorMap[primaryCategory] || newCatColor : undefined;

    setIsSaving(true);
    try {
      await createBoardMemo.mutateAsync({
        content: trimmed,
        visibility: newVisibility,
        columnId: currentColumnId,
        position: newPosition,
        categories: selectedCategories,
        category: primaryCategory || undefined,
        categoryColorHex: primaryColor,
        milestone: selectedMilestone || undefined,
        dueTime: dueTimestamp,
        isClosed: isClosedDraft,
      });
      handleReset();
      toast.success("Memo created");
      onOpenChange(false);
    } catch {
      toast.error("Failed to create memo");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddExistingMemo = async (memo: Memo) => {
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

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleCreateMemo();
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

  const draftDueSec = newDueDate
    ? (() => {
        const [year, month, day] = newDueDate.split("-").map(Number);
        return Math.floor(new Date(year, month - 1, day, 23, 59, 59).getTime() / 1000);
      })()
    : undefined;
  const deadline = computeDeadlineProgress(Math.floor(Date.now() / 1000), draftDueSec);

  const wordCount = newContent.trim() ? newContent.trim().split(/\s+/).length : 0;
  const charCount = newContent.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="full"
        className="w-[96vw] sm:w-[94vw] md:w-[92vw] lg:w-[90vw] !max-w-6xl xl:!max-w-7xl h-[88vh] max-h-[92vh] p-0 gap-0 overflow-hidden [&>div:first-child]:h-full [&>div:first-child]:p-0 [&>div:first-child]:gap-0 [&>div:first-child]:overflow-hidden"
      >
        <div className="flex flex-row w-full h-full min-h-0 overflow-hidden">
          {/* Left Side: Markdown Editor / Input Area */}
          <div className="flex-1 flex flex-col min-w-0 h-full border-r border-border bg-background">
            <DialogHeader className="px-6 py-3.5 border-b border-border/70 flex flex-row items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-sm font-semibold text-foreground">
                  {activeTab === "create" ? t("boards.add-memo") : t("boards.add-existing-memo")}
                </DialogTitle>
                <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/50 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab("create")}
                    className={cn(
                      "px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 cursor-pointer",
                      activeTab === "create" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <PlusIcon className="size-3" />
                    <span>{t("common.create")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("search")}
                    className={cn(
                      "px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 cursor-pointer",
                      activeTab === "search" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <SearchIcon className="size-3" />
                    <span>{t("boards.add-existing-memo")}</span>
                  </button>
                </div>
              </div>

              {/* Right Side Header Controls (Templates, Visibility, Write/Preview) */}
              {activeTab === "create" && (
                <div className="flex items-center gap-2">
                  {/* Engineering Templates Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground font-normal"
                        >
                          <FileCode2Icon className="size-3.5 text-primary" />
                          <span>Templates</span>
                          <ChevronDownIcon className="size-3 opacity-60 ml-0.5" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
                      <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Engineering Templates</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {ENGINEERING_TEMPLATES.map((tmpl) => (
                        <DropdownMenuItem
                          key={tmpl.id}
                          onClick={() => handleSelectTemplate(tmpl)}
                          className="flex flex-col items-start gap-0.5 cursor-pointer py-1.5"
                        >
                          <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: tmpl.categoryColorHex }} />
                            <span>{tmpl.title}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground line-clamp-1">{tmpl.description}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Visibility Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground font-normal gap-1.5"
                        >
                          {getVisibilityIcon(newVisibility)}
                          <span>{getVisibilityLabel(newVisibility)}</span>
                          <ChevronDownIcon className="size-3 opacity-60 ml-0.5" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" size="sm">
                      <DropdownMenuItem onClick={() => setNewVisibility(Visibility.PRIVATE)} className="gap-2 cursor-pointer">
                        <LockIcon className="size-3.5" />
                        <span>{t("memo.visibility.private")}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setNewVisibility(Visibility.PROTECTED)} className="gap-2 cursor-pointer">
                        <UsersIcon className="size-3.5" />
                        <span>{t("memo.visibility.protected")}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setNewVisibility(Visibility.PUBLIC)} className="gap-2 cursor-pointer">
                        <GlobeIcon className="size-3.5" />
                        <span>{t("memo.visibility.public")}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Write vs Preview Mode Switcher */}
                  <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/50 text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("write")}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1 cursor-pointer",
                        previewMode === "write"
                          ? "bg-background text-foreground shadow-2xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <PenLineIcon className="size-3" />
                      <span>Write</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode("preview")}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1 cursor-pointer",
                        previewMode === "preview"
                          ? "bg-background text-foreground shadow-2xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <EyeIcon className="size-3" />
                      <span>Preview</span>
                    </button>
                  </div>
                </div>
              )}
            </DialogHeader>

            {/* TAB 1: Create New Memo */}
            {activeTab === "create" ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {previewMode === "write" ? (
                  <>
                    {/* Markdown Formatting Toolbar */}
                    <div className="flex items-center gap-1 px-4 py-2 border-b border-border/50 bg-muted/20 flex-wrap shrink-0">
                      {/* Heading Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                              title="Heading"
                            >
                              <span>H</span>
                              <ChevronDownIcon className="size-2.5 opacity-60 ml-0.5" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="start" size="sm">
                          <DropdownMenuItem onClick={() => insertMarkdown("# ", "", "Heading 1")} className="gap-2 cursor-pointer">
                            <Heading1Icon className="size-3.5" />
                            <span>Heading 1</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => insertMarkdown("## ", "", "Heading 2")} className="gap-2 cursor-pointer">
                            <Heading2Icon className="size-3.5" />
                            <span>Heading 2</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => insertMarkdown("### ", "", "Heading 3")} className="gap-2 cursor-pointer">
                            <Heading3Icon className="size-3.5" />
                            <span>Heading 3</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <div className="h-4 w-px bg-border/60 mx-0.5" />

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        title="Bold (Ctrl+B)"
                        onClick={() => insertMarkdown("**", "**", "bold text")}
                      >
                        <BoldIcon className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        title="Italic (Ctrl+I)"
                        onClick={() => insertMarkdown("*", "*", "italic text")}
                      >
                        <ItalicIcon className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        title="Strikethrough"
                        onClick={() => insertMarkdown("~~", "~~", "strikethrough")}
                      >
                        <StrikethroughIcon className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        title="Inline Code"
                        onClick={() => insertMarkdown("`", "`", "code")}
                      >
                        <CodeIcon className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        title="Code Block"
                        onClick={() => insertMarkdown("```\n", "\n```", "code block")}
                      >
                        <SquareCodeIcon className="size-3.5" />
                      </Button>

                      <div className="h-4 w-px bg-border/60 mx-0.5" />

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        title="Bullet List"
                        onClick={() => insertMarkdown("- ", "", "List item")}
                      >
                        <ListIcon className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        title="Numbered List"
                        onClick={() => insertMarkdown("1. ", "", "List item")}
                      >
                        <ListOrderedIcon className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        title="Task Checklist"
                        onClick={() => insertMarkdown("- [ ] ", "", "Task item")}
                      >
                        <CheckSquareIcon className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        title="Blockquote"
                        onClick={() => insertMarkdown("> ", "", "Quote")}
                      >
                        <QuoteIcon className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        title="Insert Link"
                        onClick={() => insertMarkdown("[", "](https://)", "link title")}
                      >
                        <LinkIcon className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        title="Insert Table"
                        onClick={() => insertMarkdown("\n| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |\n")}
                      >
                        <TableIcon className="size-3.5" />
                      </Button>
                    </div>

                    {/* Textarea Input */}
                    <div className="flex-1 min-h-0 p-6 flex flex-col">
                      <textarea
                        ref={textareaRef}
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Write your memo in markdown... (supports #tags, checklists, tables, code blocks)&#10;Tip: Press Cmd/Ctrl+Enter to save"
                        className="flex-1 w-full p-2 resize-none border-none outline-none focus:outline-none focus:ring-0 text-sm leading-relaxed font-sans bg-transparent placeholder:text-muted-foreground/50 [scrollbar-width:thin]"
                        autoFocus
                      />
                    </div>

                    {/* Footer Status Bar */}
                    <div className="px-6 py-2 border-t border-border/50 bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
                      <div className="flex items-center gap-3 font-mono">
                        <span>{wordCount} words</span>
                        <span>•</span>
                        <span>{charCount} characters</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground/80">
                        <kbd className="px-1.5 py-0.5 rounded border border-border/60 bg-muted text-[10px] font-mono">⌘/Ctrl + Enter</kbd>
                        <span>to create</span>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Live Preview Mode */
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 [scrollbar-width:thin]">
                    {newContent.trim() ? (
                      <div className="max-w-none prose dark:prose-invert">
                        <MemoContent content={newContent} />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground text-xs italic">
                        Nothing to preview. Switch to "Write" mode to enter markdown content.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* TAB 2: Search Existing Memos */
              <div className="flex-1 flex flex-col min-h-0 p-6 space-y-3">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("boards.search-memos")}
                    className="pl-9 h-9 text-xs"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 [scrollbar-width:thin]">
                  {isSearchLoading && (
                    <div className="space-y-2 py-4">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-16 animate-pulse rounded-lg border border-border/60 bg-muted/20" />
                      ))}
                    </div>
                  )}

                  {!isSearchLoading && searchMemos.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-muted-foreground">
                      <SearchIcon className="size-8 opacity-40 mb-2" />
                      <span>{t("boards.no-memos-found")}</span>
                    </div>
                  )}

                  {!isSearchLoading &&
                    searchMemos.map((memo) => (
                      <div
                        key={memo.name}
                        className="group flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card p-3 transition-colors hover:bg-accent/40"
                      >
                        <p className="line-clamp-2 text-xs text-foreground flex-1 leading-relaxed">{memo.content || "(Empty memo)"}</p>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 shrink-0 text-xs gap-1"
                          onClick={() => handleAddExistingMemo(memo)}
                          disabled={updateMemoKanban.isPending}
                        >
                          <PlusIcon className="size-3" />
                          <span>{t("boards.add-memo")}</span>
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Side: INFO Panel (matching MemoDetailDialog) */}
          <div className="w-84 sm:w-88 shrink-0 h-full bg-card/40 flex flex-col justify-between overflow-hidden border-l border-border/60">
            {/* Scrollable properties form fields */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 [scrollbar-width:thin]">
              <div className="border-b border-border/60 pb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">INFO</h3>
                {selectedColumn && (
                  <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[140px]">{selectedColumn.title}</span>
                )}
              </div>

              {/* Target Column Selection */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground block">Target Column</label>
                <Select value={currentColumnId} onValueChange={setSelectedColumnId}>
                  <SelectTrigger className="h-8 w-full text-xs bg-background">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
                      <SelectItem key={col.id} value={col.id}>
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: col.colorHex || "#64748b" }} />
                          <span className="truncate">{col.title}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Card Status Section */}
              <div className="space-y-2 pt-2 border-t border-border/40">
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
              <div className="space-y-2.5 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <TagIcon className="size-3.5 text-muted-foreground" />
                    <span>Categories ({selectedCategories.length})</span>
                  </label>
                </div>

                {/* Selected categories badges */}
                <div className="flex flex-wrap gap-1.5 min-h-7 p-1.5 rounded-md border border-border/60 bg-muted/20">
                  {selectedCategories.length === 0 && <span className="text-[11px] text-muted-foreground/60 p-0.5">No categories</span>}
                  {selectedCategories.map((cat) => {
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

                {/* Reusable categories dropdown */}
                {availableBoardCategories.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <div className="text-[11px] text-muted-foreground">Board categories:</div>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full justify-between h-7 px-2 text-xs text-muted-foreground hover:text-foreground font-normal"
                          >
                            <span className="truncate">Select from board...</span>
                            <ChevronDownIcon className="size-3.5 opacity-60 ml-1 shrink-0" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="start" className="w-64 max-h-56 overflow-y-auto">
                        {availableBoardCategories.map((item) => {
                          const isSelected = selectedCategories.includes(item.name);
                          const color = resolveCategoryColor(item.name) || item.color;
                          return (
                            <DropdownMenuItem
                              key={item.name}
                              onClick={(e) => {
                                e.preventDefault();
                                handleToggleCategory(item.name, item.color);
                              }}
                              className="flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                                <span
                                  className={cn(
                                    "size-3.5 flex items-center justify-center rounded border text-[10px] shrink-0",
                                    isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40",
                                  )}
                                >
                                  {isSelected && <CheckIcon className="size-2.5 stroke-[3]" />}
                                </span>
                                <span className="truncate">{item.name}</span>
                              </div>
                              <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                  {selectedMilestone && (
                    <button
                      type="button"
                      onClick={() => setSelectedMilestone("")}
                      className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Active Milestone Badge */}
                {selectedMilestone && (
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold shadow-2xs"
                      style={{
                        backgroundColor: `${getMilestoneColor(selectedMilestone)}20`,
                        color: getMilestoneColor(selectedMilestone),
                        border: `1px solid ${getMilestoneColor(selectedMilestone)}50`,
                      }}
                    >
                      <TargetIcon className="size-3" />
                      <span>{selectedMilestone}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedMilestone("")}
                        className="hover:opacity-75 transition-opacity cursor-pointer ml-1"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </span>
                  </div>
                )}

                {/* Board Milestones Dropdown */}
                {availableBoardMilestones.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[11px] text-muted-foreground">Board milestones:</div>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full justify-between h-7 px-2 text-xs text-muted-foreground hover:text-foreground font-normal"
                          >
                            <span className="truncate">{selectedMilestone || "Select milestone..."}</span>
                            {selectedMilestone ? (
                              <span
                                className="size-2.5 rounded-full shrink-0 ml-1"
                                style={{ backgroundColor: getMilestoneColor(selectedMilestone) }}
                              />
                            ) : (
                              <ChevronDownIcon className="size-3.5 opacity-60 ml-1 shrink-0" />
                            )}
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="start" className="w-64 max-h-56 overflow-y-auto">
                        <DropdownMenuItem
                          onClick={() => setSelectedMilestone("")}
                          className="text-muted-foreground flex items-center gap-2 cursor-pointer"
                        >
                          <span className="size-3.5 shrink-0" />
                          <span>None / Clear milestone</span>
                        </DropdownMenuItem>
                        {availableBoardMilestones.map((m) => {
                          const isSelected = selectedMilestone === m;
                          const color = getMilestoneColor(m);
                          return (
                            <DropdownMenuItem
                              key={m}
                              onClick={() => setSelectedMilestone(isSelected ? "" : m)}
                              className="flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                                {isSelected ? (
                                  <CheckIcon className="size-3.5 text-primary shrink-0" />
                                ) : (
                                  <span className="size-3.5 shrink-0" />
                                )}
                                <span className={cn("truncate", isSelected && "font-semibold text-foreground")}>{m}</span>
                              </div>
                              <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                      setSelectedMilestone(newMilestoneInput.trim());
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
                  <label htmlFor="create-due-date-input" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <CalendarIcon className="size-3.5 text-muted-foreground" />
                    <span>Due Date</span>
                  </label>
                  {newDueDate && (
                    <button
                      type="button"
                      onClick={() => setNewDueDate("")}
                      className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <Input
                  id="create-due-date-input"
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
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

            {/* Bottom Actions Footer */}
            <div className="p-4 border-t border-border/70 bg-card/90 space-y-2">
              {activeTab === "create" ? (
                <>
                  <Button
                    type="button"
                    className="w-full gap-1.5 text-xs h-8"
                    disabled={!newContent.trim() || isSaving}
                    onClick={() => void handleCreateMemo()}
                  >
                    <PlusIcon className="size-3.5" />
                    <span>{isSaving ? "Creating..." : "Create Memo"}</span>
                  </Button>

                  {newContent.trim() && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-muted-foreground hover:text-foreground h-7 gap-1"
                      onClick={handleReset}
                      disabled={isSaving}
                    >
                      <RotateCcwIcon className="size-3" />
                      <span>Discard draft</span>
                    </Button>
                  )}
                </>
              ) : (
                <div className="text-xs text-muted-foreground text-center py-1">
                  Select a memo from the left to add to column{" "}
                  <span className="font-semibold text-foreground">{selectedColumn?.title}</span>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs h-8 text-muted-foreground hover:text-foreground"
                onClick={() => onOpenChange(false)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddMemoToBoardDialog;
