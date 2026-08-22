import { CheckCircle2Icon, CircleIcon, ExternalLinkIcon, RocketIcon, TargetIcon } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Board, BoardColumn } from "@/types/proto/api/v1/board_service_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { getCardCategories, getCardMilestone, getCategoryColor, getMilestoneColor, parseCardContent } from "./cardUtils";

interface MilestonesRoadmapViewProps {
  board: Board;
  cards: Memo[];
  onSelectCard?: (memo: Memo) => void;
  onFilterMilestone: (milestoneName: string) => void;
}

interface MilestoneTrack {
  name: string;
  color: string;
  cards: Memo[];
  total: number;
  completed: number;
  inProgress: number;
  percent: number;
  targetDueSec?: number;
}

export const MilestonesRoadmapView = ({ board, cards, onSelectCard, onFilterMilestone }: MilestonesRoadmapViewProps) => {
  const columnMap = useMemo(() => {
    const map = new Map<string, BoardColumn>();
    for (const col of board.columns) {
      map.set(col.id, col);
    }
    return map;
  }, [board.columns]);

  const milestoneTracks = useMemo<MilestoneTrack[]>(() => {
    const tracksMap = new Map<string, Memo[]>();

    for (const memo of cards) {
      const milestone = getCardMilestone(memo.kanban);
      if (!milestone) {
        const list = tracksMap.get("General / Unassigned") || [];
        list.push(memo);
        tracksMap.set("General / Unassigned", list);
      } else {
        const list = tracksMap.get(milestone) || [];
        list.push(memo);
        tracksMap.set(milestone, list);
      }
    }

    const result: MilestoneTrack[] = [];
    for (const [name, milestoneCards] of tracksMap.entries()) {
      const total = milestoneCards.length;
      const completed = milestoneCards.filter((c) => c.kanban?.isClosed).length;
      const inProgress = total - completed;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

      // Find earliest or latest due date as target
      const dueTimes = milestoneCards
        .map((c) => (c.kanban?.dueTime ? Number(c.kanban.dueTime.seconds) : 0))
        .filter((sec) => sec > 0)
        .sort((a, b) => b - a);

      result.push({
        name,
        color: name === "General / Unassigned" ? "#64748b" : getMilestoneColor(name),
        cards: milestoneCards,
        total,
        completed,
        inProgress,
        percent,
        targetDueSec: dueTimes[0],
      });
    }

    // Sort milestones: active first, General last
    return result.sort((a, b) => {
      if (a.name === "General / Unassigned") return 1;
      if (b.name === "General / Unassigned") return -1;
      return b.total - a.total;
    });
  }, [cards]);

  if (milestoneTracks.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
        <TargetIcon className="size-10 text-muted-foreground/50 mb-3" />
        <h3 className="text-base font-semibold text-foreground">No Milestones Yet</h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Assign a milestone to your cards (e.g. <code className="rounded bg-muted px-1.5 py-0.5 text-foreground font-mono">v1.0</code>,{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-foreground font-mono">Sprint 24</code>) to automatically track milestone
          progress.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 [scrollbar-width:thin]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <RocketIcon className="size-4 text-primary" />
            <span>Milestones Roadmap</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {milestoneTracks.filter((t) => t.name !== "General / Unassigned").length} active milestones across {cards.length} cards
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {milestoneTracks.map((track) => {
          const isGeneral = track.name === "General / Unassigned";
          return (
            <div
              key={track.name}
              className={cn(
                "rounded-xl border border-border/80 bg-card p-4 shadow-2xs space-y-3.5 transition-all hover:border-primary/40",
                isGeneral && "border-dashed opacity-90",
              )}
            >
              {/* Header: Title, Badge, & View on Kanban */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: track.color }} />
                    <h3 className="text-sm font-bold text-foreground truncate">{track.name}</h3>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium text-muted-foreground">
                      {track.total} {track.total === 1 ? "task" : "tasks"}
                    </Badge>
                  </div>
                  {track.targetDueSec && (
                    <p className="text-[11px] text-muted-foreground">
                      Target deadline: {new Date(track.targetDueSec * 1000).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {!isGeneral && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 shrink-0"
                    onClick={() => onFilterMilestone(track.name)}
                    title={`View ${track.name} on Kanban board`}
                  >
                    <ExternalLinkIcon className="size-3" />
                    <span>View Kanban</span>
                  </Button>
                )}
              </div>

              {/* Progress Bar & Counters */}
              <div className="space-y-1.5 bg-muted/30 rounded-lg p-2.5 border border-border/50">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-muted-foreground">
                    Progress: <strong className="text-foreground">{track.completed}</strong> of {track.total} Done
                  </span>
                  <span className={cn("font-bold text-xs", track.percent === 100 ? "text-emerald-500" : "text-primary")}>
                    {track.percent}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted/80">
                  <div
                    className={cn(
                      "h-full transition-all duration-300 rounded-full",
                      track.percent === 100 ? "bg-emerald-500" : "bg-primary",
                    )}
                    style={{ width: `${track.percent}%` }}
                  />
                </div>
              </div>

              {/* Connected Cards List */}
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 [scrollbar-width:thin]">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Connected Tasks</span>
                {track.cards.map((memo) => {
                  const { title } = parseCardContent(memo.content);
                  const isClosed = Boolean(memo.kanban?.isClosed);
                  const column = memo.kanban?.columnId ? columnMap.get(memo.kanban.columnId) : null;
                  const categories = getCardCategories(memo.kanban);

                  return (
                    <div
                      key={memo.name}
                      onClick={() => onSelectCard?.(memo)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-md p-2 text-xs border border-border/40 bg-background/60 hover:bg-accent/40 cursor-pointer transition-colors",
                        isClosed && "opacity-60",
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isClosed ? (
                          <CheckCircle2Icon className="size-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <CircleIcon className="size-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className={cn("truncate font-medium text-foreground", isClosed && "line-through text-muted-foreground")}>
                          {title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {categories.slice(0, 1).map((cat) => {
                          const color = getCategoryColor(cat);
                          return (
                            <span
                              key={cat}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={{
                                backgroundColor: `${color}20`,
                                color,
                              }}
                            >
                              {cat}
                            </span>
                          );
                        })}
                        {column && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{
                              backgroundColor: `${column.colorHex || "#64748b"}20`,
                              color: column.colorHex || "#64748b",
                            }}
                          >
                            {column.title}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MilestonesRoadmapView;
