import { bSeed } from "./bSeed.ts";
import {
  createPersonalWorkspace,
  simulatePrivateReply,
  deriveContextDraft,
  submitDraftPayload,
} from "./vendor/personal.mjs";
import { members, projects } from "./data/sampleData.ts";
import type {
  State,
  ContextItem,
  Category,
  Privacy,
  HandoffPacket,
  SyncRecommendation,
  Decision,
  PersonalItem,
} from "./model.ts";
export const tools = [
  "ChatGPT",
  "Claude",
  "Gemini",
  "Codex",
  "Cursor",
  "NotebookLM",
  "Teammate A",
  "Teammate B",
  "Professor",
  "Other tool",
];
export const categories: Category[] = [
  "brief",
  "decision",
  "constraint",
  "open_question",
  "fact",
  "inbox",
];
export const scenarios = [
  "Recall",
  "Branching",
  "Updating requirements",
  "Context selection",
  "Cross-tool handoff",
  "Provenance checking",
];
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
export function seed(scenario = "Cross-tool handoff"): State {
  const items: ContextItem[] = projects.flatMap((p) =>
    p.memories.map((m) => ({
      id: m.id,
      projectId: p.id,
      content: m.text,
      category: m.type,
      authorId: members.find((x) => x.name === m.author)?.id || "you",
      source: {
        id: `source-${m.id}`,
        label: m.source,
        reference: `seed://${p.id}/${m.id}`,
        tool: "Team discussion",
      },
      createdAt: m.updatedAt,
      updatedAt: m.updatedAt,
      version: m.version,
      privacy: "shared",
      status: "confirmed",
      relevance: "research prototype methodology",
      dependencies: m.id === "method" ? ["ethics"] : [],
      rationale:
        m.id === "method"
          ? "Observe real handoffs inside the team before expanding recruitment."
          : "",
    })),
  );
  const stamp = now();
  items.push({
    id: "private-note",
    projectId: "study",
    content: "Fictional personal planning note: ask for a shorter meeting.",
    category: "fact",
    authorId: "you",
    source: {
      id: "private-source",
      label: "Personal notebook",
      reference: "seed://private",
      tool: "You",
    },
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    privacy: "private",
    status: "tentative",
    relevance: "meeting",
    dependencies: [],
    rationale: "",
  });
  const prompts: Record<string, string> = {
    Recall: "What is the approved methodology and why?",
    Branching:
      "Explore a pilot branch without replacing the approved methodology.",
    "Updating requirements":
      "Propose a change to the methodology and review its impact.",
    "Context selection":
      "Select the minimum relevant context for an implementation task.",
    "Cross-tool handoff":
      "Continue building the research prototype using the team’s approved methodology and constraints.",
    "Provenance checking":
      "Trace the methodology decision to its source and rationale.",
  };
  items.push({
    id: "scenario-task",
    projectId: "study",
    content: prompts[scenario] || prompts["Cross-tool handoff"],
    category: "inbox",
    authorId: "teammate-a",
    source: {
      id: "scenario-source",
      label: `${scenario} study fixture`,
      reference: `seed://scenario/${encodeURIComponent(scenario)}`,
      tool: "ChatGPT",
    },
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    privacy: "shared",
    status: "tentative",
    relevance: "research task",
    dependencies: [],
    rationale: "",
  });
  // Migrate the supplied GitHub fixture into the same canonical projects, preserving provenance.
  for (const bp of bSeed.projects) {
    const projectId = bp.id === "shared-context" ? "study" : "campus";
    for (const raw of bp.items) {
      const bi = raw as unknown as {
        id: string;
        category: string;
        title: string;
        content: string;
        status: string;
        access: string;
        ownerId: string;
        revision: number;
        author: string;
        tool: string;
        updatedAt: string;
        source: { label: string; conversationId: string; turn: number };
        rationale?: string;
        progress?: string;
        milestone?: ContextItem["milestone"];
      };
      const map: Record<string, Category> = {
        brief: "brief",
        decisions: "decision",
        constraints: "constraint",
        questions: "open_question",
      };
      const id =
        bi.id === "brief"
          ? "study-brief"
          : bi.id === "private-note"
            ? "b-private-note"
            : bi.id;
      const existing = items.findIndex((i) => i.id === id);
      const value: ContextItem = {
        id,
        projectId,
        content: bi.content,
        category: map[bi.category],
        authorId:
          bi.author === "Teammate B"
            ? "teammate-b"
            : bi.author === "Teammate A"
              ? "teammate-a"
              : bi.author === "Professor"
                ? "professor"
                : "you",
        source: {
          id: `b-source-${id}`,
          label: bi.source.label,
          reference: `conversation://${bi.source.conversationId}/turn/${bi.source.turn}`,
          tool: bi.tool,
        },
        createdAt: bi.updatedAt,
        updatedAt: bi.updatedAt,
        version: bi.revision,
        privacy: bi.access === "private" ? "private" : "shared",
        status:
          bi.status === "active"
            ? "confirmed"
            : bi.status === "superseded"
              ? "superseded"
              : "tentative",
        relevance: "research prototype pilot study",
        dependencies: bi.id === "method" ? ["ethics", "constraints"] : [],
        rationale: bi.rationale || "",
        ...(bi.progress ? { progress: bi.progress } : {}),
        ...(bi.milestone ? { milestone: bi.milestone } : {}),
      };
      if (bi.access === "private") value.authorId = "teammate-b";
      if (existing >= 0) items[existing] = value;
      else items.push(value);
    }
  }
  // Preview-verified Figma classifications are represented as metadata, not another store.
  for (const i of items) {
    if (i.category === "constraint") {
      i.strictness = "Must";
      i.ruleType = /private|privacy|IRB|notes|review/i.test(i.content)
        ? "Privacy and sharing"
        : "Study limits";
    }
    if (i.category === "open_question") {
      i.stage = "Open";
      i.assigneeId = i.authorId;
      i.findings = "";
    }
  }
  const ps = projects.map((p) => ({
    id: p.id,
    name: p.name,
    version: p.memoryVersion,
    memberIds: p.memberIds,
    tasks: structuredClone(p.tasks),
  }));
  return {
    schema: 1,
    sourceActivity: bSeed.projects.flatMap((p) =>
      p.activity.map((a) => ({
        id: `source-${a.id}`,
        projectId: p.id === "shared-context" ? "study" : "campus",
        actor: a.actor,
        tool: a.tool,
        content: a.text,
        timestamp: a.time,
      })),
    ),
    conflicts: [
      {
        id: "pilot-duration",
        projectId: "study",
        title: "Two sources disagree on pilot duration",
        itemIds: ["scope-current", "scope-conflict"],
        ownerId: "you",
        status: "unresolved",
      },
    ],
    personal: [],
    projects: ps,
    members: structuredClone(members),
    items,
    decisions: [
      {
        id: "method-update",
        projectId: "study",
        targetId: "method",
        before: items.find((i) => i.id === "method")!.content,
        content:
          "Run action research inside our own team, using short cycles of planning, acting, observing, and reflecting.",
        rationale:
          "Learn by using the prototype ourselves, then reflect and iterate.",
        status: "pending",
        authorId: "teammate-b",
        baseVersion: 4,
        affectedPeople: members.map((m) => m.id),
        affectedTaskIds: ["interview-guide", "pilot-plan"],
        category: "decision",
        privacy: "shared",
        source: {
          id: "b-proposal",
          label: "Teammate B via NotebookLM",
          reference: "conversation://study-method-review/turn/8",
          tool: "NotebookLM",
        },
      },
    ],
    votes: [],
    rounds: {},
    comments: [],
    versions: ps.map((p) => ({
      id: uid(),
      projectId: p.id,
      version: p.version,
      timestamp: stamp,
      items: structuredClone(items.filter((i) => i.projectId === p.id)),
    })),
    packets: [],
    workspaces: [],
    receipts: [],
    changes: [],
    syncEvents: [],
    logs: [],
    activeMemberId: "you",
    activeProjectId: "study",
    study: {
      active: false,
      sessionId: uid(),
      condition: "Crossville",
      scenario,
      baseline: "",
      started: false,
      complete: false,
    },
  };
}
export function log(
  s: State,
  type: string,
  itemIds: string[] = [],
  detail = "",
) {
  s.logs.push({
    id: uid(),
    projectId: s.activeProjectId,
    sessionId: s.study.sessionId,
    condition: s.study.condition,
    scenario: s.study.scenario,
    timestamp: now(),
    type,
    itemIds,
    actorId: s.activeMemberId,
    detail,
  });
}
export function permitted(item: ContextItem, recipient: string): boolean {
  return (
    item.privacy === "shared" ||
    (item.privacy === "team" &&
      ["Teammate A", "Teammate B", "Professor"].includes(recipient))
  );
}
export function visible(s: State, item: ContextItem): boolean {
  return item.privacy !== "private" || item.authorId === s.activeMemberId;
}
export function recommend(
  item: ContextItem,
  task: string,
): { level: "critical" | "relevant" | "low"; reason: string } {
  if (
    item.category === "constraint" ||
    (item.category === "decision" && item.status === "confirmed")
  )
    return {
      level: "critical",
      reason: "Approved decisions and constraints govern the recipient’s task.",
    };
  const words = task.toLowerCase().match(/[a-z]{4,}/g) || [];
  const related =
    words.some((w) =>
      (item.content + " " + item.relevance).toLowerCase().includes(w),
    ) || item.category === "brief";
  return related
    ? {
        level: "relevant",
        reason: "Project purpose or task keywords match this context.",
      }
    : {
        level: "low",
        reason: "No task keyword or governing category match; can wait.",
      };
}
function commit(
  s: State,
  projectId: string,
  type: string,
  before: ContextItem[],
  after: ContextItem[],
  tool = "Team",
) {
  const p = s.projects.find((p) => p.id === projectId)!;
  const previousVersion = p.version;
  p.version++;
  s.changes.push({
    id: uid(),
    projectId,
    version: p.version,
    previousVersion,
    actorId: s.activeMemberId,
    tool,
    type,
    entityIds: after.map((i) => i.id),
    timestamp: now(),
    before: structuredClone(before),
    after: structuredClone(after),
  });
  s.versions.push({
    id: uid(),
    projectId,
    version: p.version,
    timestamp: now(),
    items: structuredClone(s.items.filter((i) => i.projectId === projectId)),
  });
  log(
    s,
    type,
    after.map((i) => i.id),
    `v${previousVersion} → v${p.version}`,
  );
}
export type Action =
  | {
      type: "strictness";
      id: string;
      strictness: "Must" | "Prefer";
      ruleType: "Study limits" | "Privacy and sharing";
    }
  | {
      type: "question";
      id: string;
      stage: "Open" | "Exploring" | "Answered";
      assigneeId: string;
      findings: string;
    }
  | { type: "promoteQuestion"; id: string }
  | { type: "undoVote"; id: string }
  | { type: "syncInspect"; id: string }
  | { type: "sourceConflict"; id: string; keepId: string }
  | { type: "personalStart" }
  | { type: "personalTool"; id: string; tool: string }
  | { type: "personalTarget"; id: string; targetId: string }
  | { type: "personalManual"; id: string }
  | { type: "personalOpen"; workspaceId: string }
  | {
      type: "personalNotes";
      id: string;
      text: string;
      eligible: boolean;
      auto: boolean;
    }
  | { type: "personalChat"; id: string; text: string }
  | { type: "personalCategories"; id: string; categories: string[] }
  | { type: "personalDraft"; id: string; after: string; why: string }
  | { type: "personalGenerate"; id: string; origin: string; messageId?: string }
  | { type: "personalDismiss"; id: string }
  | { type: "personalSubmit"; id: string }
  | { type: "personalRebase"; id: string }
  | { type: "member"; id: string }
  | { type: "project"; id: string }
  | {
      type: "add";
      content: string;
      source: string;
      tool: string;
      privacy: Privacy;
    }
  | { type: "vote"; id: string; category: Category }
  | { type: "revote"; id: string }
  | {
      type: "resolveConflict";
      id: string;
      category: Category;
      rationale: string;
    }
  | { type: "comment"; id: string; content: string }
  | {
      type: "proposal";
      targetId: string;
      content: string;
      rationale: string;
      category?: Category;
      privacy?: Privacy;
      tool?: string;
      affectedPeople?: string[];
      affectedTaskIds?: string[];
    }
  | {
      type: "resolve";
      id: string;
      status: "approved" | "rejected" | "revision";
    }
  | { type: "handoff"; recipient: string; task: string; ids: string[] }
  | { type: "load"; id: string }
  | { type: "progress"; id: string; content: string; missing: boolean }
  | {
      type: "feedback";
      id: string;
      content: string;
      rationale: string;
      category: Category;
    }
  | {
      type: "sync";
      id: string;
      ids: string[];
      outcome: "approved" | "declined" | "deferred";
    }
  | { type: "role"; id: string; role: "owner" | "editor" | "viewer" }
  | { type: "addMember"; name: string }
  | {
      type: "study";
      condition: "Baseline" | "Crossville";
      scenario: string;
      active: boolean;
    }
  | { type: "baseline"; text: string }
  | { type: "studyStart" }
  | { type: "studyComplete" }
  | { type: "selection"; id: string; included: boolean }
  | { type: "reset"; scenario: string };
