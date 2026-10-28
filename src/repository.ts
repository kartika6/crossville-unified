import { seed } from "./engine.ts";
import type { State } from "./model.ts";
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const storageKey = "crossville-unified-v1";
type RecordValue = Record<string, unknown>;
const record = (x: unknown): x is RecordValue =>
  !!x && typeof x === "object" && !Array.isArray(x);
const strings = (x: RecordValue, keys: string[]) =>
  keys.every((k) => typeof x[k] === "string");
const stringList = (x: unknown): x is string[] =>
  Array.isArray(x) && x.every((v) => typeof v === "string");
const integer = (x: unknown) => Number.isSafeInteger(x) && Number(x) >= 0;
function source(x: unknown): boolean {
  return record(x) && strings(x, ["id", "label", "reference", "tool"]);
}
function item(x: unknown): boolean {
  return (
    record(x) &&
    strings(x, [
      "id",
      "projectId",
      "content",
      "authorId",
      "createdAt",
      "updatedAt",
      "relevance",
      "rationale",
    ]) &&
    source(x.source) &&
    integer(x.version) &&
    stringList(x.dependencies) &&
    [
      "brief",
      "decision",
      "constraint",
      "open_question",
      "fact",
      "inbox",
    ].includes(String(x.category)) &&
    ["shared", "team", "private"].includes(String(x.privacy)) &&
    ["confirmed", "tentative", "disputed", "superseded"].includes(
      String(x.status),
    ) &&
    (!x.milestone ||
      (record(x.milestone) &&
        strings(x.milestone, [
          "name",
          "currentApproach",
          "rationale",
          "result",
          "openIssues",
        ])))
  );
}
function list(x: unknown, check: (entry: RecordValue) => boolean): boolean {
  return Array.isArray(x) && x.every((v) => record(v) && check(v));
}
function items(x: unknown): boolean {
  return Array.isArray(x) && x.every(item);
}
function personalItem(x: RecordValue): boolean {
  return (
    strings(x, ["id", "title", "content", "category", "access", "status"]) &&
    integer(x.revision) &&
    source(x.source)
  );
}
function personalDraft(x: unknown): boolean {
  return (
    x === null ||
    (record(x) &&
      strings(x, [
        "id",
        "itemId",
        "category",
        "before",
        "after",
        "why",
        "sourceTool",
        "origin",
        "fingerprint",
        "createdAt",
      ]) &&
      integer(x.baseVersion) &&
      typeof x.edited === "boolean" &&
      typeof x.rebased === "boolean" &&
      (x.proposalId === null || typeof x.proposalId === "string"))
  );
}
export function parseState(text: string): State {
  const x: unknown = JSON.parse(text);
  if (!record(x)) throw Error("Expected project data object");
  if (x.schema !== 1) throw Error("Unsupported data schema");
  const checks: Record<string, (v: RecordValue) => boolean> = {
    projects: (v) =>
      strings(v, ["id", "name"]) &&
      integer(v.version) &&
      stringList(v.memberIds) &&
      list(
        v.tasks,
        (t) =>
          strings(t, ["id", "title", "owner", "agent", "status"]) &&
          stringList(t.dependsOnMemoryIds),
      ),
    members: (v) =>
      strings(v, ["id", "name"]) &&
      ["owner", "editor", "viewer"].includes(String(v.role)) &&
      stringList(v.personalNotes),
    items: (v) => item(v),
    decisions: (v) =>
      strings(v, [
        "id",
        "projectId",
        "targetId",
        "before",
        "content",
        "rationale",
        "authorId",
        "category",
        "privacy",
      ]) &&
      source(v.source) &&
      integer(v.baseVersion) &&
      stringList(v.affectedPeople) &&
      stringList(v.affectedTaskIds) &&
      ["pending", "approved", "rejected", "revision"].includes(
        String(v.status),
      ),
    votes: (v) =>
      strings(v, ["id", "itemId", "memberId", "category"]) && integer(v.round),
    comments: (v) =>
      strings(v, ["id", "entityId", "memberId", "content", "timestamp"]),
    versions: (v) =>
      strings(v, ["id", "projectId", "timestamp"]) &&
      integer(v.version) &&
      items(v.items),
    packets: (v) =>
      strings(v, [
        "id",
        "projectId",
        "recipient",
        "task",
        "purpose",
        "nextAction",
        "timestamp",
        "text",
      ]) &&
      integer(v.projectVersion) &&
      items(v.items) &&
      list(v.excluded, (e) => strings(e, ["id", "reason"])),
    workspaces: (v) =>
      strings(v, ["id", "projectId", "recipient", "task", "packetId"]) &&
      integer(v.loadedVersion) &&
      items(v.items) &&
      list(v.progress, (p) => strings(p, ["content", "timestamp"])) &&
      stringList(v.missing),
    receipts: (v) => strings(v, ["id", "packetId", "workspaceId", "timestamp"]),
    changes: (v) =>
      strings(v, ["id", "projectId", "actorId", "tool", "type", "timestamp"]) &&
      integer(v.version) &&
      integer(v.previousVersion) &&
      stringList(v.entityIds) &&
      items(v.before) &&
      items(v.after),
    syncEvents: (v) =>
      strings(v, ["id", "workspaceId", "timestamp"]) &&
      integer(v.version) &&
      stringList(v.itemIds) &&
      ["approved", "declined", "deferred"].includes(String(v.outcome)),
    logs: (v) =>
      strings(v, [
        "id",
        "sessionId",
        "scenario",
        "timestamp",
        "type",
        "actorId",
        "detail",
      ]) &&
      stringList(v.itemIds) &&
      ["Baseline", "Crossville"].includes(String(v.condition)),
    conflicts: (v) =>
      strings(v, ["id", "projectId", "title", "ownerId"]) &&
      stringList(v.itemIds) &&
      ["unresolved", "resolved"].includes(String(v.status)),
    personal: (v) =>
      strings(v, [
        "id",
        "projectId",
        "ownerId",
        "tool",
        "notes",
        "managerState",
        "updatedAt",
      ]) &&
      integer(v.contextVersion) &&
      integer(v.withheldCount) &&
      list(v.snapshotItems, personalItem) &&
      stringList(v.includedCategories) &&
      typeof v.notesEligible === "boolean" &&
      typeof v.autoManage === "boolean" &&
      personalDraft(v.draft) &&
      list(
        v.messages,
        (m) =>
          strings(m, ["id", "text", "time"]) &&
          ["user", "assistant"].includes(String(m.role)) &&
          integer(m.contextVersion) &&
          (!m.itemIds || stringList(m.itemIds)) &&
          (!m.steps || list(m.steps, (t) => strings(t, ["title", "text"]))),
      ),
  };
  for (const [name, check] of Object.entries(checks)) {
    if (!list(x[name], check))
      throw Error(`Invalid or missing collection: ${name}`);
    const ids = (x[name] as RecordValue[]).map((v) => v.id);
    if (new Set(ids).size !== ids.length)
      throw Error(`Invalid duplicate IDs in ${name}`);
  }
  if (
    !record(x.study) ||
    !strings(x.study, ["sessionId", "scenario", "baseline"]) ||
    !["Baseline", "Crossville"].includes(String(x.study.condition)) ||
    !["active", "started", "complete"].every(
      (k) => typeof (x.study as RecordValue)[k] === "boolean",
    ) ||
    !record(x.rounds) ||
    !Object.values(x.rounds).every(integer)
  )
    throw Error("Invalid study or vote rounds");
  if (
    x.sourceActivity &&
    !list(x.sourceActivity, (v) =>
      strings(v, ["id", "projectId", "actor", "tool", "content", "timestamp"]),
    )
  )
    throw Error("Invalid source activity");
  const s = x as unknown as State;
  const projectIds = new Set(s.projects.map((p) => p.id)),
    memberIds = new Set(s.members.map((m) => m.id));
  if (
    !projectIds.has(s.activeProjectId) ||
    !memberIds.has(s.activeMemberId) ||
    !s.members.some((m) => m.role === "owner")
  )
    throw Error("Invalid project or member selection");
  for (const p of s.projects)
    if (!p.memberIds.every((id) => memberIds.has(id)))
      throw Error("Invalid project members");
  for (const i of s.items)
    if (!projectIds.has(i.projectId) || !memberIds.has(i.authorId))
      throw Error("Invalid context item relation");
  const packetIds = new Set(s.packets.map((p) => p.id)),
    workspaceIds = new Set(s.workspaces.map((w) => w.id));
  for (const w of s.workspaces)
    if (!projectIds.has(w.projectId) || !packetIds.has(w.packetId))
      throw Error("Invalid recipient workspace relation");
  for (const receipt of s.receipts)
    if (
      !packetIds.has(receipt.packetId) ||
      !workspaceIds.has(receipt.workspaceId)
    )
      throw Error("Invalid handoff receipt");
  for (const session of s.personal)
    if (!projectIds.has(session.projectId) || !memberIds.has(session.ownerId))
      throw Error("Invalid private workspace relation");
  return s;
}
export class LocalRepository {
  private storage: StoragePort;
  constructor(storage: StoragePort) {
    this.storage = storage;
  }
  load(): State {
    const text = this.storage.getItem(storageKey);
    return text ? parseState(text) : seed();
  }
  save(s: State) {
    this.storage.setItem(storageKey, JSON.stringify(s));
  }
}
export function download(
  name: string,
  data: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
