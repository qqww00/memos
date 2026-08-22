import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import type { EditorView } from "@codemirror/view";
import { memoServiceClient } from "@/connect";
import { memoMentionMatchBefore } from "./markdownTagRanges";

/**
 * Autocomplete source for [[ wiki-link memo references.
 */
export function makeMemoMentionCompletionSource() {
  return async (ctx: CompletionContext): Promise<CompletionResult | null> => {
    const match = memoMentionMatchBefore(ctx.state, ctx.pos);
    if (!match) return null;

    const query = match.query.trim();
    try {
      const conditions: string[] = [];
      if (query) {
        conditions.push(`content.contains(${JSON.stringify(query)})`);
      }
      const response = await memoServiceClient.listMemos({
        pageSize: 15,
        filter: conditions.join(" && "),
      });

      const options = response.memos.map((memo) => {
        const title = memo.property?.title || memo.snippet.split("\n")[0].slice(0, 50) || memo.name;
        const insertText = title && title !== memo.name ? `[[${memo.name}|${title}]]` : `[[${memo.name}]]`;
        return {
          label: `📝 ${title}`,
          detail: memo.snippet ? memo.snippet.slice(0, 60) : undefined,
          type: "text",
          apply: (view: EditorView) => {
            view.dispatch({
              changes: { from: match.from, to: ctx.pos, insert: insertText },
              selection: { anchor: match.from + insertText.length },
            });
          },
        };
      });

      if (options.length === 0) return null;

      return {
        from: match.from,
        options,
        filter: false,
      };
    } catch {
      return null;
    }
  };
}
