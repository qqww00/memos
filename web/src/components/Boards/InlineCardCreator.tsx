import { CalendarIcon, CheckIcon, FileCode2Icon, GlobeIcon, LockIcon, PlusIcon, TagIcon, TargetIcon, UsersIcon, XIcon } from "lucide-react";
import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useBoardCards, useCreateBoardMemo } from "@/hooks/useBoardQueries";
import { cn } from "@/lib/utils";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { CATEGORY_PALETTE, getCardCategories, getCategoryColor, getMilestoneColor } from "./cardUtils";
import { ENGINEERING_TEMPLATES, type EngineeringTemplate } from "./engineeringTemplates";

interface InlineCardCreatorProps {
  boardId: string;
  columnId: string;
  nextPosition: number;
  onClose: () => void;
}

export const InlineCardCreator = ({ boardId, columnId, nextPosition, onClose }: InlineCardCreatorProps) => {
  const t = useTranslate();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [newCatInput, setNewCatInput] = useState("");
  const [newCatColor, setNewCatColor] = useState(CATEGORY_PALETTE[0].value);
  const [selectedMilestone, setSelectedMilestone] = useState("");
  const [newMilestoneInput, setNewMilestoneInput] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(Visibility.PRIVATE);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: boardCards = [] } = useBoardCards(boardId);
  const availableBoardCategories = useMemo(() => {
    const set = new Set<string>();
    for (const card of boardCards) {
      for (const c of getCardCategories(card.kanban)) {
        set.add(c);
      }
    }
    return Array.from(set);
  }, [boardCards]);

  const availableBoardMilestones = useMemo(() => {
    const set = new Set<string>();
    for (const card of boardCards) {
      if (card.kanban?.milestone?.trim()) {
        set.add(card.kanban.milestone.trim());
      }
    }
    return Array.from(set).sort();
  }, [boardCards]);

  const createBoardMemo = useCreateBoardMemo(boardId);

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

  const handleSelectTemplate = (tmpl: EngineeringTemplate) => {
    setContent(tmpl.templateContent);
    if (!selectedCategories.includes(tmpl.category)) {
      setSelectedCategories((prev) => [...prev, tmpl.category]);
    }
    textareaRef.current?.focus();
    toast.success(`Loaded ${tmpl.category} template`);
  };

  const handleSubmit = async () => {
    const trimmedContent = content.trim();
    const trimmedTitle = title.trim();
    if (!trimmedContent && !trimmedTitle) return;

    let finalContent = trimmedContent;
    if (trimmedTitle) {
      finalContent = trimmedContent ? `# ${trimmedTitle}\n\n${trimmedContent}` : `# ${trimmedTitle}`;
    }

    let dueTimestamp: { seconds: bigint; nanos: number } | undefined;
    if (dueDate) {
      const ms = new Date(dueDate).getTime();
      if (!Number.isNaN(ms)) {
        dueTimestamp = { seconds: BigInt(Math.floor(ms / 1000)), nanos: 0 };
      }
    }

    try {
      await createBoardMemo.mutateAsync({
        content: finalContent,
        visibility,
        columnId,
        position: nextPosition,
        categories: selectedCategories,
        category: selectedCategories[0] || undefined,
        categoryColorHex: selectedCategories[0] ? newCatColor : undefined,
        milestone: selectedMilestone || undefined,
        dueTime: dueTimestamp,
      });
      setTitle("");
      setContent("");
      setSelectedCategories([]);
      setSelectedMilestone("");
      toast.success("Memo created");
      onClose();
    } catch {
      toast.error("Failed to create memo");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
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
    <div className="rounded-lg border border-primary/40 bg-card p-3 shadow-sm space-y-2.5">
      <input
        type="text"
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Card title (optional)..."
        className="w-full text-sm font-semibold placeholder:text-muted-foreground/50 placeholder:font-normal bg-transparent border-0 border-b border-border/40 pb-1.5 focus:outline-hidden focus:border-primary/60 transition-colors"
      />
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Write description or notes..."
        rows={2}
        className="resize-none border-none p-0 text-sm shadow-none focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/60"
      />

      {/* Selected milestone & categories tags preview */}
      {(selectedCategories.length > 0 || selectedMilestone) && (
        <div className="flex flex-wrap gap-1 items-center">
          {selectedMilestone && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold"
              style={{
                backgroundColor: `${getMilestoneColor(selectedMilestone)}20`,
                color: getMilestoneColor(selectedMilestone),
                border: `1px solid ${getMilestoneColor(selectedMilestone)}50`,
              }}
            >
              <TargetIcon className="size-2.5" />
              <span>{selectedMilestone}</span>
              <button type="button" onClick={() => setSelectedMilestone("")} className="hover:opacity-75 transition-opacity cursor-pointer">
                <XIcon className="size-2.5" />
              </button>
            </span>
          )}

          {selectedCategories.map((cat) => {
            const color = getCategoryColor(cat);
            return (
              <span
                key={cat}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium"
                style={{
                  backgroundColor: `${color}20`,
                  color,
                  border: `1px solid ${color}40`,
                }}
              >
                <span>{cat}</span>
                <button type="button" onClick={() => toggleCategory(cat)} className="hover:opacity-75 transition-opacity cursor-pointer">
                  <XIcon className="size-2.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Category, Milestone and Due Date options */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40 text-xs">
        {/* Milestone Popover */}
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground",
                  selectedMilestone && "border-primary/60 text-primary bg-primary/5 font-semibold",
                )}
              >
                <TargetIcon className="size-3" />
                <span>{selectedMilestone ? selectedMilestone : "Milestone"}</span>
              </Button>
            }
          />
          <PopoverContent align="start" className="w-64 p-3 space-y-2.5">
            <div className="text-xs font-semibold text-foreground">Card Milestone</div>

            {availableBoardMilestones.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] text-muted-foreground">Board milestones:</div>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {availableBoardMilestones.map((m) => {
                    const isSelected = selectedMilestone === m;
                    const color = getMilestoneColor(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSelectedMilestone(isSelected ? "" : m)}
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

            <div className="space-y-1.5 pt-1 border-t border-border/40">
              <div className="text-[11px] text-muted-foreground">Custom milestone:</div>
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
                  className="h-7 px-2 text-xs"
                  disabled={!newMilestoneInput.trim()}
                  onClick={() => {
                    setSelectedMilestone(newMilestoneInput.trim());
                    setNewMilestoneInput("");
                  }}
                >
                  <CheckIcon className="size-3" />
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Category Popover */}
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm" className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground">
                <TagIcon className="size-3" />
                <span>{selectedCategories.length > 0 ? `${selectedCategories.length} categories` : "Categories"}</span>
              </Button>
            }
          />
          <PopoverContent align="start" className="w-64 p-3 space-y-2.5">
            <div className="text-xs font-semibold text-foreground">Categories</div>

            {/* Reusable categories list from board */}
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

            {/* Create new category */}
            <form onSubmit={handleAddNewCategory} className="space-y-2 pt-1 border-t border-border/40">
              <div className="text-[11px] text-muted-foreground">Add new:</div>
              <div className="flex items-center gap-1.5">
                <Input
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                  placeholder="e.g. Frontend"
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

        {/* Due Date picker */}
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm" className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground">
                <CalendarIcon className="size-3" />
                <span>{dueDate ? new Date(dueDate).toLocaleDateString() : "Due Date"}</span>
              </Button>
            }
          />
          <PopoverContent align="start" className="w-60 p-2.5 space-y-2">
            <label htmlFor="card-due-date-input" className="text-xs font-medium text-foreground block">
              Set due date & time
            </label>
            <Input
              id="card-due-date-input"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-8 text-xs"
            />
            {dueDate && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] text-muted-foreground w-full"
                onClick={() => setDueDate("")}
              >
                Clear due date
              </Button>
            )}
          </PopoverContent>
        </Popover>

        {/* Engineering Templates Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground">
                <FileCode2Icon className="size-3 text-primary" />
                <span>Templates</span>
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-64">
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
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5">
                {getVisibilityIcon(visibility)}
                <span>{getVisibilityLabel(visibility)}</span>
              </Button>
            }
          />
          <DropdownMenuContent align="start" size="sm">
            <DropdownMenuItem onClick={() => setVisibility(Visibility.PRIVATE)} className="gap-2">
              <LockIcon className="size-3.5" />
              <span>{t("memo.visibility.private")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setVisibility(Visibility.PROTECTED)} className="gap-2">
              <UsersIcon className="size-3.5" />
              <span>{t("memo.visibility.protected")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setVisibility(Visibility.PUBLIC)} className="gap-2">
              <GlobeIcon className="size-3.5" />
              <span>{t("memo.visibility.public")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-6 text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <XIcon className="size-3.5" />
          </Button>

          <Button
            type="button"
            size="sm"
            className="h-6 px-2.5 text-xs gap-1"
            disabled={(!title.trim() && !content.trim()) || createBoardMemo.isPending}
            onClick={() => void handleSubmit()}
          >
            <PlusIcon className="size-3" />
            <span>{t("common.create")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InlineCardCreator;
