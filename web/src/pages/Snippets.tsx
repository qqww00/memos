import copy from "copy-to-clipboard";
import { CheckIcon, Code2Icon, CopyIcon, FileCode2Icon, RotateCcwIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { MemoDetailDialog } from "@/components/Boards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemos } from "@/hooks/useMemoQueries";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common_pb";
import { type ExtractedSnippet, extractSnippetsFromMemos } from "@/utils/snippetUtils";

const LANG_COLORS: Record<string, string> = {
  go: "#00add8",
  typescript: "#3178c6",
  ts: "#3178c6",
  tsx: "#3178c6",
  javascript: "#f7df1e",
  js: "#f7df1e",
  jsx: "#f7df1e",
  python: "#3776ab",
  py: "#3776ab",
  sql: "#e38c00",
  bash: "#4eaa25",
  sh: "#4eaa25",
  zsh: "#4eaa25",
  proto: "#4285f4",
  protobuf: "#4285f4",
  json: "#5b5b5b",
  yaml: "#cb171e",
  yml: "#cb171e",
  markdown: "#083fa1",
  md: "#083fa1",
  rust: "#dea584",
  rs: "#dea584",
  dockerfile: "#2496ed",
};

export const Snippets = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedMemoName, setSelectedMemoName] = useState<string | null>(null);

  // Fetch all active memos
  const { data: memoResponse, isLoading } = useMemos({
    state: State.NORMAL,
  });

  const memos = useMemo(() => memoResponse?.memos || [], [memoResponse]);

  // Extract snippets from all memos
  const allSnippets = useMemo(() => {
    return extractSnippetsFromMemos(memos);
  }, [memos]);

  // Language count breakdown
  const languageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const snip of allSnippets) {
      const lang = snip.language || "text";
      counts.set(lang, (counts.get(lang) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [allSnippets]);

  // Filtered snippets based on search & language
  const filteredSnippets = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return allSnippets.filter((snip) => {
      // Language filter
      if (selectedLanguage && snip.language !== selectedLanguage) {
        return false;
      }

      // Search query filter
      if (q) {
        const inCode = snip.code.toLowerCase().includes(q);
        const inTitle = snip.snippetTitle.toLowerCase().includes(q);
        const inMemo = snip.memoTitle.toLowerCase().includes(q);
        const inLang = snip.language.toLowerCase().includes(q);
        if (!inCode && !inTitle && !inMemo && !inLang) return false;
      }

      return true;
    });
  }, [allSnippets, searchQuery, selectedLanguage]);

  const handleCopyCode = async (snippet: ExtractedSnippet) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(snippet.code);
        setCopiedId(snippet.id);
        setTimeout(() => setCopiedId(null), 2000);
      } else {
        copy(snippet.code);
        setCopiedId(snippet.id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch {
      copy(snippet.code);
      setCopiedId(snippet.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Top Header Bar */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Code2Icon className="size-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">Code Snippets Vault</h1>
              <p className="text-xs text-muted-foreground">
                {allSnippets.length} snippets extracted across {memos.length} memos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 max-w-xs w-full">
            <div className="relative w-full">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search code or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-muted/30"
              />
            </div>
            {(searchQuery || selectedLanguage) && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-8 text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedLanguage(null);
                }}
                title="Reset filters"
              >
                <RotateCcwIcon className="size-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Language Filter Chips */}
        {languageCounts.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
            <button
              type="button"
              onClick={() => setSelectedLanguage(null)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 cursor-pointer",
                selectedLanguage === null
                  ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span>All Languages</span>
              <span className="text-[10px] opacity-80">({allSnippets.length})</span>
            </button>

            {languageCounts.map(([lang, count]) => {
              const color = LANG_COLORS[lang.toLowerCase()] || "#64748b";
              const isSelected = selectedLanguage === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setSelectedLanguage(isSelected ? null : lang)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 cursor-pointer border border-transparent",
                    isSelected
                      ? "bg-primary/15 text-primary border-primary/40 font-semibold shadow-2xs"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="capitalize">{lang}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Snippets List Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 [scrollbar-width:thin]">
        {filteredSnippets.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <FileCode2Icon className="size-10 text-muted-foreground/40 mb-3" />
            <h3 className="text-sm font-semibold text-foreground">No Snippets Found</h3>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              {searchQuery || selectedLanguage
                ? "No code snippets match your current search and language filters."
                : "Create notes with triple backtick code blocks (```go ... ```) to automatically populate your code vault."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredSnippets.map((snippet) => {
              const langColor = LANG_COLORS[snippet.language.toLowerCase()] || "#64748b";
              const isCopied = copiedId === snippet.id;

              return (
                <div
                  key={snippet.id}
                  className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden flex flex-col transition-all hover:border-primary/40"
                >
                  {/* Snippet Header */}
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-border bg-muted/20">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: langColor }} />
                        <h4 className="text-xs font-bold text-foreground truncate">{snippet.snippetTitle}</h4>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground truncate">
                        <span className="font-mono text-[10px] uppercase font-semibold text-primary/80">{snippet.language}</span>
                        <span>•</span>
                        <span>
                          {snippet.lineCount} {snippet.lineCount === 1 ? "line" : "lines"}
                        </span>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setSelectedMemoName(snippet.memoName)}
                          className="hover:text-primary hover:underline truncate cursor-pointer text-left"
                        >
                          From: {snippet.memoTitle}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-7 px-2 text-xs gap-1.5",
                          isCopied ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground",
                        )}
                        onClick={() => handleCopyCode(snippet)}
                      >
                        {isCopied ? <CheckIcon className="size-3.5 text-primary" /> : <CopyIcon className="size-3.5" />}
                        <span>{isCopied ? "Copied" : "Copy"}</span>
                      </Button>
                    </div>
                  </div>

                  {/* Code Content View */}
                  <div className="flex-1 bg-muted/10 p-3 overflow-x-auto font-mono text-xs leading-relaxed max-h-72 [scrollbar-width:thin]">
                    <pre className="text-foreground/90 whitespace-pre">
                      <code>{snippet.code}</code>
                    </pre>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Memo Detail Popup Modal when clicking source memo */}
      <MemoDetailDialog
        memoName={selectedMemoName}
        open={!!selectedMemoName}
        onOpenChange={(open) => {
          if (!open) setSelectedMemoName(null);
        }}
      />
    </div>
  );
};

export default Snippets;
