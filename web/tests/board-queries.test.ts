import { describe, expect, it } from "vitest";
import { boardIdFromName, computeDropPosition, groupCardsByColumn, isPositionRepresentable } from "@/hooks/useBoardQueries";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

describe("useBoardQueries helpers", () => {
  describe("boardIdFromName", () => {
    it("extracts the board ID correctly", () => {
      expect(boardIdFromName("users/1/boards/100")).toBe("100");
      expect(boardIdFromName("users/admin/boards/my-board")).toBe("my-board");
      expect(boardIdFromName("invalid")).toBe("");
    });
  });

  describe("groupCardsByColumn", () => {
    it("groups memos by column and sorts by position ascending", () => {
      const columnIds = ["col-1", "col-2"];
      const memos: Memo[] = [
        {
          name: "memos/3",
          kanban: { boardId: "b1", columnId: "col-1", position: 3.0 },
        } as unknown as Memo,
        {
          name: "memos/1",
          kanban: { boardId: "b1", columnId: "col-1", position: 1.0 },
        } as unknown as Memo,
        {
          name: "memos/2",
          kanban: { boardId: "b1", columnId: "col-1", position: 2.0 },
        } as unknown as Memo,
        {
          name: "memos/4",
          kanban: { boardId: "b1", columnId: "col-2", position: 10.0 },
        } as unknown as Memo,
      ];

      const grouped = groupCardsByColumn(memos, columnIds);
      const col1Cards = grouped.get("col-1") || [];
      expect(col1Cards.map((c) => c.name)).toEqual(["memos/1", "memos/2", "memos/3"]);

      const col2Cards = grouped.get("col-2") || [];
      expect(col2Cards.map((c) => c.name)).toEqual(["memos/4"]);
    });
  });

  describe("computeDropPosition", () => {
    const cards: Memo[] = [
      { name: "memos/1", kanban: { position: 1.0 } } as unknown as Memo,
      { name: "memos/2", kanban: { position: 2.0 } } as unknown as Memo,
      { name: "memos/3", kanban: { position: 4.0 } } as unknown as Memo,
    ];

    it("appends to an empty column with 1.0", () => {
      expect(computeDropPosition([], 0)).toBe(1.0);
    });

    it("appends after the last item", () => {
      expect(computeDropPosition(cards, 3)).toBe(5.0);
    });

    it("inserts before the first item", () => {
      expect(computeDropPosition(cards, 0)).toBe(0.0);
    });

    it("inserts between two items", () => {
      expect(computeDropPosition(cards, 2)).toBe(3.0); // midpoint of 2.0 and 4.0
    });
  });

  describe("isPositionRepresentable", () => {
    const cards: Memo[] = [
      { name: "memos/1", kanban: { position: 1.0 } } as unknown as Memo,
      { name: "memos/2", kanban: { position: 2.0 } } as unknown as Memo,
    ];

    it("returns true for valid distinct midpoint", () => {
      expect(isPositionRepresentable(cards, 1, 1.5)).toBe(true);
    });

    it("returns false if position is not strictly between neighbors", () => {
      expect(isPositionRepresentable(cards, 1, 1.0)).toBe(false);
      expect(isPositionRepresentable(cards, 1, 2.0)).toBe(false);
    });
  });
});
