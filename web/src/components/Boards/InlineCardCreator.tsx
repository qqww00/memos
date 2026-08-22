import { GlobeIcon, LockIcon, PlusIcon, UsersIcon, XIcon } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useCreateBoardMemo } from "@/hooks/useBoardQueries";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

interface InlineCardCreatorProps {
  boardId: string;
  columnId: string;
  nextPosition: number;
  onClose: () => void;
}

export const InlineCardCreator = ({ boardId, columnId, nextPosition, onClose }: InlineCardCreatorProps) => {
  const t = useTranslate();
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(Visibility.PRIVATE);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const createBoardMemo = useCreateBoardMemo(boardId);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    try {
      await createBoardMemo.mutateAsync({
        content: trimmed,
        visibility,
        columnId,
        position: nextPosition,
      });
      setContent("");
      toast.success("Memo created");
      onClose();
    } catch {
      toast.error("Failed to create memo");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
    <div className="rounded-lg border border-primary/40 bg-card p-2.5 shadow-sm space-y-2">
      <Textarea
        ref={textareaRef}
        autoFocus
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Write a memo..."
        rows={3}
        className="resize-none border-none p-0 text-sm shadow-none focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/60"
      />

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
            disabled={!content.trim() || createBoardMemo.isPending}
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
