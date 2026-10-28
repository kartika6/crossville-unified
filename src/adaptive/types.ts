import type { State, ContextItem, Category, Privacy } from "../model.ts";
export type Condition = "manual" | "opaque" | "explainable";
export type Importance = "critical" | "relevant" | "unrelated";
export type SyncPolicy = "automatic" | "notify" | "approval";
export type Tool =
  | "ChatGPT"
  | "Claude"
  | "Gemini"
  | "Codex"
  | "Cursor"
  | "NotebookLM";
export const TOOLS: Tool[] = [
  "ChatGPT",
  "Claude",
  "Gemini",
  "Codex",
  "Cursor",
  "NotebookLM",
];
export interface ItemMetadata {
  tags: string[];
  importance: Importance;
  sensitivity: "normal" | "restricted";
}
export interface WorkTask {
  id: string;
  projectId: string;
  title: string;
  assignedPerson: string;
  tool: Tool;
  categories: Category[];
  requiredDecisionIds: string[];
  requiredConstraintIds: string[];
  tags: string[];
  status: "ready" | "working" | "completed";
  currentContextVersion: number;
}
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  contextVersion: number;
  sourceIds: string[];
}
export interface Patch {
  targetId: string;
  content: string;
  category: Category;
  rationale: string;
  baseVersion: number;
  tags: string[];
  importance: Importance;
  privacy: Privacy;
}
export interface Candidate {
  id: string;
  projectId: string;
  recipientId: string;
  ownerId: string;
  tool: Tool;
  sourceRef: string;
  patches: Patch[];
  state: "private" | "proposed" | "dismissed";
  proposalId?: string;
}
export interface Selection {
  itemId: string;
  content: string;
  sourceRef: string;
  disposition: "included" | "withheld" | "deferred";
  importance: Importance;
  reason: string;
  item?: ContextItem;
}
export interface Delta extends Selection {
  before?: ContextItem;
  operation: "upsert" | "remove";
  outcome:
    | "automatic"
    | "held"
    | "notified"
    | "deferred"
    | "excluded"
    | "applied";
  changeIds: string[];
}
export interface Recipient {
  id: string;
  projectId: string;
  personId: string;
  tool: Tool;
  workspaceId: string | null;
  task: WorkTask | null;
  messages: ChatMessage[];
  notes: string;
  notesEligible: boolean;
  candidateIds: string[];
  status: string;
  evaluatedVersion: number;
  held: Delta[];
  deferred: Delta[];
  coverage: Record<string, "applied" | "held" | "deferred" | "excluded">;
  latestJobId?: string;
  lastTaskKey?: string;
}
export interface Policy {
  routine: SyncPolicy;
  critical: SyncPolicy;
  allowTeam: boolean;
  proposeFeedback: boolean;
  revision: number;
}
export interface AutomationJob {
  id: string;
  key: string;
  kind: "handoff" | "sync";
  recipientId: string;
  projectId: string;
  sourceVersion: number;
  sourceItems: ContextItem[];
  stage: number;
  status: "queued" | "running" | "complete" | "blocked";
  trigger: string;
  policy: Policy;
  selection: Selection[];
  deltas: Delta[];
  packetId?: string;
  createdAt: string;
  completedAt?: string;
  forceApproval?: boolean;
}
export interface SimulationEvent {
  id: string;
  sessionId: string;
  condition: Condition;
  scenario: string;
  taskId: string;
  recipientId: string;
  recipientVersion: number;
  timestamp: string;
  type: string;
  itemIds: string[];
  detail: string;
}
export interface AdaptiveState {
  schema: 2;
  base: State;
  metadata: Record<string, ItemMetadata>;
  recipients: Recipient[];
  candidates: Candidate[];
  patches: Record<string, Patch[]>;
  jobs: AutomationJob[];
  events: SimulationEvent[];
  policy: Policy;
  controls: { paused: boolean; slow: boolean };
  study: {
    condition: Condition;
    sessionId: string;
    scenario: string;
    started: boolean;
    complete: boolean;
  };
  story: { active: boolean; step: number };
  view: { page: string; tool: Tool; actorId: string; inspector: boolean };
  migrationNotice: boolean;
}
export const STAGES = [
  "Detecting task context",
  "Resolving recipient permissions",
  "Identifying relevant project information",
  "Preparing context snapshot",
  "Transferring through local adapter",
  "Confirming recipient context loaded",
];
export type AutoAction =
  | { type: "OPEN_WORKSPACE"; personId: string; tool: Tool }
  | { type: "NAVIGATE"; page: string }
  | { type: "START_TASK"; recipientId: string; title?: string }
  | { type: "TICK" }
  | { type: "CHAT"; recipientId: string; text: string }
  | {
      type: "SAVE_NOTES";
      recipientId: string;
      notes: string;
      eligible: boolean;
    }
  | { type: "PROPOSE_CANDIDATE"; id: string }
  | { type: "DISMISS_CANDIDATE"; id: string }
  | {
      type: "EDIT_CANDIDATE";
      id: string;
      patchIndex?: number;
      content: string;
      rationale: string;
      importance: Importance;
    }
  | {
      type: "REVIEW_PROPOSAL";
      id: string;
      outcome: "approved" | "revision" | "rejected";
    }
  | { type: "COMPLETE_TASK"; recipientId: string }
  | { type: "MISSING_CONTEXT"; recipientId: string; text: string }
  | {
      type: "POLICY";
      routine: SyncPolicy;
      critical: SyncPolicy;
      allowTeam: boolean;
      proposeFeedback: boolean;
    }
  | { type: "OVERRIDE_SYNC"; recipientId: string; apply: boolean }
  | { type: "CONDITION"; condition: Condition }
  | { type: "STUDY_START" }
  | { type: "STUDY_COMPLETE" }
  | { type: "CONTROL"; paused: boolean; slow: boolean }
  | { type: "STORY_NEXT" }
  | { type: "STORY_BACK" }
  | { type: "STORY_EXIT" }
  | { type: "STORY_OPEN" }
  | { type: "RESET" }
  | { type: "INSPECT"; id: string }
  | {
      type: "MANUAL_DELIVER";
      recipientId: string;
      ids: string[];
      summary: string;
    };
