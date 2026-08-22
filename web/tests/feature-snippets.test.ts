import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { getCardMilestone, getMilestoneColor } from "@/components/Boards/cardUtils";
import { KanbanSchema, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";
import { extractSnippetsFromMemos } from "@/utils/snippetUtils";

describe("Milestones Property & Palette", () => {
  it("extracts explicit milestone property from kanban payload", () => {
    const kanban1 = create(KanbanSchema, {
      boardId: "board-1",
      columnId: "col-1",
      milestone: "v1.0 Launch",
    });
    expect(getCardMilestone(kanban1)).toBe("v1.0 Launch");

    const kanban2 = create(KanbanSchema, {
      boardId: "board-1",
      columnId: "col-1",
      milestone: "  Sprint 24  ",
    });
    expect(getCardMilestone(kanban2)).toBe("Sprint 24");
  });

  it("handles undefined or empty milestone gracefully", () => {
    expect(getCardMilestone(undefined)).toBeUndefined();
    const emptyKanban = create(KanbanSchema, {
      boardId: "board-1",
      columnId: "col-1",
    });
    expect(getCardMilestone(emptyKanban)).toBeUndefined();
  });

  it("derives deterministic milestone colors", () => {
    const color1 = getMilestoneColor("v1.0 Launch");
    const color2 = getMilestoneColor("v1.0 Launch");
    const color3 = getMilestoneColor("Sprint 24");
    expect(color1).toBe(color2);
    expect(typeof color1).toBe("string");
    expect(color1.startsWith("#")).toBe(true);
    expect(typeof color3).toBe("string");
  });
});

describe("Code Snippets Vault - Snippet Extraction", () => {
  it("extracts fenced code blocks from memos", () => {
    const memo1 = create(MemoSchema, {
      name: "memos/memo-1",
      content: `### Database Index\n\`\`\`sql\nCREATE INDEX idx_user ON users(email);\nSELECT * FROM users;\n\`\`\``,
    });

    const memo2 = create(MemoSchema, {
      name: "memos/memo-2",
      content: `### Golang Helper\n\`\`\`go\nfunc HealthCheck() string {\n  return "OK"\n}\n\`\`\``,
    });

    const memo3 = create(MemoSchema, {
      name: "memos/memo-3",
      content: `Just plain markdown without any code blocks.`,
    });

    const snippets = extractSnippetsFromMemos([memo1, memo2, memo3]);
    expect(snippets).toHaveLength(2);

    expect(snippets[0].memoUid).toBe("memo-1");
    expect(snippets[0].language).toBe("sql");
    expect(snippets[0].lineCount).toBe(2);
    expect(snippets[0].snippetTitle).toBe("Database Index");
    expect(snippets[0].code).toContain("CREATE INDEX idx_user");

    expect(snippets[1].memoUid).toBe("memo-2");
    expect(snippets[1].language).toBe("go");
    expect(snippets[1].lineCount).toBe(3);
    expect(snippets[1].snippetTitle).toBe("Golang Helper");
  });

  it("extracts comment headers when no preceding markdown heading exists", () => {
    const memo = create(MemoSchema, {
      name: "memos/snippet-note",
      content: `\`\`\`bash\n# Deploy script to staging cluster\nkubectl apply -f deployment.yaml\n\`\`\``,
    });

    const snippets = extractSnippetsFromMemos([memo]);
    expect(snippets).toHaveLength(1);
    expect(snippets[0].language).toBe("bash");
    expect(snippets[0].snippetTitle).toBe("Deploy script to staging cluster");
  });
});
