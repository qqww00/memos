import { ArrowUpLeftFromCircleIcon, ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import MemoCommentSection from "@/components/MemoCommentSection";
import { MentionResolutionProvider } from "@/components/MemoContent/MentionResolutionContext";
import MemoView from "@/components/MemoView";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useInfiniteMemoComments, useMemo } from "@/hooks/useMemoQueries";
import { useTranslate } from "@/utils/i18n";

interface MemoDetailDialogProps {
  memoName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentPage?: string;
}

export const MemoDetailDialog = ({ memoName, open, onOpenChange, parentPage }: MemoDetailDialogProps) => {
  const t = useTranslate();
  const [shareImageDialogOpen, setShareImageDialogOpen] = useState(false);

  const { data: memo } = useMemo(memoName || "", {
    enabled: open && !!memoName,
  });

  const { data: parentMemo } = useMemo(memo?.parent || "", {
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

  if (!memo) return null;

  const mentionResolutionContents = [memo.content, ...comments.map((comment) => comment.content)];
  const userResolutionNames = Array.from(
    new Set([memo, ...comments].flatMap((item) => [item.creator, ...(item.reactions ?? []).map((reaction) => reaction.creator)])),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="2xl" className="max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-border/70 flex flex-row items-center justify-between">
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

        <div className="flex-1 overflow-y-auto p-5 space-y-4 [scrollbar-width:thin]">
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
      </DialogContent>
    </Dialog>
  );
};

export default MemoDetailDialog;
