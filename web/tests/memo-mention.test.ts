import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { memoMentionMatchBefore } from "@/components/MemoEditor/Editor/markdownTagRanges";
import {
  extractMemoDisplayTitle,
  findMemoMentionMatches,
  isValidMemoTarget,
  normalizeMemoResourceName,
} from "@/utils/memo-mention-grammar";
import { extractMemoMentions } from "@/utils/remark-plugins/remark-tag";

describe("memo-mention-grammar", () => {
  it("validates memo targets", () => {
    expect(isValidMemoTarget("abc-123")).toBe(true);
    expect(isValidMemoTarget("memos/abc-123")).toBe(true);
    expect(isValidMemoTarget("123")).toBe(true);
    expect(isValidMemoTarget("")).toBe(false);
    expect(isValidMemoTarget("memos/")).toBe(false);
    expect(isValidMemoTarget("invalid/prefix/123")).toBe(false);
  });

  it("normalizes memo resource names", () => {
    expect(normalizeMemoResourceName("abc-123")).toBe("memos/abc-123");
    expect(normalizeMemoResourceName("memos/abc-123")).toBe("memos/abc-123");
  });

  it("finds wiki-link memo matches with and without titles", () => {
    const text = "See [[memos/abc123|Sprint Plan]] and [[xyz789]] also [[memos/def456]].";
    const matches = findMemoMentionMatches(text);

    expect(matches).toHaveLength(3);
    expect(matches[0]).toEqual({
      from: 4,
      to: 32,
      memoName: "memos/abc123",
      memoId: "abc123",
      title: "Sprint Plan",
      source: "[[memos/abc123|Sprint Plan]]",
    });
    expect(matches[1]).toEqual({
      from: 37,
      to: 47,
      memoName: "memos/xyz789",
      memoId: "xyz789",
      title: undefined,
      source: "[[xyz789]]",
    });
    expect(matches[2]).toEqual({
      from: 53,
      to: 69,
      memoName: "memos/def456",
      memoId: "def456",
      title: undefined,
      source: "[[memos/def456]]",
    });
  });

  it("ignores invalid syntax shapes", () => {
    expect(findMemoMentionMatches("[[]]")).toEqual([]);
    expect(findMemoMentionMatches("[[ ]]")).toEqual([]);
    expect(findMemoMentionMatches("[[memos/invalid*id]]")).toEqual([]);
    expect(findMemoMentionMatches("[[nested [[brackets]] ]]")).toEqual([
      {
        from: 9,
        to: 21,
        memoName: "memos/brackets",
        memoId: "brackets",
        title: undefined,
        source: "[[brackets]]",
      },
    ]);
  });

  it("extracts clean display titles", () => {
    expect(extractMemoDisplayTitle({ property: { title: "Roadmap 2026" } })).toBe("Roadmap 2026");
    expect(extractMemoDisplayTitle({ snippet: "# Heading 1 Title\nSome description" })).toBe("Heading 1 Title");
    expect(extractMemoDisplayTitle({ snippet: "[[memos/other|Referenced Project]] status update" })).toBe(
      "Referenced Project status update",
    );
    expect(extractMemoDisplayTitle({ snippet: "[[memos/asdmsamda|Judul Target" })).toBe("Judul Target");
    expect(extractMemoDisplayTitle({ snippet: "[[memos/asdmsamda" })).toBe("asdmsamda");
    expect(extractMemoDisplayTitle({ snippet: "[[memos/target-uid]]" })).toBe("target-uid");
    expect(extractMemoDisplayTitle({ name: "memos/xyz123" })).toBe("memos/xyz123");
  });
});

describe("extractMemoMentions in Markdown", () => {
  it("extracts memo mentions from rich markdown", () => {
    const content = `
# Meeting Notes

Please refer to [[memos/memo1|Roadmap]] and [[memo2]].

\`\`\`
[[memo-in-code]]
\`\`\`

Inline \`[[memo-in-inline-code]]\` should be ignored.
`;
    const mentions = extractMemoMentions(content);
    expect(mentions).toEqual([
      { memoName: "memos/memo1", memoId: "memo1", title: "Roadmap" },
      { memoName: "memos/memo2", memoId: "memo2", title: undefined },
    ]);
  });
});

describe("memoMentionMatchBefore", () => {
  it("detects opening brackets before cursor", () => {
    const state = EditorState.create({ doc: "Hello [[sprint" });
    const match = memoMentionMatchBefore(state, 14);
    expect(match).toEqual({ from: 6, query: "sprint" });

    const closedState = EditorState.create({ doc: "Hello [[sprint]] test" });
    expect(memoMentionMatchBefore(closedState, 21)).toBeUndefined();
  });
});
