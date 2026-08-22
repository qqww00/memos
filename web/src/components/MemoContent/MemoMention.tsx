import { useQuery } from "@tanstack/react-query";
import type { Element } from "hast";
import { FileTextIcon, LockIcon, UsersIcon } from "lucide-react";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { memoDetailQueryOptions } from "@/hooks/useMemoQueries";
import { cn } from "@/lib/utils";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";

interface MemoMentionProps extends React.HTMLAttributes<HTMLSpanElement> {
  node?: Element;
  "data-memo-mention"?: string;
  "data-memo-id"?: string;
  "data-memo-title"?: string;
  children?: React.ReactNode;
}

export const MemoMention: React.FC<MemoMentionProps> = ({
  "data-memo-mention": dataMemoMention,
  "data-memo-id": dataMemoId,
  "data-memo-title": dataMemoTitle,
  children,
  className,
  node: _node,
  ...props
}) => {
  const memoName = dataMemoMention || (dataMemoId ? `memos/${dataMemoId}` : "");
  const [isOpen, setIsOpen] = useState(false);

  const { data: memo } = useQuery({
    ...memoDetailQueryOptions(memoName),
    enabled: Boolean(memoName) && isOpen,
  });

  if (!memoName) {
    return (
      <span className={className} {...props}>
        {children}
      </span>
    );
  }

  const displayTitle = dataMemoTitle || memo?.property?.title || dataMemoId || memoName;
  const memoRoute = `/${memoName}`;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        render={
          <Link
            to={memoRoute}
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 my-0.5 rounded-md bg-secondary/80 hover:bg-secondary text-secondary-foreground text-xs md:text-sm font-medium border border-border/50 transition-colors no-underline align-baseline",
              className,
            )}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
            data-memo-mention={memoName}
          />
        }
      >
        <FileTextIcon className="size-3.5 shrink-0 opacity-70" />
        <span className="truncate max-w-[320px]">{displayTitle}</span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-80 sm:w-96 md:w-[420px] max-w-[90vw] p-3.5 text-xs bg-popover text-popover-foreground border shadow-lg rounded-lg pointer-events-auto"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        {memo ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2 border-b pb-2">
              <div className="flex items-center gap-1.5 font-medium text-foreground truncate text-sm">
                <FileTextIcon className="size-4 shrink-0 text-primary" />
                <span className="truncate font-semibold">{memo.property?.title || memo.name}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground shrink-0 text-[11px]">
                {memo.visibility === Visibility.PRIVATE && <LockIcon className="size-3" />}
                {memo.visibility === Visibility.PROTECTED && <UsersIcon className="size-3" />}
                <span>{memo.createTime ? new Date(Number(memo.createTime.seconds) * 1000).toLocaleDateString() : ""}</span>
              </div>
            </div>
            <p className="text-muted-foreground line-clamp-4 leading-relaxed whitespace-pre-wrap">
              {memo.snippet || <span className="italic">Empty content</span>}
            </p>
            <Link to={memoRoute} className="text-primary hover:underline font-medium text-xs self-end mt-1">
              Open memo →
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2 py-3 text-muted-foreground">
            <FileTextIcon className="size-4 animate-spin text-primary/70" />
            <span>Loading preview...</span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