export function consensus(s: State, id: string) {
  const item = s.items.find((i) => i.id === id)!;
  const p = s.projects.find((p) => p.id === item.projectId)!;
  const eligible = s.members.filter(
    (m) => p.memberIds.includes(m.id) && m.role !== "viewer",
  );
  const votes = s.votes.filter(
    (v) =>
      v.itemId === id &&
      v.round === (s.rounds[id] || 1) &&
      eligible.some((m) => m.id === v.memberId),
  );
  const conflict = new Set(votes.map((v) => v.category)).size > 1;
  return {
    votes,
    required: eligible.length,
    conflict,
    agreed: votes.length === eligible.length && !conflict && votes.length > 0,
  };
}
export function packet(
  s: State,
  recipient: string,
  task: string,
  ids: string[],
): HandoffPacket {
  const p = s.projects.find((p) => p.id === s.activeProjectId)!;
  const candidates = s.items.filter((i) => i.projectId === p.id);
  if (
    s.conflicts.some(
      (c) =>
        c.projectId === p.id &&
        c.status === "unresolved" &&
        c.itemIds.some((id) => ids.includes(id)),
    )
  )
    throw Error(
      "Resolve selected source conflicts before generating a packet.",
    );
  const items = structuredClone(
    candidates.filter(
      (i) =>
        ids.includes(i.id) &&
        permitted(i, recipient) &&
        i.category !== "inbox" &&
        i.status === "confirmed",
    ),
  );
  const excluded = candidates
    .filter((i) => !items.some((x) => x.id === i.id))
    .map((i) => ({
      id: permitted(i, recipient) ? i.id : "restricted",
      reason: !permitted(i, recipient)
        ? "Privacy restriction"
        : i.category === "inbox" || i.status !== "confirmed"
          ? "Awaiting team validation"
          : "Not selected",
    }));
  const purpose =
    candidates.find(
      (i) =>
        i.category === "brief" && permitted(i, recipient) && ids.includes(i.id),
    )?.content || "Project purpose omitted by sender.";
  const result: HandoffPacket = {
    id: uid(),
    projectId: p.id,
    projectVersion: p.version,
    recipient,
    task,
    purpose,
    items,
    excluded,
    nextAction:
      "Inspect context, identify missing details, then record progress and submit findings for review.",
    timestamp: now(),
    text: "",
  };
  result.text = JSON.stringify(
    {
      ...result,
      text: undefined,
      currentState: `${p.name} v${p.version}`,
      currentProgress: items.flatMap((i) => (i.progress ? [i.progress] : [])),
      milestoneDetails: items.flatMap((i) =>
        i.milestone ? [i.milestone] : [],
      ),
      recipientGuidance:
        recipient === "Codex" || recipient === "Cursor"
          ? "Inspect implementation dependencies and validate changes against approved methodology."
          : recipient === "NotebookLM"
            ? "Use the source references to organize evidence; flag missing sources."
            : "Continue the task using only supplied context; flag uncertainty.",
      assumptions:
        "Only selected confirmed context is known. Omitted dependencies are not assumed resolved.",
      dependencies: items
        .flatMap((i) => i.dependencies)
        .map((id) => ({ id, included: items.some((i) => i.id === id) })),
    },
    null,
    2,
  );
  return result;
}
export function syncRecommendations(
  s: State,
  workspaceId: string,
): SyncRecommendation[] {
  const w = s.workspaces.find((w) => w.id === workspaceId);
  if (!w) return [];
  return s.items
    .filter(
      (i) =>
        !s.conflicts.some(
          (c) => c.status === "unresolved" && c.itemIds.includes(i.id),
        ),
    )
    .filter(
      (i) =>
        i.projectId === w.projectId &&
        permitted(i, w.recipient) &&
        i.status === "confirmed" &&
        i.category !== "inbox",
    )
    .filter((i) => {
      const old = w.items.find((x) => x.id === i.id);
      return old
        ? old.version !== i.version
        : s.changes.some(
            (c) =>
              c.projectId === w.projectId &&
              c.version > w.loadedVersion &&
              c.entityIds.includes(i.id),
          );
    })
    .map((i) => {
      const r = recommend(i, w.task);
      return {
        id: `${w.id}:${i.id}:${i.version}`,
        workspaceId: w.id,
        itemId: i.id,
        ...r,
        action:
          r.level === "critical"
            ? "Immediate review"
            : r.level === "relevant"
              ? "Defer until a task boundary"
              : "No interruption",
        before: structuredClone(w.items.find((x) => x.id === i.id)),
        after: structuredClone(i),
      };
    });
}
export function transition(state: State, a: Action): State {
  if (a.type === "reset") {
    const fresh = seed(a.scenario);
    fresh.study = {
      ...fresh.study,
      active: state.study.active,
      condition: state.study.condition,
    };
    log(fresh, "scenario_reset");
    return fresh;
  }
  const s = structuredClone(state);
  const me = s.members.find((m) => m.id === s.activeMemberId)!;
  const owner = me.role === "owner";
  const editor = me.role !== "viewer";
  const p = s.projects.find((p) => p.id === s.activeProjectId)!;
  const baseline = s.study.active && s.study.condition === "Baseline";
  if (
    baseline &&
    ![
      "baseline",
      "studyStart",
      "studyComplete",
      "study",
      "reset",
      "member",
      "project",
    ].includes(a.type)
  )
    throw Error(
      "Structured controls are unavailable during the baseline condition.",
    );
  if (a.type === "member") {
    if (!s.members.some((m) => m.id === a.id)) throw Error("Unknown member");
    s.activeMemberId = a.id;
    return s;
  }
  if (a.type === "project") {
    if (!s.projects.some((p) => p.id === a.id)) throw Error("Unknown project");
    s.activeProjectId = a.id;
    return s;
  }
  if (a.type === "strictness") {
    if (!owner) throw Error("Owner review required to change a constraint");
    const i = s.items.find(
      (i) => i.id === a.id && i.category === "constraint" && visible(s, i),
    );
    if (!i) throw Error("Constraint not found");
    const before = structuredClone(i);
    i.strictness = a.strictness;
    i.ruleType = a.ruleType;
    i.version++;
    i.updatedAt = now();
    commit(s, i.projectId, "constraint_strictness_changed", [before], [i]);
    return s;
  }
  if (a.type === "question") {
    if (!editor) throw Error("Editor role required");
    const i = s.items.find(
      (i) => i.id === a.id && i.category === "open_question" && visible(s, i),
    );
    if (!i || i.stage === "Decided")
      throw Error("Question is already decided or unavailable");
    if (a.stage === "Answered" && !a.findings.trim())
      throw Error("Record findings before marking answered");
    const before = structuredClone(i);
    i.stage = a.stage;
    i.assigneeId = a.assigneeId;
    i.findings = a.findings;
    i.version++;
    i.updatedAt = now();
    commit(s, i.projectId, "question_updated", [before], [i]);
    return s;
  }
  if (a.type === "promoteQuestion") {
    const i = s.items.find(
      (i) => i.id === a.id && i.category === "open_question" && visible(s, i),
    );
    if (!i || i.stage !== "Answered" || !i.findings?.trim())
      throw Error(
        "Only answered questions with findings can become a decision",
      );
    if (
      s.decisions.some(
        (d) => d.originQuestionId === i.id && d.status === "pending",
      )
    )
      throw Error("A promotion is already awaiting review");
    const next = transition(s, {
      type: "proposal",
      targetId: "",
      content: i.findings,
      rationale: `Findings for ${i.content}. Source: ${i.source.reference}`,
      category: "decision",
      privacy: i.privacy,
    });
    next.decisions.at(-1)!.originQuestionId = i.id;
    return next;
  }
  if (a.type === "undoVote") {
    const i = s.items.find((i) => i.id === a.id && visible(s, i));
    if (!i || i.category !== "inbox" || !editor)
      throw Error("Only an unsettled inbox vote can be undone");
    s.votes = s.votes.filter(
      (v) =>
        !(
          v.itemId === i.id &&
          v.memberId === me.id &&
          v.round === (s.rounds[i.id] || 1)
        ),
    );
    i.status = consensus(s, i.id).conflict ? "disputed" : "tentative";
    log(s, "sorting_vote_undone", [i.id]);
    return s;
  }
  if (a.type === "syncInspect") {
    const rs = syncRecommendations(s, a.id);
    log(
      s,
      "sync_recommendations",
      rs.map((r) => r.itemId),
      rs.map((r) => `${r.level}: ${r.reason}`).join("; "),
    );
    return s;
  }
  if (a.type === "sourceConflict") {
    const c = s.conflicts.find((c) => c.id === a.id);
    if (
      !c ||
      c.status !== "unresolved" ||
      c.ownerId !== me.id ||
      !editor ||
      !c.itemIds.includes(a.keepId)
    )
      throw Error(
        "Only the source owner with write permission may resolve this conflict.",
      );
    const before = structuredClone(
      s.items.filter((i) => c.itemIds.includes(i.id)),
    );
    for (const i of s.items.filter((i) => c.itemIds.includes(i.id))) {
      i.status = i.id === a.keepId ? "confirmed" : "superseded";
      i.version++;
      i.updatedAt = now();
    }
    c.status = "resolved";
    c.keptId = a.keepId;
    commit(
      s,
      c.projectId,
      "source_conflict_resolved",
      before,
      s.items.filter((i) => c.itemIds.includes(i.id)),
    );
    return s;
  }
  if (a.type === "personalStart") {
    const ids = s.items
      .filter(
        (i) =>
          i.projectId === p.id &&
          i.privacy === "shared" &&
          i.status === "confirmed" &&
          i.category !== "inbox" &&
          !s.conflicts.some(
            (c) => c.status === "unresolved" && c.itemIds.includes(i.id),
          ),
      )
      .map((i) => i.id);
    let next = transition(s, {
      type: "handoff",
      recipient: "Claude",
      task: "Explore this project privately using current approved context.",
      ids,
    });
    next = transition(next, { type: "load", id: next.packets.at(-1)!.id });
    return transition(next, {
      type: "personalOpen",
      workspaceId: next.workspaces.at(-1)!.id,
    });
  }
  if (a.type === "personalOpen") {
    const w = s.workspaces.find((w) => w.id === a.workspaceId)!;
    if (!w) throw Error("Load a packet first");
    const existing = s.personal.find(
      (x) => x.projectId === w.projectId && x.ownerId === me.id,
    );
    const pk = {
      projectId: w.projectId,
      projectVersion: w.loadedVersion,
      tool: w.recipient,
      task: w.task,
      items: w.items.map(personalItem),
    };
    if (existing) {
      existing.tool = w.recipient;
      existing.contextVersion = w.loadedVersion;
      existing.snapshotItems = pk.items;
      existing.includedCategories = [
        ...new Set(pk.items.map((i) => i.category)),
      ];
    } else
      s.personal.push(
        createPersonalWorkspace(privateProject(s, w.projectId), me, pk),
      );
    log(s, "private_workspace_loaded", [w.id]);
    return s;
  }
  if (a.type.startsWith("personal") && "id" in a) {
    const session = s.personal.find(
      (x) => x.id === a.id && x.ownerId === me.id,
    );
    if (!session) throw Error("Open your private workspace first");
    const project = privateProject(s, session.projectId);
    if (a.type === "personalTool") session.tool = a.tool;
    if (a.type === "personalManual") {
      const target =
        session.snapshotItems.find((i) => i.category === "decisions") ||
        session.snapshotItems[0];
      if (!target) throw Error("Load context first");
      session.draft = {
        id: uid(),
        itemId: target.id,
        category: target.category,
        before: target.content,
        after: "",
        why: "",
        baseVersion: session.contextVersion,
        sourceTool: session.tool,
        origin: "manual",
        originMessageId: null,
        fingerprint: "manual",
        edited: true,
        rebased: false,
        createdAt: now(),
        proposalId: null,
      };
    }
    if (a.type === "personalTarget" && session.draft) {
      const target = session.snapshotItems.find((i) => i.id === a.targetId);
      if (!target) throw Error("Choose loaded context");
      session.draft.itemId = target.id;
      session.draft.before = target.content;
      session.draft.category = target.category;
      session.draft.baseVersion = session.contextVersion;
      session.draft.edited = true;
    }
    if (a.type === "personalNotes") {
      session.notes = a.text;
      session.notesEligible = a.eligible;
      session.autoManage = a.auto;
      session.draft = deriveContextDraft(project, session, "notes");
    }
    if (a.type === "personalCategories")
      session.includedCategories = a.categories;
    if (a.type === "personalChat") {
      if (!a.text.trim()) throw Error("Enter a message");
      session.messages.push({
        id: uid(),
        role: "user",
        text: a.text,
        time: now(),
        contextVersion: session.contextVersion,
      });
      session.messages.push(simulatePrivateReply(session, a.text));
      session.draft = deriveContextDraft(project, session, "chat");
    }
    if (a.type === "personalDraft" && session.draft) {
      if (session.draft.proposalId)
        throw Error(
          "Revise or start a new draft before editing a submitted proposal.",
        );
      session.draft.after = a.after;
      session.draft.why = a.why;
      session.draft.edited = true;
    }
    if (a.type === "personalGenerate") {
      if (session.draft?.proposalId) session.draft = null;
      const selectedIndex = a.messageId
        ? session.messages.findIndex((m) => m.id === a.messageId)
        : -1;
      const input =
        selectedIndex >= 0
          ? {
              ...session,
              messages: session.messages.slice(0, selectedIndex + 1),
            }
          : session;
      session.draft = deriveContextDraft(project, input, a.origin, {
        force: true,
      });
    }
    if (a.type === "personalDismiss") {
      session.dismissedFingerprint = session.draft?.fingerprint;
      session.draft = null;
    }
    if (a.type === "personalRebase" && session.draft) {
      const current = s.items.find((i) => i.id === session.draft!.itemId);
      const loaded = session.snapshotItems.find((i) => i.id === current?.id);
      if (!current || loaded?.revision !== current.version)
        throw Error(
          "Approve synchronization and load the updated workspace first",
        );
      session.draft.before = current.content;
      session.draft.baseVersion = project.version;
      session.draft.rebased = true;
      session.draft.proposalId = null;
    }
    if (a.type === "personalSubmit") {
      const payload = submitDraftPayload(project, session, me);
      const next = transition(s, {
        type: "proposal",
        targetId: payload.itemId,
        content: payload.after,
        rationale: payload.why,
        tool: payload.sourceTool,
      });
      next.personal.find((x) => x.id === session.id)!.draft!.proposalId =
        next.decisions.at(-1)!.id;
      return next;
    }
    log(s, a.type, [session.id]);
    return s;
  }
  if (a.type === "selection") {
    log(s, a.included ? "context_included" : "context_excluded", [a.id]);
    return s;
  }
  if (a.type === "study") {
    if (s.study.started && !s.study.complete)
      throw Error("Complete the current task before changing condition.");
    s.study = {
      ...s.study,
      ...a,
      sessionId: uid(),
      started: false,
      complete: false,
    };
    log(s, "study_configured");
    return s;
  }
  if (a.type === "baseline") {
    s.study.baseline = a.text;
    log(s, "manual_summary_edited");
    return s;
  }
  if (a.type === "studyStart") {
    if (!s.study.active || s.study.started)
      throw Error(
        "Apply a fresh study condition or reset before starting another task.",
      );
    s.study.started = true;
    log(s, "task_started");
    return s;
  }
  if (a.type === "studyComplete") {
    if (!s.study.started || s.study.complete)
      throw Error("Start an unfinished task first.");
    s.study.complete = true;
    log(s, "task_completed");
    return s;
  }
  if (a.type === "role") {
    if (!owner) throw Error("Owner role required");
    const m = s.members.find((m) => m.id === a.id)!;
    if (
      m.role === "owner" &&
      a.role !== "owner" &&
      s.members.filter((m) => m.role === "owner").length === 1
    )
      throw Error("Keep at least one owner");
    m.role = a.role;
    log(s, "role_changed", [m.id]);
    return s;
  }
  if (a.type === "addMember") {
    if (!owner) throw Error("Owner role required");
    const id = uid();
    s.members.push({ id, name: a.name, role: "editor", personalNotes: [] });
    p.memberIds.push(id);
    log(s, "member_added", [id]);
    return s;
  }
  if (a.type === "add") {
    if (!editor || !a.content.trim())
      throw Error("Editor role and content required");
    const i: ContextItem = {
      id: uid(),
      projectId: p.id,
      content: a.content,
      category: "inbox",
      source: {
        id: uid(),
        label: a.source || "Conversation capture",
        reference: a.source || "local://capture",
        tool: a.tool,
      },
      authorId: me.id,
      createdAt: now(),
      updatedAt: now(),
      version: 1,
      privacy: a.privacy,
      status: "tentative",
      relevance: "research prototype",
      dependencies: [],
      rationale: "",
    };
    s.items.push(i);
    log(s, "memory_captured", [i.id]);
    return s;
  }
  if (a.type === "comment") {
    if (!a.content.trim()) throw Error("Comment cannot be empty");
    s.comments.push({
      id: uid(),
      entityId: a.id,
      memberId: me.id,
      content: a.content,
      timestamp: now(),
    });
    log(s, "comment_added", [a.id]);
    return s;
  }
  if (
    a.type === "vote" ||
    a.type === "revote" ||
    a.type === "resolveConflict"
  ) {
    if (!editor) throw Error("Editor role required");
    const i = s.items.find((i) => i.id === a.id && visible(s, i))!;
    if (!i || i.category !== "inbox") throw Error("Select an inbox memory");
    const before = structuredClone(i);
    if (a.type === "revote") {
      s.rounds[i.id] = (s.rounds[i.id] || 1) + 1;
      i.status = "tentative";
      log(s, "revote_started", [i.id]);
      return s;
    }
    if (a.type === "resolveConflict") {
      if (!owner || !a.rationale.trim())
        throw Error("Owner and resolution rationale required");
      i.category = a.category;
      i.rationale = a.rationale;
      i.status = "confirmed";
      i.version++;
      i.updatedAt = now();
      commit(s, i.projectId, "conflict_resolved", [before], [i]);
      return s;
    }
    if (a.category === "inbox") throw Error("Choose a destination category");
    const round = s.rounds[i.id] || 1;
    s.votes = s.votes.filter(
      (v) => !(v.itemId === i.id && v.memberId === me.id && v.round === round),
    );
    s.votes.push({
      id: uid(),
      itemId: i.id,
      memberId: me.id,
      category: a.category,
      round,
    });
    const c = consensus(s, i.id);
    log(s, "sorting_vote", [i.id], a.category);
    if (c.conflict) {
      i.status = "disputed";
      log(s, "conflict_detected", [i.id]);
    } else if (c.agreed) {
      i.category = a.category;
      i.status = "confirmed";
      i.version++;
      i.updatedAt = now();
      commit(s, i.projectId, "consensus_reached", [before], [i]);
    } else i.status = "tentative";
    return s;
  }
  if (a.type === "proposal") {
    if (!editor || !a.content.trim() || !a.rationale.trim())
      throw Error("Editor role, content and rationale required");
    const target = s.items.find(
      (i) => i.id === a.targetId && i.projectId === p.id && visible(s, i),
    );
    if (a.targetId && !target) throw Error("Unknown context item");
    if (target?.privacy === "private")
      throw Error(
        "Private notes stay private. Capture a separately reviewed shared candidate instead.",
      );
    const d: Decision = {
      id: uid(),
      projectId: p.id,
      targetId: a.targetId,
      before: target?.content || "",
      content: a.content,
      rationale: a.rationale,
      status: "pending",
      authorId: me.id,
      baseVersion: target?.version || 0,
      affectedPeople: a.affectedPeople || p.memberIds,
      affectedTaskIds:
        a.affectedTaskIds ||
        p.tasks
          .filter((t) => t.dependsOnMemoryIds.includes(a.targetId))
          .map((t) => t.id),
      category: a.category || target?.category || "decision",
      privacy: target?.privacy || a.privacy || "shared",
      source: {
        id: uid(),
        label: "Reviewed proposal",
        reference: `local://proposal/${uid()}`,
        tool: a.tool || "Team",
      },
    };
    s.decisions.push(d);
    log(s, "proposal_submitted", [d.id]);
    return s;
  }
  if (a.type === "resolve") {
    if (!owner) throw Error("Owner approval required");
    const d = s.decisions.find((d) => d.id === a.id)!;
    if (!d || d.status !== "pending") throw Error("Proposal is not pending");
    const target = s.items.find((i) => i.id === d.targetId);
    if (a.status === "approved" && target && target.version !== d.baseVersion)
      throw Error(
        "Conflicting version: request revision and resubmit against current context.",
      );
    d.status = a.status;
    if (a.status === "approved") {
      const before = target ? [structuredClone(target)] : [];
      const stamp = now();
      const item: ContextItem = {
        id: target?.id || uid(),
        projectId: d.projectId,
        content: d.content,
        category: d.category === "inbox" ? "fact" : d.category,
        authorId: d.authorId,
        source: d.source,
        createdAt: target?.createdAt || stamp,
        updatedAt: stamp,
        version: (target?.version || 0) + 1,
        privacy: d.privacy,
        status: "confirmed",
        relevance: target?.relevance || "research prototype requirement",
        dependencies: target?.dependencies || [],
        rationale: d.rationale,
        ...(target?.strictness
          ? { strictness: target.strictness, ruleType: target.ruleType }
          : {}),
        ...(target?.stage
          ? {
              stage: target.stage,
              assigneeId: target.assigneeId,
              findings: target.findings,
            }
          : {}),
        ...(target?.progress ? { progress: target.progress } : {}),
        ...(target?.milestone
          ? {
              milestone: {
                ...target.milestone,
                currentApproach: d.content,
                rationale: d.rationale,
                result: "Approved; awaiting pilot validation.",
              },
            }
          : {}),
      };
      s.items = s.items.filter((i) => i.id !== item.id);
      s.items.push(item);
      const project = s.projects.find((p) => p.id === d.projectId)!;
      project.tasks = project.tasks.map((t) =>
        d.affectedTaskIds.includes(t.id) ? { ...t, status: "Needs update" } : t,
      );
      if (d.originQuestionId) {
        const q = s.items.find((i) => i.id === d.originQuestionId)!;
        before.push(structuredClone(q));
        q.stage = "Decided";
        q.linkedDecisionId = item.id;
        q.version++;
        q.updatedAt = now();
        commit(
          s,
          d.projectId,
          "question_promoted",
          before,
          [item, q],
          d.source.tool,
        );
      } else
        commit(
          s,
          d.projectId,
          "proposal_approved",
          before,
          [item],
          d.source.tool,
        );
    } else log(s, `proposal_${a.status}`, [d.id]);
    return s;
  }
  if (a.type === "handoff") {
    if (!a.task.trim()) throw Error("Describe the recipient task");
    const pk = packet(s, a.recipient, a.task, a.ids);
    if (!pk.items.length) throw Error("Select confirmed, permitted context");
    s.packets.push(pk);
    log(
      s,
      "handoff_created",
      pk.items.map((i) => i.id),
      pk.id,
    );
    return s;
  }
  if (a.type === "load") {
    const pk = s.packets.find((p) => p.id === a.id)!;
    if (!pk) throw Error("Packet not found");
    const w = {
      id: uid(),
      projectId: pk.projectId,
      recipient: pk.recipient,
      task: pk.task,
      packetId: pk.id,
      loadedVersion: pk.projectVersion,
      items: structuredClone(pk.items),
      progress: [],
      missing: [],
    };
    s.workspaces.push(w);
    s.receipts.push({
      id: uid(),
      packetId: pk.id,
      workspaceId: w.id,
      timestamp: now(),
    });
    log(s, "packet_received", [pk.id, w.id]);
    return s;
  }
  if (a.type === "progress") {
    const w = s.workspaces.find((w) => w.id === a.id)!;
    if (!w || !a.content.trim()) throw Error("Enter a progress note");
    if (a.missing) w.missing.push(a.content);
    else w.progress.push({ content: a.content, timestamp: now() });
    log(
      s,
      a.missing ? "missing_context_reported" : "task_progress",
      [w.id],
      a.content,
    );
    return s;
  }
  if (a.type === "feedback") {
    const w = s.workspaces.find((w) => w.id === a.id)!;
    if (!w) throw Error("Workspace not found");
    return transition(s, {
      type: "proposal",
      targetId: "",
      content: a.content,
      rationale: a.rationale,
      category: a.category,
      tool: w.recipient,
    });
  }
  if (a.type === "sync") {
    const w = s.workspaces.find((w) => w.id === a.id)!;
    if (!w) throw Error("Workspace not found");
    const recs = syncRecommendations(s, w.id);
    const chosen = recs.filter((r) => a.ids.includes(r.itemId));
    if (a.outcome === "approved" && !chosen.length)
      throw Error("Choose changes to apply");
    if (a.outcome === "approved") {
      for (const r of chosen) {
        w.items = w.items.filter((i) => i.id !== r.itemId);
        w.items.push(structuredClone(r.after));
      }
      if (syncRecommendations(s, w.id).length === 0)
        w.loadedVersion = s.projects.find((p) => p.id === w.projectId)!.version;
    }
    s.syncEvents.push({
      id: uid(),
      workspaceId: w.id,
      itemIds: chosen.map((r) => r.itemId),
      outcome: a.outcome,
      timestamp: now(),
      version: s.projects.find((p) => p.id === w.projectId)!.version,
    });
    log(
      s,
      `sync_${a.outcome}`,
      chosen.map((r) => r.itemId),
    );
    return s;
  }
  return s;
}
export function csv(s: State): string {
  const keys = [
    "sessionId",
    "condition",
    "scenario",
    "timestamp",
    "type",
    "itemIds",
    "actorId",
    "detail",
  ] as const;
  return [
    keys.join(","),
    ...s.logs.map((e) =>
      keys
        .map(
          (k) =>
            '"' +
            String(Array.isArray(e[k]) ? e[k].join(";") : e[k]).replaceAll(
              '"',
              '""',
            ) +
            '"',
        )
        .join(","),
    ),
  ].join("\r\n");
}

export function personalItem(i: ContextItem): PersonalItem {
  const cat: Record<string, string> = {
    decision: "decisions",
    constraint: "constraints",
    open_question: "questions",
  };
  return {
    id: i.id,
    title: i.content.slice(0, 60),
    content: i.content,
    category: cat[i.category] || i.category,
    access: i.privacy === "private" ? "private" : "shared",
    status: i.status === "confirmed" ? "active" : i.status,
    revision: i.version,
    source: structuredClone(i.source),
  };
}
export function privateProject(s: State, id: string) {
  return {
    id,
    version: s.projects.find((p) => p.id === id)!.version,
    items: s.items.filter((i) => i.projectId === id).map(personalItem),
    conflicts: s.conflicts.filter((c) => c.projectId === id),
  };
}
