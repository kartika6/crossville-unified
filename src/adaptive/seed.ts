import { seed as legacySeed } from "../engine.ts";
import type { State, ContextItem } from "../model.ts";
import type {
  AdaptiveState,
  Recipient,
  WorkTask,
  Tool,
  ItemMetadata,
} from "./types.ts";
import { selectContext } from "./selection.ts";
export const id = () => crypto.randomUUID();
export const timestamp = () => new Date().toISOString();
export const APPROACH =
  "Could we switch from a short pilot to an action research approach where we study how our own team uses AI tools?";
export const UPDATE =
  "Add pause, slow-down and step controls for observing automation. Also show when context is private, proposed or approved in the prototype.";
export const QUESTION =
  "Should automatic context updates interrupt an agent currently performing a long task?";
export const personName = (s: AdaptiveState, personId: string) =>
  s.base.members.find((m) => m.id === personId)?.name || personId;
export function makeTask(
  personId: string,
  tool: Tool,
  projectId: string,
  title?: string,
): WorkTask {
  const development = ["Codex", "Cursor"].includes(tool);
  return {
    id: `task:${projectId}:${personId}:${tool}:${title || "default"}`,
    projectId,
    title:
      title ||
      (development
        ? "Continue prototype development"
        : "Explore the research approach"),
    assignedPerson: personId,
    tool,
    categories: ["brief", "decision", "constraint", "fact", "open_question"],
    requiredDecisionIds: ["method"],
    requiredConstraintIds: ["constraints"],
    tags: development
      ? ["prototype", "technical", "methodology", "privacy"]
      : ["research", "methodology", "privacy"],
    status: "working",
    currentContextVersion: 0,
  };
}
export function blankRecipient(
  personId: string,
  tool: Tool,
  projectId: string,
): Recipient {
  return {
    id: `${projectId}:${personId}:${tool}`,
    projectId,
    personId,
    tool,
    workspaceId: null,
    task: null,
    messages: [],
    notes: "",
    notesEligible: false,
    candidateIds: [],
    status: "Ready for a task",
    evaluatedVersion: 0,
    held: [],
    deferred: [],
    coverage: {},
  };
}
export function bootstrap(s: AdaptiveState, r: Recipient) {
  r.task = makeTask(r.personId, r.tool, r.projectId);
  const p = s.base.projects.find((p) => p.id === r.projectId)!;
  const selected = selectContext(s, r);
  const items = selected
    .filter((x) => x.disposition === "included" && x.item)
    .map((x) => x.item!);
  const pkid = id();
  const wid = id();
  s.base.packets.push({
    id: pkid,
    projectId: r.projectId,
    projectVersion: p.version,
    recipient: r.tool,
    task: r.task.title,
    purpose: items.find((i) => i.category === "brief")?.content || "",
    items: structuredClone(items),
    excluded: selected
      .filter((x) => x.disposition !== "included")
      .map((x) => ({ id: x.itemId, reason: x.reason })),
    nextAction: r.task.title,
    timestamp: timestamp(),
    text: JSON.stringify(
      { task: r.task.title, version: p.version, items },
      null,
      2,
    ),
  });
  s.base.workspaces.push({
    id: wid,
    projectId: r.projectId,
    recipient: r.tool,
    task: r.task.title,
    packetId: pkid,
    loadedVersion: p.version,
    items: structuredClone(items),
    progress: [],
    missing: [],
  });
  s.base.receipts.push({
    id: id(),
    packetId: pkid,
    workspaceId: wid,
    timestamp: timestamp(),
  });
  r.workspaceId = wid;
  r.evaluatedVersion = p.version;
  r.task.currentContextVersion = p.version;
  r.lastTaskKey = `${r.task.id}:${p.version}`;
  r.status = "Up to date";
}
export function adaptiveSeed(existing?: State): AdaptiveState {
  const base = existing ? structuredClone(existing) : legacySeed();
  const meta: Record<string, ItemMetadata> = {};
  if (!existing) {
    base.decisions = [];
    base.logs = [];
    base.packets = [];
    base.workspaces = [];
    base.receipts = [];
    base.changes = [];
    base.syncEvents = [];
    base.personal = [];
    const method = base.items.find((i) => i.id === "method")!;
    method.content =
      "Run an agreed two-week pilot with our own team to study how project context flows.";
    method.rationale =
      "A bounded pilot gives us comparable observations before expanding the approach.";
    method.milestone = {
      name: "Choose the research methodology",
      originalPlan: "Two-week pilot",
      currentApproach: method.content,
      rationale: method.rationale,
      result: "Agreed by the team",
      openIssues: "Should the study expand?",
    };
    const add = (
      key: string,
      content: string,
      tags: string[],
      importance: ItemMetadata["importance"],
    ) => {
      const i: ContextItem = {
        id: key,
        projectId: "study",
        content,
        category: "fact",
        authorId: "you",
        source: {
          id: `source-${key}`,
          label: "Prototype planning · approved",
          reference: `conversation://prototype-plan/${key}`,
          tool: "ChatGPT",
        },
        createdAt: timestamp(),
        updatedAt: timestamp(),
        version: 1,
        privacy: "shared",
        status: "confirmed",
        relevance: tags.join(" "),
        dependencies: ["method", "constraints"],
        rationale: "Agreed prototype scope.",
      };
      base.items.push(i);
      meta[key] = { tags, importance, sensitivity: "normal" };
    };
    add(
      "prototype-requirement",
      "Build an interactive context handoff prototype with separate shared and private workspaces.",
      ["prototype"],
      "critical",
    );
    add(
      "technical-requirement",
      "Use React and TypeScript, local persistence, accessible controls and simulated AI responses.",
      ["prototype", "technical"],
      "relevant",
    );
    add(
      "prototype-progress",
      "The core workspace and review flow are built. Automated task continuity is the next implementation task.",
      ["prototype"],
      "relevant",
    );
    add(
      "unrelated-lunch",
      "The team’s next informal lunch is on Friday.",
      ["social"],
      "unrelated",
    );
    base.versions = base.projects.map((p) => ({
      id: id(),
      projectId: p.id,
      version: p.version,
      timestamp: timestamp(),
      items: structuredClone(base.items.filter((i) => i.projectId === p.id)),
    }));
  }
  for (const i of base.items)
    if (!meta[i.id])
      meta[i.id] = {
        tags:
          i.category === "brief"
            ? ["research", "prototype"]
            : i.id === "method"
              ? ["research", "methodology", "prototype"]
              : i.category === "constraint"
                ? ["privacy", "research"]
                : i.category === "open_question"
                  ? ["research"]
                  : [],
        importance: i.category === "constraint" ? "critical" : "relevant",
        sensitivity: "normal",
      };
  const s: AdaptiveState = {
    schema: 2,
    base,
    metadata: meta,
    recipients: [],
    candidates: [],
    patches: {},
    jobs: [],
    events: [],
    policy: {
      routine: "automatic",
      critical: "approval",
      allowTeam: false,
      proposeFeedback: true,
      revision: 1,
    },
    controls: { paused: false, slow: false },
    study: {
      condition: "explainable",
      sessionId: id(),
      scenario: "Shared Context Study · adaptive handoff",
      started: false,
      complete: false,
    },
    story: { active: !existing, step: 0 },
    view: {
      page: "Shared workspace",
      tool: "Claude",
      actorId: base.activeMemberId,
      inspector: false,
    },
    migrationNotice: !!existing,
  };
  if (!existing) {
    for (const [person, tool] of [
      ["you", "Claude"],
      ["you", "ChatGPT"],
      ["teammate-a", "Claude"],
      ["teammate-b", "NotebookLM"],
    ] as [string, Tool][]) {
      const r = blankRecipient(person, tool, "study");
      bootstrap(s, r);
      s.recipients.push(r);
    }
  } else {
    for (const w of base.workspaces) {
      const r = blankRecipient(
        base.activeMemberId,
        [
          "ChatGPT",
          "Claude",
          "Gemini",
          "Codex",
          "Cursor",
          "NotebookLM",
        ].includes(w.recipient)
          ? (w.recipient as Tool)
          : "Claude",
        w.projectId,
      );
      if (s.recipients.some((x) => x.id === r.id)) continue;
      r.workspaceId = w.id;
      r.task = makeTask(r.personId, r.tool, r.projectId, w.task);
      r.task.currentContextVersion = w.loadedVersion;
      r.evaluatedVersion = w.loadedVersion;
      r.status = "Imported working context";
      s.recipients.push(r);
    }
  }
  return s;
}
