import { ArrowRightIcon, CalendarIcon, CheckCircle2Icon, HistoryIcon, LayersIcon, TagIcon, TargetIcon } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";
import type { Activity } from "@/types/proto/api/v1/memo_service_pb";
import { getCategoryColor, getMilestoneColor } from "./cardUtils";

interface MemoActivityHistoryProps {
  activities: Activity[];
  className?: string;
}

export const MemoActivityHistory: React.FC<MemoActivityHistoryProps> = ({ activities, className }) => {
  if (!activities || activities.length === 0) {
    return null;
  }

  // Render reverse chronological order (newest on top)
  const reversedActivities = [...activities].reverse();

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "UPDATE_CATEGORY":
        return <TagIcon className="size-3.5 text-blue-500" />;
      case "UPDATE_MILESTONE":
        return <TargetIcon className="size-3.5 text-purple-500" />;
      case "MOVE_COLUMN":
        return <LayersIcon className="size-3.5 text-amber-500" />;
      case "UPDATE_STATUS":
        return <CheckCircle2Icon className="size-3.5 text-emerald-500" />;
      case "UPDATE_DUE_TIME":
        return <CalendarIcon className="size-3.5 text-rose-500" />;
      default:
        return <HistoryIcon className="size-3.5 text-muted-foreground" />;
    }
  };

  const formatActivityTime = (createTime?: { seconds: bigint; nanos: number }) => {
    if (!createTime) return "";
    const seconds = Number(createTime.seconds);
    const date = new Date(seconds * 1000);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`;

    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const formatUserName = (creatorName?: string) => {
    if (!creatorName) return "System";
    return creatorName.replace(/^users\//, "");
  };

  return (
    <div className={cn("mt-6 pt-5 border-t border-border/70 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <HistoryIcon className="size-3.5" />
          <span>Activity History</span>
        </div>
        <span className="text-[11px] text-muted-foreground font-mono">
          {activities.length} {activities.length === 1 ? "update" : "updates"}
        </span>
      </div>

      <div className="relative pl-5 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
        {reversedActivities.map((act, index) => {
          const formattedTime = formatActivityTime(act.createTime);
          const author = formatUserName(act.creator);

          return (
            <div key={act.name || index} className="relative group">
              {/* Timeline indicator node */}
              <div className="absolute -left-5 top-1 flex size-4 items-center justify-center rounded-full bg-card border border-border shadow-2xs group-hover:border-primary/60 transition-colors">
                {getActivityIcon(act.type)}
              </div>

              <div className="bg-card/60 hover:bg-card border border-border/60 hover:border-border rounded-lg p-2.5 space-y-1 transition-all shadow-2xs">
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="font-medium text-foreground text-[12px]">{act.description}</span>
                  <span
                    className="text-[10px] text-muted-foreground shrink-0 font-mono"
                    title={act.createTime ? new Date(Number(act.createTime.seconds) * 1000).toLocaleString() : undefined}
                  >
                    {formattedTime}
                  </span>
                </div>

                {/* Optional old -> new badge diff display for categories / milestones */}
                {(act.oldValue || act.newValue) && (
                  <div className="flex items-center gap-1.5 pt-0.5 text-[11px]">
                    {act.oldValue && (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded line-through opacity-70 bg-muted text-muted-foreground text-[10px]">
                        {act.oldValue}
                      </span>
                    )}
                    {act.oldValue && act.newValue && <ArrowRightIcon className="size-2.5 text-muted-foreground" />}
                    {act.newValue && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.2 rounded font-medium text-[10px]"
                        style={{
                          backgroundColor:
                            act.type === "UPDATE_CATEGORY"
                              ? `${getCategoryColor(act.newValue)}20`
                              : act.type === "UPDATE_MILESTONE"
                                ? `${getMilestoneColor(act.newValue)}20`
                                : "var(--color-primary-10, rgba(59, 130, 246, 0.1))",
                          color:
                            act.type === "UPDATE_CATEGORY"
                              ? getCategoryColor(act.newValue)
                              : act.type === "UPDATE_MILESTONE"
                                ? getMilestoneColor(act.newValue)
                                : "inherit",
                        }}
                      >
                        {act.newValue}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground/70 ml-auto">by @{author}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MemoActivityHistory;
