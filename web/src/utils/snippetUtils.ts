import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

export interface ExtractedSnippet {
  id: string;
  memoName: string;
  memoUid: string;
  memoTitle: string;
  language: string;
  code: string;
  lineCount: number;
  snippetTitle: string;
  createTimeSec: number;
}

const CODE_BLOCK_REGEX = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g;

/**
 * Extracts all fenced code blocks from an array of memos.
 */
export function extractSnippetsFromMemos(memos: Memo[]): ExtractedSnippet[] {
  const snippets: ExtractedSnippet[] = [];

  for (const memo of memos) {
    if (!memo.content) continue;
    const content = memo.content;
    const memoName = memo.name || "";
    const memoUid = memoName.replace(/^memos\//, "");
    const createTimeSec = memo.createTime ? Number(memo.createTime.seconds) : 0;

    // Get memo title from first non-empty line
    const firstLine = content.split("\n").find((l) => l.trim()) || "Untitled Note";
    const memoTitle = firstLine.replace(/^#{1,6}\s+/, "").trim() || "Untitled Note";

    let matchIdx = 0;
    for (const match of content.matchAll(CODE_BLOCK_REGEX)) {
      const rawLang = match[1]?.trim().toLowerCase() || "text";
      const code = match[2] ? match[2].trim() : "";
      if (!code) continue;

      const lines = code.split("\n");
      const lineCount = lines.length;

      // Extract a contextual title: either preceding header or first line if comment
      let snippetTitle = "";
      const matchIndex = match.index ?? 0;
      const precedingText = content.slice(0, matchIndex).trim();
      const precedingLines = precedingText.split("\n").filter(Boolean);
      if (precedingLines.length > 0) {
        const lastPreceding = precedingLines[precedingLines.length - 1];
        if (lastPreceding.startsWith("#") || lastPreceding.endsWith(":")) {
          snippetTitle = lastPreceding
            .replace(/^#{1,6}\s+/, "")
            .replace(/:$/, "")
            .trim();
        }
      }

      if (!snippetTitle) {
        // Check if first line of code is a comment
        const firstCodeLine = lines[0]?.trim();
        if (firstCodeLine && (firstCodeLine.startsWith("//") || firstCodeLine.startsWith("#") || firstCodeLine.startsWith("--"))) {
          snippetTitle = firstCodeLine.replace(/^(\/\/|#|--)\s*/, "").trim();
        }
      }

      if (!snippetTitle) {
        snippetTitle = memoTitle;
      }

      snippets.push({
        id: `${memoUid}-${matchIdx}`,
        memoName,
        memoUid,
        memoTitle,
        language: rawLang,
        code,
        lineCount,
        snippetTitle,
        createTimeSec,
      });

      matchIdx++;
    }
  }

  // Sort newest first
  return snippets.sort((a, b) => b.createTimeSec - a.createTimeSec);
}
