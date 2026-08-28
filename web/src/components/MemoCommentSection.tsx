import {
  ArrowRightIcon,
  CalendarIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  HistoryIcon,
  LayersIcon,
  LoaderCircleIcon,
  MessageCircleIcon,
  TagIcon,
  TargetIcon,
} from "lucide-react";
import { type ComponentType, useCallback, useMemo, useState } from "react";
import { loadMemoEditor } from "@/components/MemoEditor/loader";
import type { MemoEditorProps } from "@/components/MemoEditor/types";
import MemoView from "@/components/MemoView";
import { Button } from "@/components/ui/button";
import useCurrentUser from "@/hooks/useCurrentUser";
import { extractMemoIdFromName } from "@/lib/resource-names";
import type { Activity, Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { getCategoryColor, getMilestoneColor } from "./Boards/cardUtils";

interface Props {
  memo: Memo;
  comments: Memo[];
  activities?: Activity[];
  parentPage?: string;
  hasMoreComments?: boolean;
  isFetchingMoreComments?: boolean;
  onLoadMoreComments?: () => void;
}

type TimelineItem =
  | { type: "comment"; id: string; timestamp: number; comment: Memo }
  | { type: "activity"; id: string; timestamp: number; activity: Activity };

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

const MemoCommentSection = ({
  memo,
  comments,
  activities,
  parentPage,
  hasMoreComments,
  isFetchingMoreComments,
  onLoadMoreComments,
}: Props) => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [showEditor, setShowEditor] = useState(false);
  const [isEditorLoading, setIsEditorLoading] = useState(false);
  const [isActivitiesExpanded, setIsActivitiesExpanded] = useState(false);
  const [EditorComponent, setEditorComponent] = useState<ComponentType<MemoEditorProps>>();

  const showCreateButton = currentUser && !showEditor;

  const handleCommentCreated = async (_memoCommentName: string) => {
    setShowEditor(false);
  };

  const preloadEditor = useCallback(() => {
    void loadMemoEditor().catch(() => undefined);
  }, []);

  const openEditor = useCallback(async () => {
    if (isEditorLoading) {
      return;
    }

    setIsEditorLoading(true);
    try {
      const { default: MemoEditor } = await loadMemoEditor();
      setEditorComponent(() => MemoEditor);
      setShowEditor(true);
    } catch {
      // Chunk failures are handled by loadWithReload; keep the current UI mounted.
    } finally {
      setIsEditorLoading(false);
    }
  }, [isEditorLoading]);

  const activityList = activities || memo.activities || [];
  const activityCount = activityList.length;
  const shouldCollapseActivities = activityCount >= 4 && !isActivitiesExpanded;
  const hiddenActivitiesCount = activityCount >= 4 ? activityCount - 3 : 0;

  const timelineItems: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];

    for (const comment of comments) {
      const sec = comment.createTime ? Number(comment.createTime.seconds) : 0;
      items.push({
        type: "comment",
        id: `comment-${comment.name}`,
        timestamp: sec,
        comment,
      });
    }

    // If collapsing activities (>= 4), only include the 3 most recent activities
    const visibleActivities = shouldCollapseActivities ? activityList.slice(-3) : activityList;
    for (let i = 0; i < visibleActivities.length; i++) {
      const act = visibleActivities[i];
      const sec = act.createTime ? Number(act.createTime.seconds) : 0;
      items.push({
        type: "activity",
        id: `activity-${act.name || i}`,
        timestamp: sec,
        activity: act,
      });
    }

    // Sort chronologically (earliest to latest)
    return items.sort((a, b) => a.timestamp - b.timestamp);
  }, [comments, activityList, shouldCollapseActivities]);

  const renderActivityItem = (act: Activity, key: string) => {
    const formattedTime = formatActivityTime(act.createTime);
    const author = formatUserName(act.creator);

    return (
      <div
        key={key}
        className="w-full flex items-center gap-3 py-2 px-3.5 rounded-lg bg-card/60 border border-border/50 text-xs shadow-2xs hover:bg-card hover:border-border transition-all"
      >
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background border border-border/70 shadow-2xs">
          {getActivityIcon(act.type)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          <span className="font-medium text-foreground text-[12px]">{act.description}</span>
          {(act.oldValue || act.newValue) && (
            <div className="inline-flex items-center gap-1 text-[11px]">
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
            </div>
          )}
          <span className="text-[10px] text-muted-foreground/70">by @{author}</span>
        </div>
        <span
          className="text-[10px] text-muted-foreground shrink-0 font-mono"
          title={act.createTime ? new Date(Number(act.createTime.seconds) * 1000).toLocaleString() : undefined}
        >
          {formattedTime}
        </span>
      </div>
    );
  };

  return (
    <div className="pt-8 pb-16 w-full">
      <h2 id="comments" className="sr-only">
        {t("memo.comment.self")}
      </h2>
      <div className="relative mx-auto grow w-full min-h-full flex flex-col justify-start items-start gap-y-2">
        {timelineItems.length === 0 ? (
          showCreateButton && (
            <div className="w-full flex flex-row justify-center items-center py-6">
              <Button
                variant="ghost"
                onPointerEnter={preloadEditor}
                onFocus={preloadEditor}
                onClick={openEditor}
                disabled={isEditorLoading}
              >
                <span className="text-muted-foreground">{t("memo.comment.write-a-comment")}</span>
                {isEditorLoading ? (
                  <LoaderCircleIcon className="ml-2 h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <MessageCircleIcon className="ml-2 w-5 h-auto text-muted-foreground" />
                )}
              </Button>
            </div>
          )
        ) : (
          <div className="w-full flex flex-row justify-between items-center h-8 pl-1 mb-2">
            <div className="flex flex-row justify-start items-center gap-1.5">
              <MessageCircleIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground text-sm font-medium">
                {activityCount > 0 ? "Activity & Comments" : t("memo.comment.self")}
              </span>
              <span className="text-muted-foreground text-xs">
                (
                {comments.length > 0 && activityCount > 0
                  ? `${comments.length} comments, ${activityCount} updates`
                  : activityCount > 0
                    ? `${activityCount} updates`
                    : comments.length}
                )
              </span>
            </div>
            {showCreateButton && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-8 text-xs"
                onPointerEnter={preloadEditor}
                onFocus={preloadEditor}
                onClick={openEditor}
                disabled={isEditorLoading}
              >
                {isEditorLoading && <LoaderCircleIcon className="h-3.5 w-3.5 animate-spin mr-1" />}
                {t("memo.comment.write-a-comment")}
              </Button>
            )}
          </div>
        )}
        {showEditor && EditorComponent && (
          <div className="w-full mb-2">
            <EditorComponent
              cacheKey={`${memo.name}-comment`}
              placeholder={t("editor.add-your-comment-here")}
              parentMemoName={memo.name}
              autoFocus
              onConfirm={handleCommentCreated}
              onCancel={() => setShowEditor(false)}
            />
          </div>
        )}

        {/* Collapse / Expand banner when total activities >= 4 */}
        {activityCount >= 4 && (
          <div className="w-full flex justify-center py-1">
            {shouldCollapseActivities ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-full border-dashed text-muted-foreground hover:text-foreground flex items-center gap-1.5 shadow-2xs bg-muted/40 hover:bg-muted transition-all"
                onClick={() => setIsActivitiesExpanded(true)}
              >
                <HistoryIcon className="size-3 text-muted-foreground" />
                <span>
                  Show {hiddenActivitiesCount} earlier {hiddenActivitiesCount === 1 ? "activity" : "activities"}
                </span>
                <ChevronDownIcon className="size-3 text-muted-foreground" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-all"
                onClick={() => setIsActivitiesExpanded(false)}
              >
                <span>Collapse earlier activities</span>
                <ChevronUpIcon className="size-3 text-muted-foreground" />
              </Button>
            )}
          </div>
        )}

        {timelineItems.map((item) => {
          if (item.type === "comment") {
            return (
              <div className="w-full" key={item.id} id={extractMemoIdFromName(item.comment.name)}>
                <MemoView memo={item.comment} parentPage={parentPage} showCreator compact />
              </div>
            );
          }
          return renderActivityItem(item.activity, item.id);
        })}

        {hasMoreComments && (
          <div className="w-full mt-4 flex justify-center">
            <Button variant="outline" className="rounded-full px-4" onClick={onLoadMoreComments} disabled={isFetchingMoreComments}>
              {isFetchingMoreComments && <LoaderCircleIcon className="h-4 w-4 animate-spin" />}
              {t(isFetchingMoreComments ? "resource.fetching-data" : "memo.load-more")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemoCommentSection;
