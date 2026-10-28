import type { ContextItem, HandoffPacket, State } from "../model.ts";
import {
  transition as legacyTransition,
  type Action as LegacyAction,
} from "../engine.ts";
import type {
  AdaptiveState,
  AutoAction,
  Recipient,
  AutomationJob,
  Selection,
  Patch,
  Candidate,
  Tool,
  Delta,
} from "./types.ts";
import { STAGES } from "./types.ts";
import {
  adaptiveSeed,
  blankRecipient,
  makeTask,
  id,
  timestamp,
  QUESTION,
  personName,
} from "./seed.ts";
import {
  selectContext,
  evaluateSync,
  recipientPermission,
  metadataFor,
} from "./selection.ts";
export function workspace(s: AdaptiveState, r?: Recipient) {
  return s.base.workspaces.find((w) => w.id === r?.workspaceId);
}
export function currentRecipient(s: AdaptiveState) {
  return s.recipients.find(
    (r) =>
      r.personId === s.view.actorId &&
      r.tool === s.view.tool &&
      r.projectId === s.base.activeProjectId,
  );
}
export function record(
  s: AdaptiveState,
  type: string,
  r?: Recipient,
  itemIds: string[] = [],
  detail = "",
) {
  s.events.push({
    id: id(),
    sessionId: s.study.sessionId,
    condition: s.study.condition,
    scenario: s.study.scenario,
    taskId: r?.task?.id || "",
    recipientId: r?.id || "",
    recipientVersion: workspace(s, r)?.loadedVersion || 0,
    timestamp: timestamp(),
    type,
    itemIds,
    detail,
  });
}
function ensureRecipient(s: AdaptiveState, personId: string, tool: Tool) {
  if (!s.base.members.some((m) => m.id === personId))
    throw Error("Choose a known collaborator.");
  const key = `${s.base.activeProjectId}:${personId}:${tool}`;
  let r = s.recipients.find((r) => r.id === key);
  if (!r) {
    r = blankRecipient(personId, tool, s.base.activeProjectId);
    s.recipients.push(r);
  }
  return r;
}
function enqueue(
  s: AdaptiveState,
  r: Recipient,
  kind: "handoff" | "sync",
  trigger: string,
  forceApproval = false,
) {
  const p = s.base.projects.find((p) => p.id === r.projectId)!;
  const key = `${kind}:${r.id}:${r.task?.id}:${p.version}:${kind === "sync" ? s.policy.revision : 0}:${forceApproval}`;
  if (s.jobs.some((j) => j.key === key && j.status !== "blocked")) return;
  if (
    kind === "handoff" &&
    r.lastTaskKey === `${r.task?.id}:${p.version}` &&
    r.workspaceId
  )
    return;
  const job: AutomationJob = {
    id: id(),
    key,
    kind,
    recipientId: r.id,
    projectId: p.id,
    sourceVersion: p.version,
    sourceItems: structuredClone(
      s.base.items.filter((i) => i.projectId === p.id),
    ),
    stage: 0,
    status: "queued",
    trigger,
    policy: structuredClone(s.policy),
    selection: [],
    deltas: [],
    createdAt: timestamp(),
    forceApproval,
  };
  s.jobs.push(job);
  r.latestJobId = job.id;
  r.status = kind === "handoff" ? "Context detected" : "Update available";
  record(
    s,
    kind === "handoff" ? "TASK_CONTEXT_DETECTED" : "CONTEXT_SYNC_REQUIRED",
    r,
    [],
    `Canonical v${p.version}; trigger: ${trigger}`,
  );
}
function startTask(s: AdaptiveState, r: Recipient, title?: string) {
  const task = makeTask(r.personId, r.tool, r.projectId, title);
  const canonical = s.base.projects.find((p) => p.id === r.projectId)!.version;
  if (
    r.task?.id === task.id &&
    (r.lastTaskKey === `${task.id}:${canonical}` ||
      s.jobs.some(
        (j) =>
          j.recipientId === r.id &&
          j.kind === "handoff" &&
          j.sourceVersion === canonical &&
          ["queued", "running"].includes(j.status),
      ))
  )
    return;
  r.task = task;
  record(s, "TASK_STARTED", r, [], task.title);
  if (s.study.condition === "manual") {
    r.status = "Manual handoff needed";
    record(s, "MANUAL_HANDOFF_REQUIRED", r);
    return;
  }
  enqueue(s, r, "handoff", "TASK_STARTED");
}
function makePacket(
  s: AdaptiveState,
  r: Recipient,
  items: ContextItem[],
  selection: Selection[],
  version: number,
): HandoffPacket {
  const pk: HandoffPacket = {
    id: id(),
    projectId: r.projectId,
    projectVersion: version,
    recipient: r.tool,
    task: r.task!.title,
    purpose:
      items.find((i) => i.category === "brief")?.content ||
      "Task-specific context update",
    items: structuredClone(items),
    excluded: selection
      .filter((x) => x.disposition !== "included")
      .map((x) => ({ id: x.itemId, reason: x.reason })),
    nextAction: r.task!.title,
    timestamp: timestamp(),
    text: "",
  };
  pk.text = JSON.stringify(
    { ...pk, text: undefined, mode: "local-simulation" },
    null,
    2,
  );
  s.base.packets.push(pk);
  return pk;
}
function addHeld(r: Recipient, d: Delta) {
  r.held = r.held.filter((x) => x.itemId !== d.itemId);
  r.held.push(structuredClone(d));
}
function updateCoverage(s: AdaptiveState, r: Recipient) {
  const w = workspace(s, r);
  if (!w) return;
  const changes = s.base.changes.filter(
    (c) => c.projectId === r.projectId && c.version > w.loadedVersion,
  );
  for (const c of changes) {
    let held = false,
      deferred = false;
    for (const i of c.after) {
      if (i.status === "superseded") continue;
      if (r.held.some((d) => d.itemId === i.id)) {
        held = true;
        continue;
      }
      if (r.deferred.some((d) => d.itemId === i.id)) {
        deferred = true;
        continue;
      }
      if (
        !recipientPermission(s, i, r) &&
        selectContext(s, r).some(
          (x) => x.itemId === i.id && x.disposition === "included",
        ) &&
        (w.items.find((x) => x.id === i.id)?.version || 0) < i.version
      )
        deferred = true;
    }
    r.coverage[c.id] = held ? "held" : deferred ? "deferred" : "applied";
  }
  const pending = changes.some((c) =>
    ["held", "deferred"].includes(r.coverage[c.id]),
  );
  if (!pending)
    w.loadedVersion = Math.min(
      r.evaluatedVersion,
      s.base.projects.find((p) => p.id === r.projectId)!.version,
    );
  r.task!.currentContextVersion = w.loadedVersion;
  r.status = r.held.length
    ? "Review required"
    : r.deferred.length
      ? "Task context current · deferred changes"
      : "Sync completed";
}
function deliverInitial(s: AdaptiveState, r: Recipient, pk: HandoffPacket) {
  const old = workspace(s, r);
  const wid = old?.id || id();
  if (old) {
    old.items = structuredClone(pk.items);
    old.loadedVersion = pk.projectVersion;
    old.packetId = pk.id;
    old.task = pk.task;
  } else
    s.base.workspaces.push({
      id: wid,
      projectId: r.projectId,
      recipient: r.tool,
      task: pk.task,
      packetId: pk.id,
      loadedVersion: pk.projectVersion,
      items: structuredClone(pk.items),
      progress: [],
      missing: [],
    });
  r.workspaceId = wid;
  r.evaluatedVersion = pk.projectVersion;
  r.task!.currentContextVersion = pk.projectVersion;
  r.lastTaskKey = `${r.task!.id}:${pk.projectVersion}`;
  r.status = "Context loaded";
  r.held = [];
  r.deferred = [];
  s.base.receipts.push({
    id: id(),
    packetId: pk.id,
    workspaceId: wid,
    timestamp: timestamp(),
  });
  const text =
    r.tool === "Codex" || r.tool === "Cursor"
      ? "I have the current research methodology, prototype requirements, and privacy constraints. I’ll continue with the automated handoff simulation."
      : "The authorized project context is already here. We can explore ideas privately; a suggestion becomes shared only after review.";
  r.messages.push({
    id: id(),
    role: "assistant",
    content: text,
    timestamp: timestamp(),
    contextVersion: pk.projectVersion,
    sourceIds: pk.items.map((i) => i.id),
  });
  record(
    s,
    "HANDOFF_DELIVERED",
    r,
    pk.items.map((i) => i.id),
    `Local adapter acknowledged packet ${pk.id}`,
  );
  record(
    s,
    "CONTEXT_LOADED",
    r,
    pk.items.map((i) => i.id),
    `Loaded v${pk.projectVersion}`,
  );
}
function processNext(s: AdaptiveState) {
  const job = s.jobs.find(
    (j) => j.status === "queued" || j.status === "running",
  );
  if (!job) return;
  const r = s.recipients.find((r) => r.id === job.recipientId)!;
  if (!r?.task) {
    job.status = "blocked";
    return;
  }
  job.status = "running";
  const stage = job.stage;
  record(
    s,
    stage === 0
      ? "TASK_TRANSITION_RECOGNIZED"
      : stage === 1
        ? "RECIPIENT_PERMISSIONS_RESOLVED"
        : stage === 2
          ? "CONTEXT_SELECTION_EVALUATED"
          : stage === 3
            ? job.kind === "sync"
              ? "SYNC_PLAN_PREPARED"
              : "HANDOFF_PREPARED"
            : stage === 4
              ? "LOCAL_DELIVERY_QUEUED"
              : "LOCAL_DELIVERY_ACKNOWLEDGED",
    r,
    [],
    STAGES[stage],
  );
  if (stage === 0)
    r.status = job.kind === "handoff" ? "Context detected" : "Update available";
  if (stage === 1) {
    job.policy = structuredClone(s.policy);
    job.selection = selectContext(s, r, job.sourceItems);
    r.status = "Checking sharing rules";
  }
  if (stage === 2) {
    job.policy = structuredClone(s.policy);
    job.selection = selectContext(s, r, job.sourceItems);
    if (job.kind === "sync") {
      job.deltas = evaluateSync(s, r, job);
      for (const d of job.deltas) {
        if (d.outcome === "held" || d.outcome === "notified") {
          addHeld(r, d);
          record(
            s,
            d.importance === "critical"
              ? "SYNC_INTERRUPTION"
              : "CONTEXT_NOTIFY_ONLY",
            r,
            [d.itemId],
            d.reason,
          );
        } else if (d.outcome === "deferred") {
          r.deferred = r.deferred.filter((x) => x.itemId !== d.itemId);
          r.deferred.push(structuredClone(d));
        } else if (d.outcome === "excluded") {
          record(s, "CONTEXT_WITHHELD", r, [d.itemId], d.reason);
        }
      }
    }
    if (job.selection.some((x) => x.reason.startsWith("Unresolved")))
      record(
        s,
        "CONFLICT_DETECTED",
        r,
        job.selection
          .filter((x) => x.reason.startsWith("Unresolved"))
          .map((x) => x.itemId),
        "Conflicting claims withheld from transfer.",
      );
    r.status = "Preparing handoff";
  }
  if (stage === 3) {
    if (
      job.kind === "handoff" &&
      s.policy.routine !== "automatic" &&
      !job.forceApproval
    ) {
      job.status = "blocked";
      r.status =
        s.policy.routine === "notify"
          ? "Context available · notification only"
          : "Review required";
      record(s, "HANDOFF_HELD_FOR_POLICY", r, [], s.policy.routine);
      return;
    }
    const items =
      job.kind === "handoff"
        ? job.selection
            .filter((x) => x.disposition === "included" && x.item)
            .map((x) => x.item!)
        : job.deltas
            .filter((d) => d.outcome === "automatic" && d.item)
            .map((d) => d.item!);
    if (
      job.kind === "sync" &&
      !items.length &&
      !job.deltas.some(
        (d) => d.operation === "remove" && d.outcome === "automatic",
      )
    ) {
      r.evaluatedVersion = job.sourceVersion;
      updateCoverage(s, r);
      job.status = "complete";
      job.completedAt = timestamp();
      record(
        s,
        "CONTEXT_SYNC_EVALUATED",
        r,
        [],
        `${r.held.length} held; ${r.deferred.length} deferred. No delivery occurred.`,
      );
      return;
    }
    if (items.length || job.deltas.some((d) => d.operation === "remove")) {
      const pk = makePacket(s, r, items, job.selection, job.sourceVersion);
      job.packetId = pk.id;
    }
    r.status = "Transferring";
  }
  if (stage === 4) {
    r.status = "Transferring";
    if (job.packetId)
      record(
        s,
        "HANDOFF_TRANSFERRED",
        r,
        [],
        `Packet ${job.packetId} is in the local adapter outbox.`,
      );
  }
  if (stage === 5) {
    const pk = s.base.packets.find((p) => p.id === job.packetId);
    if (job.kind === "handoff") {
      if (!pk || !pk.items.length) {
        job.status = "blocked";
        r.status = "No eligible context";
        record(
          s,
          "HANDOFF_BLOCKED",
          r,
          [],
          "No approved, relevant, permitted context is available.",
        );
        return;
      }
      if (s.policy.routine !== "automatic" && !job.forceApproval) {
        job.status = "blocked";
        r.status = "Review required";
        return;
      }
      if (pk.items.some((i) => recipientPermission(s, i, r))) {
        job.status = "blocked";
        r.status = "Permissions changed · transfer held";
        return;
      }
      deliverInitial(s, r, pk);
    } else {
      const w = workspace(s, r)!;
      const applied: string[] = [];
      for (const d of job.deltas.filter((d) => d.outcome === "automatic")) {
        const current = s.base.items.find((i) => i.id === d.itemId);
        if (d.operation === "remove") {
          w.items = w.items.filter((i) => i.id !== d.itemId);
          d.outcome = "applied";
          applied.push(d.itemId);
          continue;
        }
        if (
          !d.item ||
          !current ||
          current.version !== d.item.version ||
          recipientPermission(s, current, r)
        )
          continue;
        const policy =
          d.importance === "critical" ? s.policy.critical : s.policy.routine;
        if (policy !== "automatic" && !job.forceApproval) {
          d.outcome = policy === "notify" ? "notified" : "held";
          addHeld(r, d);
          continue;
        }
        w.items = w.items.filter((i) => i.id !== d.itemId);
        w.items.push(structuredClone(d.item));
        r.held = r.held.filter((x) => x.itemId !== d.itemId);
        r.deferred = r.deferred.filter((x) => x.itemId !== d.itemId);
        d.outcome = "applied";
        applied.push(d.itemId);
      }
      r.evaluatedVersion = job.sourceVersion;
      updateCoverage(s, r);
      if (applied.length) {
        if (pk) {
          w.packetId = pk.id;
          s.base.receipts.push({
            id: id(),
            packetId: pk.id,
            workspaceId: w.id,
            timestamp: timestamp(),
          });
        }
        s.base.syncEvents.push({
          id: id(),
          workspaceId: w.id,
          itemIds: applied,
          outcome: "approved",
          timestamp: timestamp(),
          version: job.sourceVersion,
        });
        r.messages.push({
          id: id(),
          role: "assistant",
          content: `Crossville delivered ${applied.length} authorized update${applied.length === 1 ? "" : "s"} from project v${job.sourceVersion}. I’m continuing with ${applied
            .map((id) => s.base.items.find((i) => i.id === id)?.content)
            .filter(Boolean)
            .join(" ")}`,
          timestamp: timestamp(),
          contextVersion: w.loadedVersion,
          sourceIds: applied,
        });
        record(
          s,
          "CONTEXT_SYNC_APPLIED",
          r,
          applied,
          `Applied ${applied.length} task-relevant changes; evaluated v${job.sourceVersion}.`,
        );
      } else
        record(
          s,
          "CONTEXT_SYNC_EVALUATED",
          r,
          [],
          `${r.held.length} held; ${r.deferred.length} deferred. No working context was replaced.`,
        );
    }
    job.status = "complete";
    job.completedAt = timestamp();
    const canonical = s.base.projects.find(
      (p) => p.id === r.projectId,
    )!.version;
    if (canonical > job.sourceVersion && s.study.condition !== "manual")
      enqueue(s, r, "sync", "A newer project version arrived during delivery");
    return;
  }
  job.stage++;
}
function candidate(
  s: AdaptiveState,
  r: Recipient,
  text: string,
  fromNotes = false,
): Candidate | null {
  const lower = text.toLowerCase();
  let patches: Patch[] = [];
  const method =
    workspace(s, r)?.items.find((i) => i.id === "method") ||
    s.base.items.find((i) => i.id === "method");
  if (/action research/.test(lower))
    patches = [
      {
        targetId: "method",
        content:
          "Run action research inside our own team, using short cycles of planning, acting, observing, and reflecting on AI-supported collaboration.",
        category: "decision",
        rationale:
          "Study our actual team practice and adapt the prototype through observed cycles.",
        baseVersion: method?.version || 0,
        tags: ["methodology", "research", "prototype"],
        importance: "critical",
        privacy: "shared",
      },
    ];
  else if (
    r.tool === "NotebookLM" &&
    /pause|step controls|slow.down/.test(lower)
  )
    patches = [
      {
        targetId: "automation-controls",
        content:
          "Provide pause, slow-down and single-step controls so researchers can observe each automation event.",
        category: "fact",
        rationale:
          "NotebookLM synthesis of the synthetic prototype walkthrough.",
        baseVersion: 0,
        tags: ["prototype", "technical"],
        importance: "relevant",
        privacy: "shared",
      },
      {
        targetId: "boundary-labels",
        content:
          "Clearly label private candidates, proposed changes and approved shared context throughout the prototype.",
        category: "fact",
        rationale: "Make sharing boundaries observable during the study.",
        baseVersion: 0,
        tags: ["prototype", "technical"],
        importance: "relevant",
        privacy: "shared",
      },
    ];
  else if (
    /requirement|should|need|update|synthetic|constraint|interrupt/.test(
      lower,
    ) ||
    fromNotes
  )
    patches = [
      {
        targetId: "",
        content: text.trim(),
        category: /\?|interrupt/.test(lower) ? "open_question" : "fact",
        rationale:
          "A private candidate detected by deterministic text rules. Review before sharing.",
        baseVersion: 0,
        tags: r.task?.tags || ["research"],
        importance: "relevant",
        privacy: "shared",
      },
    ];
  if (!patches.length) return null;
  const old = s.candidates.find(
    (c) =>
      c.recipientId === r.id &&
      c.state === "private" &&
      JSON.stringify(c.patches.map((p) => p.content)) ===
        JSON.stringify(patches.map((p) => p.content)),
  );
  if (old) return old;
  const c: Candidate = {
    id: id(),
    projectId: r.projectId,
    recipientId: r.id,
    ownerId: r.personId,
    tool: r.tool,
    sourceRef: `conversation://${r.personId}/${r.tool}/turn/${r.messages.length}`,
    patches,
    state: "private",
  };
  s.candidates.push(c);
  r.candidateIds.push(c.id);
  record(
    s,
    "CONTEXT_CANDIDATE_DETECTED",
    r,
    [c.id],
    "Private candidate only. No shared context was changed.",
  );
  return c;
}
function propose(s: AdaptiveState, c: Candidate) {
  if (c.ownerId !== s.view.actorId)
    throw Error("Only this private workspace owner may propose its candidate.");
  const member = s.base.members.find((m) => m.id === c.ownerId)!;
  if (member.role === "viewer")
    throw Error("An editor or owner must submit shared proposals.");
  if (c.state !== "private")
    throw Error("This candidate is already submitted or dismissed.");
  const first = c.patches[0];
  const target = s.base.items.find((i) => i.id === first.targetId);
  const proposalId = id();
  s.base.decisions.push({
    id: proposalId,
    projectId: c.projectId,
    targetId: target?.id || "",
    before: target?.content || "",
    content: first.content,
    rationale: first.rationale,
    status: "pending",
    authorId: c.ownerId,
    baseVersion: first.baseVersion,
    affectedPeople: s.base.projects.find((p) => p.id === c.projectId)!
      .memberIds,
    affectedTaskIds: [],
    category: first.category,
    privacy: "shared",
    source: {
      id: id(),
      label: `${personName(s, c.ownerId)} via ${c.tool}`,
      reference: c.sourceRef,
      tool: c.tool,
    },
  });
  s.patches[proposalId] = structuredClone(c.patches);
  c.state = "proposed";
  c.proposalId = proposalId;
  record(
    s,
    "SHARED_PROPOSAL_CREATED",
    s.recipients.find((r) => r.id === c.recipientId),
    [proposalId],
    `${c.patches.length} summarized fields submitted; private conversation excluded.`,
  );
}
function versionChanged(s: AdaptiveState, projectId: string) {
  record(
    s,
    "PROJECT_VERSION_CHANGED",
    undefined,
    [],
    `Canonical v${s.base.projects.find((p) => p.id === projectId)!.version}`,
  );
  for (const r of s.recipients.filter(
    (r) => r.projectId === projectId && r.task && r.workspaceId,
  )) {
    if (s.study.condition === "manual") {
      r.status = "Update available · manual sync needed";
      record(s, "MANUAL_SYNC_REQUIRED", r);
      continue;
    }
    enqueue(s, r, "sync", "PROJECT_VERSION_CHANGED");
  }
}
function review(
  s: AdaptiveState,
  proposalId: string,
  outcome: "approved" | "revision" | "rejected",
) {
  const me = s.base.members.find((m) => m.id === s.view.actorId);
  if (me?.role !== "owner")
    throw Error("Only a project owner, including Professor, can review.");
  const d = s.base.decisions.find((d) => d.id === proposalId);
  if (!d || d.status !== "pending")
    throw Error("This proposal is no longer pending.");
  const patches = s.patches[d.id];
  if (!patches)
    throw Error(
      "Use the existing project tools to review this imported proposal.",
    );
  if (outcome !== "approved") {
    d.status = outcome;
    const c = s.candidates.find((c) => c.proposalId === d.id);
    if (c && outcome === "revision") {
      c.state = "private";
      delete c.proposalId;
    }
    record(
      s,
      outcome === "revision" ? "REVISION_REQUESTED" : "PROPOSAL_REJECTED",
      undefined,
      [d.id],
    );
    return;
  }
  for (const patch of patches) {
    const target = s.base.items.find((i) => i.id === patch.targetId);
    if (target && target.version !== patch.baseVersion)
      throw Error(
        "Source context changed. Request revision and review a current candidate before approval.",
      );
    if (!patch.content.trim()) throw Error("A proposed field is empty.");
  }
  const p = s.base.projects.find((p) => p.id === d.projectId)!;
  const previous = p.version;
  const before: ContextItem[] = [];
  const after: ContextItem[] = [];
  for (const patch of patches) {
    const target = s.base.items.find((i) => i.id === patch.targetId);
    if (target) {
      before.push(structuredClone(target));
      if (target.category === "decision") {
        const old = structuredClone(target);
        old.id = `${old.id}@v${old.version}:${id()}`;
        old.status = "superseded";
        s.base.items.push(old);
        s.metadata[old.id] = structuredClone(metadataFor(s, target));
      }
    }
    const i: ContextItem = {
      id: target?.id || patch.targetId || id(),
      projectId: p.id,
      content: patch.content,
      category: patch.category,
      authorId: d.authorId,
      source: structuredClone(d.source),
      createdAt: target?.createdAt || timestamp(),
      updatedAt: timestamp(),
      version: (target?.version || 0) + 1,
      privacy: patch.privacy,
      status: "confirmed",
      relevance: patch.tags.join(" "),
      dependencies: target?.dependencies || [],
      rationale: patch.rationale,
      ...(patch.category === "open_question" ? { stage: "Open" as const } : {}),
      ...(target?.strictness
        ? { strictness: target.strictness, ruleType: target.ruleType }
        : {}),
    };
    s.base.items = s.base.items.filter((x) => x.id !== i.id);
    s.base.items.push(i);
    s.metadata[i.id] = {
      tags: patch.tags,
      importance: patch.importance,
      sensitivity: "normal",
    };
    after.push(structuredClone(i));
  }
  d.status = "approved";
  p.version++;
  p.tasks = p.tasks.map((t) =>
    t.dependsOnMemoryIds.some((i) => after.some((x) => x.id === i))
      ? { ...t, status: "Needs update" }
      : t,
  );
  s.base.changes.push({
    id: id(),
    projectId: p.id,
    version: p.version,
    previousVersion: previous,
    actorId: s.view.actorId,
    tool: d.source.tool,
    type: "proposal_approved",
    entityIds: after.map((i) => i.id),
    timestamp: timestamp(),
    before,
    after,
  });
  s.base.versions.push({
    id: id(),
    projectId: p.id,
    version: p.version,
    timestamp: timestamp(),
    items: structuredClone(s.base.items.filter((i) => i.projectId === p.id)),
  });
  record(
    s,
    "DECISION_APPROVED",
    undefined,
    [d.id, ...after.map((i) => i.id)],
    `Approved by ${personName(s, s.view.actorId)}; source ${d.source.reference}.`,
  );
  versionChanged(s, p.id);
}
export function canAdvance(s: AdaptiveState): boolean {
  const step = s.story.step;
  if (step === 0) return true;
  if (step === 1)
    return s.candidates.some(
      (c) => c.tool === "Claude" && c.state === "proposed",
    );
  if (step === 2)
    return s.base.projects.find((p) => p.id === "study")!.version >= 5;
  if (step === 3)
    return s.recipients.some(
      (r) => r.tool === "Codex" && workspace(s, r)?.loadedVersion === 5,
    );
  if (step === 4)
    return (
      s.base.projects.find((p) => p.id === "study")!.version >= 6 &&
      s.recipients.some(
        (r) => r.tool === "Codex" && (workspace(s, r)?.loadedVersion || 0) >= 6,
      )
    );
  if (step === 5) return true;
  return s.base.projects.find((p) => p.id === "study")!.version >= 7;
}
export function reduceAdaptive(
  previous: AdaptiveState,
  a: AutoAction,
): AdaptiveState {
  if (a.type === "RESET" || a.type === "CONDITION") {
    if (
      a.type === "CONDITION" &&
      previous.study.started &&
      !previous.study.complete
    )
      throw Error("Complete this study task before changing condition.");
    const s = adaptiveSeed();
    s.study.condition =
      a.type === "CONDITION" ? a.condition : previous.study.condition;
    record(s, a.type === "RESET" ? "DEMO_RESET" : "CONDITION_SET");
    return s;
  }
  const s = structuredClone(previous);
  if (a.type === "NAVIGATE") {
    s.view.page = a.page;
    return s;
  }
  if (a.type === "OPEN_WORKSPACE") {
    s.view.page = "My workspace";
    s.view.actorId = a.personId;
    s.base.activeMemberId = a.personId;
    s.view.tool = a.tool;
    const r = ensureRecipient(s, a.personId, a.tool);
    record(s, "AGENT_WORKSPACE_OPENED", r);
    if (!r.task && !["Codex", "Cursor"].includes(a.tool)) startTask(s, r);
    return s;
  }
  if (a.type === "START_TASK") {
    const r = s.recipients.find((r) => r.id === a.recipientId);
    if (!r) throw Error("Open a workspace first.");
    startTask(s, r, a.title);
    return s;
  }
  if (a.type === "TICK") {
    processNext(s);
    return s;
  }
  if (a.type === "CONTROL") {
    s.controls = { paused: a.paused, slow: a.slow };
    record(
      s,
      "AUTOMATION_CONTROL_CHANGED",
      undefined,
      [],
      a.paused
        ? "Paused; no queued mutation is applied until resumed or stepped."
        : a.slow
          ? "Slow playback"
          : "Normal playback",
    );
    return s;
  }
  if (
    a.type === "CHAT" ||
    a.type === "SAVE_NOTES" ||
    a.type === "COMPLETE_TASK" ||
    a.type === "MISSING_CONTEXT"
  ) {
    const r = s.recipients.find((r) => r.id === a.recipientId);
    if (!r || r.personId !== s.view.actorId)
      throw Error("This workspace is private to its selected owner.");
    const w = workspace(s, r);
    if (a.type === "SAVE_NOTES") {
      r.notes = a.notes;
      r.notesEligible = a.eligible;
      record(s, "PRIVATE_WORK_UPDATED", r, [], "Private notes saved.");
      if (a.eligible && a.notes.trim().length > 12)
        candidate(s, r, a.notes, true);
      return s;
    }
    if (a.type === "MISSING_CONTEXT") {
      if (!a.text.trim()) throw Error("Describe the missing context.");
      w?.missing.push(a.text);
      record(s, "MISSING_CONTEXT_REPORTED", r, [], a.text);
      return s;
    }
    if (!w)
      throw Error(
        "The task context is not loaded yet. Wait for delivery or inspect the sharing policy.",
      );
    if (a.type === "COMPLETE_TASK") {
      if (r.task?.status === "completed") return s;
      r.task!.status = "completed";
      w.progress.push({
        content:
          "Completed the bounded prototype task; identified an unresolved interruption requirement.",
        timestamp: timestamp(),
      });
      r.messages.push({
        id: id(),
        role: "assistant",
        content: `The prototype task is complete. One unresolved requirement remains: ${QUESTION}`,
        timestamp: timestamp(),
        contextVersion: w.loadedVersion,
        sourceIds: w.items.map((i) => i.id),
      });
      const c = candidate(s, r, QUESTION)!;
      if (s.policy.proposeFeedback) {
        propose(s, c);
        record(
          s,
          "AGENT_FEEDBACK_PROPOSED",
          r,
          [c.proposalId!],
          "A summarized task finding entered review under the configured feedback policy. Raw conversation was not submitted.",
        );
      }
      record(s, "TASK_COMPLETED", r);
      return s;
    }
    if (!a.text.trim()) throw Error("Enter a message.");
    r.messages.push({
      id: id(),
      role: "user",
      content: a.text,
      timestamp: timestamp(),
      contextVersion: w.loadedVersion,
      sourceIds: [],
    });
    const method = w.items.find((i) => i.id === "method");
    const detected = candidate(s, r, a.text);
    r.messages.push({
      id: id(),
      role: "assistant",
      content: /action research/i.test(a.text)
        ? `We could study our own collaboration through planning, acting, observing and reflecting. That would change recruitment, task design and what we record. The current approved approach remains: ${method?.content || "No approved methodology was loaded."} This is a private exploration, not an adopted decision. I’ve outlined the approach as a candidate for your review.`
        : detected && r.tool === "NotebookLM"
          ? "These walkthrough findings suggest two prototype improvements: observable automation controls and clear private/proposed/shared boundaries. They remain private candidates until you submit them for project review."
          : `I’m working with ${w.items.length} authorized context items from v${w.loadedVersion}. ${method ? `Current methodology: ${method.content}` : ""} We can explore “${a.text}” as a bounded task and record missing information without changing the shared project.`,
      timestamp: timestamp(),
      contextVersion: w.loadedVersion,
      sourceIds: w.items.map((i) => i.id),
    });
    record(
      s,
      "PRIVATE_WORK_UPDATED",
      r,
      [],
      "Simulated conversation updated; private content was not published.",
    );
    return s;
  }
  if (
    a.type === "PROPOSE_CANDIDATE" ||
    a.type === "DISMISS_CANDIDATE" ||
    a.type === "EDIT_CANDIDATE"
  ) {
    const c = s.candidates.find((c) => c.id === a.id);
    if (!c || c.ownerId !== s.view.actorId)
      throw Error("Only the candidate owner can change it.");
    if (a.type === "PROPOSE_CANDIDATE") {
      propose(s, c);
      if (s.story.active && s.story.step === 1) {
        s.story.step = 2;
        s.view.page = "Shared workspace";
        s.view.actorId = "professor";
        s.base.activeMemberId = "professor";
      }
    } else if (a.type === "DISMISS_CANDIDATE") {
      if (c.state !== "private")
        throw Error("Submitted proposals must be reviewed.");
      c.state = "dismissed";
      record(
        s,
        "PRIVATE_CANDIDATE_DISMISSED",
        s.recipients.find((r) => r.id === c.recipientId),
        [c.id],
      );
    } else {
      if (c.state !== "private")
        throw Error("Submitted fields are immutable; request revision first.");
      const patch = c.patches[a.patchIndex || 0];
      if (!patch) throw Error("Candidate field unavailable.");
      patch.content = a.content;
      patch.rationale = a.rationale;
      patch.importance = a.importance;
      record(
        s,
        "PRIVATE_CANDIDATE_EDITED",
        s.recipients.find((r) => r.id === c.recipientId),
        [c.id],
      );
    }
    return s;
  }
  if (a.type === "REVIEW_PROPOSAL") {
    review(s, a.id, a.outcome);
    return s;
  }
  if (a.type === "POLICY") {
    if (s.base.members.find((m) => m.id === s.view.actorId)?.role !== "owner")
      throw Error(
        "A project owner must set sharing and synchronization policy.",
      );
    s.policy = {
      routine: a.routine,
      critical: a.critical,
      allowTeam: a.allowTeam,
      proposeFeedback: a.proposeFeedback,
      revision: s.policy.revision + 1,
    };
    record(
      s,
      "SHARING_POLICY_CHANGED",
      undefined,
      [],
      JSON.stringify(s.policy),
    );
    if (s.study.condition !== "manual")
      for (const r of s.recipients.filter((r) => r.task)) {
        if (!r.workspaceId) enqueue(s, r, "handoff", "SHARING_POLICY_CHANGED");
        else enqueue(s, r, "sync", "SHARING_POLICY_CHANGED");
      }
    return s;
  }
  if (a.type === "OVERRIDE_SYNC") {
    const r = s.recipients.find((r) => r.id === a.recipientId);
    if (!r) throw Error("Choose a recipient.");
    if (
      r.personId !== s.view.actorId &&
      s.base.members.find((m) => m.id === s.view.actorId)?.role !== "owner"
    )
      throw Error(
        "Only the recipient owner or project owner can override this review.",
      );
    record(
      s,
      "USER_OVERRIDE",
      r,
      r.held.map((d) => d.itemId),
      a.apply
        ? "Approve one-time delivery of authorized changes"
        : "Decline; retain existing context",
    );
    if (a.apply)
      enqueue(
        s,
        r,
        r.workspaceId ? "sync" : "handoff",
        "USER_APPROVED_REVIEW",
        true,
      );
    else {
      for (const d of r.held) {
        r.deferred.push({ ...d, outcome: "deferred" });
      }
      r.held = [];
      r.status = "Updates deferred by user";
    }
    return s;
  }
  if (a.type === "INSPECT") {
    if (s.study.condition !== "explainable")
      throw Error(
        "Detailed context explanations are unavailable in this study condition.",
      );
    s.view.inspector = true;
    record(s, "CONTEXT_INSPECTED", currentRecipient(s), [a.id]);
    return s;
  }
  if (a.type === "MANUAL_DELIVER") {
    if (s.study.condition !== "manual")
      throw Error(
        "Manual handoff is only available in the baseline condition.",
      );
    const r = s.recipients.find((r) => r.id === a.recipientId);
    if (!r?.task) throw Error("Start a task first.");
    const selection = selectContext(s, r);
    const permitted = selection
      .filter(
        (x) =>
          x.disposition !== "withheld" && a.ids.includes(x.itemId) && x.item,
      )
      .map((x) => x.item!);
    if (!permitted.length)
      throw Error("Choose at least one current, permitted source item.");
    const p = s.base.projects.find((p) => p.id === r.projectId)!;
    const pk = makePacket(s, r, permitted, selection, p.version);
    if (a.summary.trim()) pk.text = a.summary + "\n\n" + pk.text;
    deliverInitial(s, r, pk);
    record(
      s,
      "MANUAL_HANDOFF_CREATED",
      r,
      permitted.map((i) => i.id),
      "Participant manually selected and loaded context.",
    );
    return s;
  }
  if (a.type === "STUDY_START") {
    if (s.study.started)
      throw Error("Reset or start a new condition for another session.");
    s.study.started = true;
    record(s, "STUDY_TASK_STARTED", currentRecipient(s));
    return s;
  }
  if (a.type === "STUDY_COMPLETE") {
    if (!s.study.started || s.study.complete)
      throw Error("Start an unfinished study session first.");
    s.study.complete = true;
    record(s, "STUDY_TASK_COMPLETED", currentRecipient(s));
    return s;
  }
  if (a.type === "STORY_EXIT") {
    s.story.active = false;
    return s;
  }
  if (a.type === "STORY_OPEN") {
    s.story.active = true;
    return s;
  }
  if (a.type === "STORY_BACK") {
    s.story.step = Math.max(0, s.story.step - 1);
    s.view.page =
      s.story.step === 0 || s.story.step === 2
        ? "Shared workspace"
        : "My workspace";
    const person =
      s.story.step === 2
        ? "professor"
        : s.story.step === 4
          ? "teammate-b"
          : s.story.step >= 3
            ? "teammate-a"
            : "you";
    s.view.actorId = person;
    s.base.activeMemberId = person;
    s.view.tool =
      s.story.step === 4
        ? "NotebookLM"
        : s.story.step >= 3
          ? "Codex"
          : "Claude";
    if (s.view.page === "My workspace") ensureRecipient(s, person, s.view.tool);
    return s;
  }
  if (a.type === "STORY_NEXT") {
    if (!canAdvance(s))
      throw Error("Complete this scene’s task before continuing.");
    s.story.step = Math.min(6, s.story.step + 1);
    if (s.story.step === 1) {
      s.view.actorId = "you";
      s.base.activeMemberId = "you";
      s.view.tool = "Claude";
      s.view.page = "My workspace";
    }
    if (s.story.step === 3) {
      s.view.actorId = "teammate-a";
      s.base.activeMemberId = "teammate-a";
      s.view.tool = "Codex";
      s.view.page = "My workspace";
      ensureRecipient(s, "teammate-a", "Codex");
    }
    if (s.story.step === 4) {
      s.view.page = "My workspace";
      s.view.actorId = "teammate-b";
      s.base.activeMemberId = "teammate-b";
      s.view.tool = "NotebookLM";
    }
    if (s.story.step === 5 || s.story.step === 6) {
      s.view.page = "My workspace";
      s.view.actorId = "teammate-a";
      s.base.activeMemberId = "teammate-a";
      s.view.tool = "Codex";
      s.view.inspector = s.study.condition === "explainable";
    }
    record(
      s,
      "STORY_SCENE_OPENED",
      currentRecipient(s),
      [],
      `Scene ${s.story.step + 1}`,
    );
    return s;
  }
  return s;
}
export function reduceLegacy(s: AdaptiveState, a: LegacyAction): AdaptiveState {
  if (a.type === "personalStart")
    return reduceAdaptive(s, {
      type: "OPEN_WORKSPACE",
      personId: s.view.actorId,
      tool: s.view.tool,
    });
  if (a.type === "resolve" && s.patches[a.id])
    return reduceAdaptive(s, {
      type: "REVIEW_PROPOSAL",
      id: a.id,
      outcome: a.status,
    });
  const n = structuredClone(s);
  const previous = n.base.projects.map((p) => ({
    id: p.id,
    version: p.version,
  }));
  n.base.activeMemberId = n.view.actorId;
  n.base.study.active = false;
  n.base = legacyTransition(n.base, a);
  n.view.actorId = n.base.activeMemberId;
  for (const p of n.base.projects)
    if (previous.find((x) => x.id === p.id)?.version !== p.version)
      versionChanged(n, p.id);
  record(n, `MANUAL_${a.type.toUpperCase()}`, currentRecipient(n));
  return n;
}
export function exportEvents(s: AdaptiveState) {
  const keys = [
    "sessionId",
    "condition",
    "scenario",
    "taskId",
    "recipientId",
    "recipientVersion",
    "timestamp",
    "type",
    "itemIds",
    "detail",
  ] as const;
  const quote = (x: unknown) =>
    '"' +
    String(Array.isArray(x) ? x.join(";") : x).replaceAll('"', '""') +
    '"';
  return [
    keys.join(","),
    ...s.events.map((e) => keys.map((k) => quote(e[k])).join(",")),
  ].join("\r\n");
}
export function flushAutomation(s: AdaptiveState, max = 250) {
  let n = s;
  let steps = 0;
  while (
    n.jobs.some((j) => j.status === "queued" || j.status === "running") &&
    steps++ < max
  )
    n = reduceAdaptive(n, { type: "TICK" });
  if (steps >= max) throw Error("Automation did not settle");
  return n;
}
export function importLegacy(base: State) {
  return adaptiveSeed(base);
}
