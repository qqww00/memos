import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import BoardsSidebarContent from "@/components/AppSidebar/BoardsSidebarContent";
import { AppSidebarProvider } from "@/contexts/AppSidebarContext";

vi.mock("@/utils/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/i18n")>();
  return {
    ...actual,
    useTranslate: () => (key: string) => key,
  };
});

vi.mock("@/hooks/useBoardQueries", () => ({
  boardIdFromName: (name: string) => {
    const parts = name.split("/");
    return parts.length === 4 ? (parts[3] ?? "") : "";
  },
  useBoards: () => ({
    data: [
      {
        name: "users/1/boards/sprint-1",
        title: "Sprint 1",
        columns: [
          { id: "col-1", title: "To Do", colorHex: "#64748b" },
          { id: "col-2", title: "In Progress", colorHex: "#f59e0b" },
          { id: "col-3", title: "Done", colorHex: "#10b981" },
        ],
      },
    ],
    isLoading: false,
  }),
  useBoardCards: (boardId: string) => ({
    data:
      boardId === "sprint-1"
        ? [
            {
              name: "memos/1",
              kanban: {
                boardId: "sprint-1",
                columnId: "col-1",
                isClosed: false,
                category: "frontend",
                milestone: "v1.0",
              },
            },
            {
              name: "memos/2",
              kanban: {
                boardId: "sprint-1",
                columnId: "col-3",
                isClosed: true,
                category: "backend",
                milestone: "v1.0",
              },
            },
          ]
        : [],
    isLoading: false,
  }),
  useAllBoardCards: () => ({
    data: [
      {
        name: "memos/1",
        kanban: {
          boardId: "sprint-1",
          columnId: "col-1",
          isClosed: false,
          category: "frontend",
          milestone: "v1.0",
        },
      },
      {
        name: "memos/2",
        kanban: {
          boardId: "sprint-1",
          columnId: "col-3",
          isClosed: true,
          category: "backend",
          milestone: "v1.0",
        },
      },
    ],
    isLoading: false,
  }),
  useCreateBoard: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateBoard: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteBoard: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("BoardsSidebarContent", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  it("renders global workspace progress, attention, and milestones at /boards", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/boards"]}>
          <AppSidebarProvider>
            <Routes>
              <Route path="/boards" element={<BoardsSidebarContent />} />
            </Routes>
          </AppSidebarProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Sprint 1")).toBeInTheDocument();
    expect(screen.getByText("Workspace Progress")).toBeInTheDocument();
    expect(screen.getByText("50% Completed")).toBeInTheDocument();
    expect(screen.getByText("1/2 Tasks")).toBeInTheDocument();
    expect(screen.getByText("Global Attention")).toBeInTheDocument();
    expect(screen.getByText("Active Milestones")).toBeInTheDocument();
    expect(screen.getByText("v1.0")).toBeInTheDocument();
  });

  it("renders active board progress, columns, and categories at /boards/:boardId", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/boards/sprint-1"]}>
          <AppSidebarProvider>
            <Routes>
              <Route path="/boards/:boardId" element={<BoardsSidebarContent />} />
            </Routes>
          </AppSidebarProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Sprint 1")).toBeInTheDocument();
    expect(screen.getByText("50% Completed")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("To Do")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("frontend")).toBeInTheDocument();
    expect(screen.getByText("backend")).toBeInTheDocument();
  });
});
