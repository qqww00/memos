import { describe, expect, it } from "vitest";
import { parseTaskLists, toggleTaskListItem } from "@/components/Boards/cardUtils";
import { ENGINEERING_TEMPLATES } from "@/components/Boards/engineeringTemplates";
import { getIDELink, parseSourceFilePath } from "@/utils/ideLink";

describe("Engineer Productivity Toolkit - Card Checklist Parser", () => {
  it("parses empty content or content without checklists", () => {
    expect(parseTaskLists("")).toEqual({ items: [], total: 0, completed: 0, percent: 0 });
    expect(parseTaskLists("Just a plain note\nNo checklists here")).toEqual({
      items: [],
      total: 0,
      completed: 0,
      percent: 0,
    });
  });

  it("parses multiple task list items and computes completion percent", () => {
    const markdown = `# Sprint Tasks
- [x] Task 1: Setup database schema
- [ ] Task 2: Implement API handler
- [X] Task 3: Write tests
- [ ] Task 4: Deploy to staging`;

    const summary = parseTaskLists(markdown);
    expect(summary.total).toBe(4);
    expect(summary.completed).toBe(2);
    expect(summary.percent).toBe(50);
    expect(summary.items).toHaveLength(4);
    expect(summary.items[0]).toMatchObject({ index: 0, checked: true, text: "Task 1: Setup database schema" });
    expect(summary.items[1]).toMatchObject({ index: 1, checked: false, text: "Task 2: Implement API handler" });
    expect(summary.items[2]).toMatchObject({ index: 2, checked: true, text: "Task 3: Write tests" });
    expect(summary.items[3]).toMatchObject({ index: 3, checked: false, text: "Task 4: Deploy to staging" });
  });

  it("toggles specific checklist items correctly", () => {
    const original = `- [ ] Task A\n- [x] Task B\n- [ ] Task C`;

    // Toggle Task A from [ ] to [x]
    const updated1 = toggleTaskListItem(original, 0, true);
    expect(updated1).toBe(`- [x] Task A\n- [x] Task B\n- [ ] Task C`);

    // Toggle Task B from [x] to [ ]
    const updated2 = toggleTaskListItem(original, 1, false);
    expect(updated2).toBe(`- [ ] Task A\n- [ ] Task B\n- [ ] Task C`);
  });
});

describe("Engineer Productivity Toolkit - Templates Library", () => {
  it("provides all essential engineering templates", () => {
    const templateIds = ENGINEERING_TEMPLATES.map((t) => t.id);
    expect(templateIds).toContain("adr");
    expect(templateIds).toContain("rfc");
    expect(templateIds).toContain("spike");
    expect(templateIds).toContain("incident");
    expect(templateIds).toContain("review");
  });

  it("contains markdown scaffolds for ADR and Postmortem", () => {
    const adr = ENGINEERING_TEMPLATES.find((t) => t.id === "adr");
    expect(adr?.templateContent).toContain("# ADR:");
    expect(adr?.templateContent).toContain("## Status");
    expect(adr?.templateContent).toContain("## Context");
    expect(adr?.templateContent).toContain("## Decision");

    const incident = ENGINEERING_TEMPLATES.find((t) => t.id === "incident");
    expect(incident?.templateContent).toContain("# Incident Postmortem:");
    expect(incident?.templateContent).toContain("## Timeline");
    expect(incident?.templateContent).toContain("## Root Cause");
  });
});

describe("Engineer Productivity Toolkit - IDE Deep Linking", () => {
  it("recognizes valid source code file paths", () => {
    const parsed1 = parseSourceFilePath("server/server.go:42");
    expect(parsed1).not.toBeNull();
    expect(parsed1?.filePath).toBe("server/server.go");
    expect(parsed1?.line).toBe(42);

    const parsed2 = parseSourceFilePath("web/src/components/Boards/KanbanCard.tsx:120:5");
    expect(parsed2).not.toBeNull();
    expect(parsed2?.filePath).toBe("web/src/components/Boards/KanbanCard.tsx");
    expect(parsed2?.line).toBe(120);
    expect(parsed2?.column).toBe(5);

    const parsed3 = parseSourceFilePath("proto/api/v1/board_service.proto");
    expect(parsed3).not.toBeNull();
    expect(parsed3?.filePath).toBe("proto/api/v1/board_service.proto");
    expect(parsed3?.line).toBeUndefined();
  });

  it("ignores non-file path strings", () => {
    expect(parseSourceFilePath("hello world")).toBeNull();
    expect(parseSourceFilePath("http://localhost:8080")).toBeNull();
    expect(parseSourceFilePath("just a random phrase with words")).toBeNull();
  });

  it("generates correct IDE protocol URLs", () => {
    const vsUrl = getIDELink("server/server.go", 42, undefined, "vscode");
    expect(vsUrl).toBe("vscode://file/server/server.go:42");

    const cursorUrl = getIDELink("web/src/App.tsx", 10, 2, "cursor");
    expect(cursorUrl).toBe("cursor://file/web/src/App.tsx:10:2");
  });
});
