import { describe, expect, it } from "vitest";
import {
  computeDeadlineProgress,
  getCardCategories,
  getCardMilestone,
  getCategoryColor,
  getMilestoneColor,
  parseCardContent,
} from "@/components/Boards/cardUtils";

describe("cardUtils", () => {
  describe("parseCardContent", () => {
    it("extracts title and description from markdown with heading", () => {
      const content = "# Fix authentication bug\nNeed to update JWT expiration and refresh token logic.";
      const { title, description } = parseCardContent(content);
      expect(title).toBe("Fix authentication bug");
      expect(description).toBe("Need to update JWT expiration and refresh token logic.");
    });

    it("extracts title and description from plain list markdown", () => {
      const content = "- Deploy to production\n- Check logs\n- Monitor metrics";
      const { title, description } = parseCardContent(content);
      expect(title).toBe("Deploy to production");
      expect(description).toBe("Check logs Monitor metrics");
    });

    it("handles single line content gracefully", () => {
      const content = "Single line card";
      const { title, description } = parseCardContent(content);
      expect(title).toBe("Single line card");
      expect(description).toBe("");
    });

    it("handles empty content", () => {
      const { title, description } = parseCardContent("");
      expect(title).toBe("Untitled");
      expect(description).toBe("");
    });
  });

  describe("computeDeadlineProgress", () => {
    it("returns null if no dueTimeSeconds provided", () => {
      expect(computeDeadlineProgress(100, undefined)).toBeNull();
    });

    it("calculates overdue deadline correctly", () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const pastDue = nowSeconds - 3600; // 1 hour ago
      const create = nowSeconds - 7200;

      const result = computeDeadlineProgress(create, pastDue);
      expect(result).not.toBeNull();
      expect(result?.isOverdue).toBe(true);
      expect(result?.progress).toBe(100);
      expect(result?.colorClass).toBe("bg-destructive");
    });

    it("calculates active deadline progress", () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const create = nowSeconds - 5000;
      const futureDue = nowSeconds + 5000; // midpoint (50% progress)

      const result = computeDeadlineProgress(create, futureDue);
      expect(result).not.toBeNull();
      expect(result?.isOverdue).toBe(false);
      expect(result?.progress).toBe(50);
      expect(result?.colorClass).toBe("bg-primary");
      // Formatted due date should not contain hours/minutes (no colon)
      expect(result?.formattedDue).not.toMatch(/\d+:\d+/);
    });
  });

  describe("getCardCategories & getCategoryColor", () => {
    it("extracts multiple categories without duplicates", () => {
      const kanban = {
        category: "Bug",
        categories: ["Bug", "Frontend", "Urgent"],
      };
      const cats = getCardCategories(kanban);
      expect(cats).toEqual(["Bug", "Frontend", "Urgent"]);
    });

    it("derives deterministic colors for category names", () => {
      const color1 = getCategoryColor("Backend");
      const color2 = getCategoryColor("Backend");
      expect(color1).toBe(color2);
      expect(color1.startsWith("#")).toBe(true);

      const override = getCategoryColor("Backend", "#ff0000");
      expect(override).toBe("#ff0000");
    });
  });

  describe("getCardMilestone & getMilestoneColor", () => {
    it("extracts milestone correctly", () => {
      expect(getCardMilestone({ milestone: "v1.0-release" })).toBe("v1.0-release");
      expect(getCardMilestone({ milestone: "  v2.0  " })).toBe("v2.0");
      expect(getCardMilestone({ milestone: "" })).toBeUndefined();
      expect(getCardMilestone(undefined)).toBeUndefined();
    });

    it("derives deterministic colors for milestone names", () => {
      const color1 = getMilestoneColor("v1.0-release");
      const color2 = getMilestoneColor("v1.0-release");
      expect(color1).toBe(color2);
      expect(color1.startsWith("#")).toBe(true);
    });
  });
});
