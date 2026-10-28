import type { ContextItem } from "../model.ts";
import type {
  AdaptiveState,
  Recipient,
  WorkTask,
  Selection,
  ItemMetadata,
  Delta,
  AutomationJob,
} from "./types.ts";
export function metadataFor(s: AdaptiveState, i: ContextItem): ItemMetadata {
  return (
    s.metadata[i.id] || {
      tags:
        i.category === "decision"
          ? ["methodology", "research"]
          : i.category === "constraint"
            ? ["privacy", "research"]
            : i.category === "brief"
              ? ["research"]
              : [],
      importance: i.category === "constraint" ? "critical" : "relevant",
      sensitivity: "normal",
    }
  );
}
export function recipientPermission(
  s: AdaptiveState,
  i: ContextItem,
  r: Recipient,
): string | null {
  if (i.projectId !== r.projectId) return "Different project.";
  if (i.privacy === "private")
    return "Private working context is not authorized for shared handoffs.";
  if (metadataFor(s, i).sensitivity === "restricted")
    return "Restricted information is outside this recipient’s permissions.";
  if (
    i.privacy === "team" &&
    (!s.policy.allowTeam ||
      !s.base.projects
        .find((p) => p.id === i.projectId)
        ?.memberIds.includes(r.personId))
  )
    return "Team-only information is not authorized by the sharing policy.";
  return null;
}
function requiredIds(items: ContextItem[], task: WorkTask): Set<string> {
  const ids = new Set([
    ...task.requiredDecisionIds,
    ...task.requiredConstraintIds,
  ]);
  let more = true;
  while (more) {
    more = false;
    for (const i of items)
      if (ids.has(i.id))
        for (const dep of i.dependencies)
          if (!ids.has(dep)) {
            ids.add(dep);
            more = true;
          }
  }
  return ids;
}
export function selectContext(
  s: AdaptiveState,
  r: Recipient,
  sourceItems = s.base.items,
): Selection[] {
  const task = r.task;
  if (!task) return [];
  const required = requiredIds(sourceItems, task);
  return sourceItems
    .filter((i) => i.projectId === r.projectId)
    .map((i) => {
      const denied = recipientPermission(s, i, r);
      const m = metadataFor(s, i);
      let reason = "";
      let disposition: Selection["disposition"] = "included";
      if (denied) {
        reason = denied;
        disposition = "withheld";
      } else if (i.status !== "confirmed" || i.category === "inbox") {
        reason =
          i.status === "superseded"
            ? "Superseded context is historical, not a current fact."
            : "Pending or disputed information has not been approved.";
        disposition = "withheld";
      } else if (
        s.base.conflicts.some(
          (c) =>
            c.projectId === r.projectId &&
            c.status === "unresolved" &&
            c.itemIds.includes(i.id),
        )
      ) {
        reason = "Unresolved conflicting claims are held for owner review.";
        disposition = "withheld";
      } else if (required.has(i.id)) {
        reason =
          i.category === "decision"
            ? "This approved methodology decision governs the recipient’s current task."
            : "Required by the task or a dependency of its approved methodology.";
      } else if (i.category === "brief") {
        reason = "The project purpose establishes the goal for this task.";
      } else if (
        task.categories.includes(i.category) &&
        m.tags.some((t) => task.tags.includes(t))
      ) {
        reason = `Task tags match: ${m.tags.filter((t) => task.tags.includes(t)).join(", ")}.`;
      } else {
        reason =
          "Unrelated to the task’s categories, tags and declared dependencies; deferred without interruption.";
        disposition = "deferred";
      }
      return {
        itemId: denied ? "restricted" : i.id,
        content: denied ? "Restricted context withheld" : i.content,
        sourceRef: denied ? "" : i.source.reference,
        disposition,
        importance: m.importance,
        reason,
        ...(denied ? {} : { item: structuredClone(i) }),
      };
    });
}
export function evaluateSync(
  s: AdaptiveState,
  r: Recipient,
  job: AutomationJob,
): Delta[] {
  const workspace = s.base.workspaces.find((w) => w.id === r.workspaceId);
  if (!workspace) return [];
  const selection = selectContext(s, r, job.sourceItems);
  const changes = s.base.changes.filter(
    (c) =>
      c.projectId === r.projectId &&
      c.version <= job.sourceVersion &&
      c.version > workspace.loadedVersion,
  );
  const changedIds = new Set(changes.flatMap((c) => c.entityIds));
  const result: Delta[] = [];
  for (const i of job.sourceItems.filter((i) => i.projectId === r.projectId)) {
    const old = workspace.items.find((x) => x.id === i.id);
    const denied = recipientPermission(s, i, r);
    if (denied && old) {
      result.push({
        itemId: i.id,
        content: "Previously authorized item removed",
        sourceRef: "",
        disposition: "withheld",
        importance: "critical",
        reason:
          "Permissions no longer authorize this item. Removal is mandatory.",
        operation: "remove",
        outcome: "automatic",
        changeIds: changes
          .filter((c) => c.entityIds.includes(i.id))
          .map((c) => c.id),
      });
      continue;
    }
    if (old?.version === i.version || (!old && !changedIds.has(i.id))) continue;
    const sel = selection.find((x) => x.itemId === i.id);
    if (!sel) {
      continue;
    }
    if (sel.item?.status === "superseded" && !old) continue;
    let outcome: Delta["outcome"] = "deferred";
    if (sel.disposition === "withheld") outcome = "excluded";
    else if (sel.disposition === "included") {
      const policy =
        sel.importance === "critical" ? s.policy.critical : s.policy.routine;
      outcome = job.forceApproval
        ? "automatic"
        : policy === "automatic"
          ? "automatic"
          : policy === "notify"
            ? "notified"
            : "held";
    }
    result.push({
      ...sel,
      before: old ? structuredClone(old) : undefined,
      operation: "upsert",
      outcome,
      changeIds: changes
        .filter((c) => c.entityIds.includes(i.id))
        .map((c) => c.id),
    });
  }
  return result;
}
