export interface MemoMentionMatch {
  from: number;
  to: number;
  memoName: string;
  memoId: string;
  title?: string;
  source: string;
}

const MEMO_ID_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,34}[a-zA-Z0-9])?$/;

/**
 * Validates whether a target string represents a memo identifier or memo resource name.
 */
export function isValidMemoTarget(target: string): boolean {
  if (target.startsWith("memos/")) {
    const id = target.slice("memos/".length);
    return MEMO_ID_REGEX.test(id);
  }
  return MEMO_ID_REGEX.test(target);
}

/**
 * Normalizes a target (either 'memos/uid' or 'uid') to a full memo resource name 'memos/uid'.
 */
export function normalizeMemoResourceName(target: string): string {
  return target.startsWith("memos/") ? target : `memos/${target}`;
}

/**
 * Finds all wiki-link style memo references [[memos/uid|title]], [[memos/uid]], or [[uid]] in a source string.
 */
export function findMemoMentionMatches(source: string): MemoMentionMatch[] {
  const matches: MemoMentionMatch[] = [];
  let cursor = 0;

  while (cursor < source.length - 3) {
    const openIndex = source.indexOf("[[", cursor);
    if (openIndex === -1) break;

    const closeIndex = source.indexOf("]]", openIndex + 2);
    if (closeIndex === -1) break;

    // Reject if contains another '[' before ']]' or contains newline
    const inner = source.slice(openIndex + 2, closeIndex);
    if (inner.includes("[") || inner.includes("\n") || inner.includes("\r")) {
      cursor = openIndex + 1;
      continue;
    }

    const trimmedInner = inner.trim();
    if (!trimmedInner) {
      cursor = closeIndex + 2;
      continue;
    }

    const pipeIndex = trimmedInner.indexOf("|");
    let target = "";
    let title: string | undefined;

    if (pipeIndex !== -1) {
      target = trimmedInner.slice(0, pipeIndex).trim();
      title = trimmedInner.slice(pipeIndex + 1).trim();
    } else {
      target = trimmedInner;
    }

    if (isValidMemoTarget(target)) {
      const memoName = normalizeMemoResourceName(target);
      const memoId = memoName.slice("memos/".length);
      const matchSource = source.slice(openIndex, closeIndex + 2);

      matches.push({
        from: openIndex,
        to: closeIndex + 2,
        memoName,
        memoId,
        title: title || undefined,
        source: matchSource,
      });
      cursor = closeIndex + 2;
    } else {
      cursor = openIndex + 1;
    }
  }

  return matches;
}

/**
 * Extracts a human-friendly display title from a memo or memo-like entity,
 * preferring property.title, or falling back to the first line with Markdown
 * syntax and wiki-links cleaned out.
 */
export function extractMemoDisplayTitle(memo?: {
  property?: { title?: string };
  snippet?: string;
  content?: string;
  name?: string;
}): string {
  if (!memo) return "";
  if (memo.property?.title?.trim()) {
    return memo.property.title.trim();
  }

  const rawText = memo.content || memo.snippet || "";
  const firstLine =
    rawText
      .split("\n")
      .find((l) => l.trim().length > 0)
      ?.trim() || "";

  if (!firstLine) {
    return memo.name || "";
  }

  // 1. If first line starts with markdown heading (# My Title)
  const headingMatch = firstLine.match(/^#+\s+(.+)$/);
  let text = headingMatch ? headingMatch[1] : firstLine;

  // 2. Clean standard markdown links: [Title](url) -> Title
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // 3. Clean closed wiki-links: [[memos/uid|Title]] -> Title, [[memos/uid]] -> Title / uid
  text = text.replace(/\[\[([^\]]+)\]\]/g, (_, inner: string) => {
    const pipe = inner.indexOf("|");
    if (pipe !== -1) {
      return inner.slice(pipe + 1).trim();
    }
    const target = inner.trim();
    return target.startsWith("memos/") ? target.slice("memos/".length) : target;
  });

  // 4. Clean unclosed/truncated wiki-links from snippet: [[memos/uid|Title... -> Title... or [[memos/uid... -> uid...
  text = text.replace(/\[\[([^|\n]+)\|/g, ""); // Remove [[memos/xyz|
  text = text.replace(/^\[\[memos\//g, ""); // Remove leading [[memos/
  text = text.replace(/^\[\[/g, ""); // Remove leading [[
  text = text.replace(/\]\]/g, ""); // Remove trailing ]]
  text = text.replace(/\]/g, ""); // Remove stray ]

  // 5. Clean task checkboxes and list bullets: - [ ] or * or -
  text = text.replace(/^[-*+]\s+(\[[ xX]\]\s+)?/, "");
  text = text.replace(/^\d+\.\s+/, "");

  // 6. Clean markdown formatting: bold, italic, code, tags
  text = text.replace(/[*_`~]/g, "");

  const cleaned = text.trim();
  if (cleaned) {
    return cleaned.length > 60 ? `${cleaned.slice(0, 60)}...` : cleaned;
  }

  return memo.name || "";
}
