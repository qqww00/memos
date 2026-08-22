import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { boardServiceClient, memoServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { type Board, type BoardColumn, BoardSchema } from "@/types/proto/api/v1/board_service_pb";
import { type Kanban, KanbanSchema, ListMemosRequestSchema, type Memo, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

// Query keys factory
export const boardKeys = {
  all: ["boards"] as const,
  lists: () => [...boardKeys.all, "list"] as const,
  list: (parent: string) => [...boardKeys.lists(), parent] as const,
  cards: (boardId: string) => [...boardKeys.all, "cards", boardId] as const,
};

// boardIdFromName extracts the board id from a "users/{user}/boards/{board}" name.
export function boardIdFromName(name: string): string {
  const parts = name.split("/");
  return parts.length === 4 ? (parts[3] ?? "") : "";
}

// groupCardsByColumn groups memos by their kanban column, sorted by position then name.
export function groupCardsByColumn(memos: Memo[], columnIds: string[]): Map<string, Memo[]> {
  const grouped = new Map<string, Memo[]>(columnIds.map((id) => [id, []]));
  for (const memo of memos) {
    const columnId = memo.kanban?.columnId;
    if (columnId && grouped.has(columnId)) {
      grouped.get(columnId)?.push(memo);
    }
  }
  for (const columnCards of grouped.values()) {
    columnCards.sort((a, b) => {
      const positionA = a.kanban?.position ?? 0;
      const positionB = b.kanban?.position ?? 0;
      if (positionA !== positionB) return positionA - positionB;
      return a.name < b.name ? -1 : 1;
    });
  }
  return grouped;
}

// computeDropPosition returns the position a card should take when dropped at
// the given index of a column, using midpoint insertion and append semantics.
export function computeDropPosition(columnCards: Memo[], index: number): number {
  if (index >= columnCards.length) {
    return (columnCards.at(-1)?.kanban?.position ?? 0) + 1.0;
  }
  const nextPosition = columnCards[index]?.kanban?.position ?? 0;
  if (index <= 0) {
    return nextPosition - 1.0;
  }
  const prevPosition = columnCards[index - 1]?.kanban?.position ?? nextPosition - 1.0;
  return (prevPosition + nextPosition) / 2;
}

// isPositionRepresentable reports whether a computed insert position stays strictly
// between its neighbors; when false the caller should re-normalize the column.
export function isPositionRepresentable(columnCards: Memo[], index: number, position: number): boolean {
  if (index <= 0) return true;
  const prevPosition = columnCards[index - 1]?.kanban?.position;
  const nextPosition = columnCards[index]?.kanban?.position;
  if (prevPosition !== undefined && position <= prevPosition) return false;
  if (nextPosition !== undefined && position >= nextPosition) return false;
  return true;
}

// useBoards lists the current user's boards.
export function useBoards() {
  const currentUser = useCurrentUser();
  const parent = currentUser?.name;

  return useQuery({
    queryKey: boardKeys.list(parent ?? ""),
    queryFn: async () => {
      if (!parent) return [] as Board[];
      const { boards } = await boardServiceClient.listBoards({ parent });
      return boards;
    },
    enabled: !!parent,
  });
}

export function useCreateBoard() {
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();

  return useMutation({
    mutationFn: async ({ title, columns }: { title: string; columns?: BoardColumn[] }) => {
      if (!currentUser?.name) {
        throw new Error("No current user");
      }
      const board = await boardServiceClient.createBoard({
        parent: currentUser.name,
        board: create(BoardSchema, { title, columns }),
      });
      return board;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.lists() });
    },
  });
}

export function useUpdateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ board, updateMask }: { board: Partial<Board>; updateMask: string[] }) => {
      const updatedBoard = await boardServiceClient.updateBoard({
        board: create(BoardSchema, board as Record<string, unknown>),
        updateMask: create(FieldMaskSchema, { paths: updateMask }),
      });
      return updatedBoard;
    },
    onMutate: async ({ board }) => {
      await queryClient.cancelQueries({ queryKey: boardKeys.lists() });
      const previousBoards = queryClient.getQueryData<Board[]>(boardKeys.lists());
      if (previousBoards && board.name) {
        queryClient.setQueryData<Board[]>(
          boardKeys.lists(),
          previousBoards.map((b) => (b.name === board.name ? ({ ...b, ...board } as Board) : b)),
        );
      }
      return { previousBoards };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousBoards) {
        queryClient.setQueryData(boardKeys.lists(), context.previousBoards);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.lists() });
    },
  });
}

export function useDeleteBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      await boardServiceClient.deleteBoard({ name });
      return name;
    },
    onSuccess: (name) => {
      queryClient.invalidateQueries({ queryKey: boardKeys.lists() });
      queryClient.removeQueries({ queryKey: boardKeys.cards(boardIdFromName(name)) });
    },
  });
}

// useBoardCards lists all memos on a board, paging through every result.
export function useBoardCards(boardId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: boardKeys.cards(boardId),
    queryFn: async () => {
      const memos: Memo[] = [];
      let pageToken = "";
      const filter = `kanban_board == "${boardId}"`;
      do {
        const response = await memoServiceClient.listMemos(
          create(ListMemosRequestSchema, { filter, pageToken, pageSize: 200 } as Record<string, unknown>),
        );
        memos.push(...response.memos);
        pageToken = response.nextPageToken;
      } while (pageToken);
      return memos;
    },
    enabled: (options?.enabled ?? true) && !!boardId,
  });
}

// useUpdateMemoKanban moves a memo card on a board (or clears it when kanban is undefined).
// It optimistically patches board card queries and rolls back via refetch on error.
export function useUpdateMemoKanban() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, kanban }: { name: string; kanban?: Kanban }) => {
      const memo = await memoServiceClient.updateMemo({
        memo: create(MemoSchema, {
          name,
          kanban: kanban ?? create(KanbanSchema, {}),
        } as Record<string, unknown>),
        updateMask: create(FieldMaskSchema, { paths: ["kanban"] }),
      });
      return memo;
    },
    onMutate: async ({ name, kanban }) => {
      await queryClient.cancelQueries({ queryKey: boardKeys.all });

      const optimisticKanban = kanban ?? undefined;
      for (const [key, data] of queryClient.getQueriesData<Memo[]>({ queryKey: boardKeys.all })) {
        if (!Array.isArray(data)) continue;
        queryClient.setQueryData<Memo[]>(
          key,
          data.map((memo) => (memo.name === name ? { ...memo, kanban: optimisticKanban } : memo)),
        );
      }
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.all });
      queryClient.invalidateQueries({ queryKey: ["memos"] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.all });
      queryClient.invalidateQueries({ queryKey: ["memos"] });
    },
  });
}
