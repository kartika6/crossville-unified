export type Category =
  | "brief"
  | "decision"
  | "constraint"
  | "open_question"
  | "fact"
  | "inbox";
export type Privacy = "shared" | "team" | "private";
export type Status = "confirmed" | "tentative" | "disputed" | "superseded";
export interface Member {
  id: string;
  name: string;
  role: "owner" | "editor" | "viewer";
  personalNotes: string[];
}
export interface SourceReference {
  id: string;
  label: string;
  reference: string;
  tool: string;
}
export interface ContextItem {
  id: string;
  projectId: string;
  content: string;
  category: Category;
  authorId: string;
  source: SourceReference;
  createdAt: string;
  updatedAt: string;
  version: number;
  privacy: Privacy;
  status: Status;
  relevance: string;
  dependencies: string[];
  rationale: string;
  strictness?: "Must" | "Prefer";
  ruleType?: "Study limits" | "Privacy and sharing";
  stage?: "Open" | "Exploring" | "Answered" | "Decided";
  assigneeId?: string;
  findings?: string;
  linkedDecisionId?: string;
  progress?: string;
  milestone?: {
    name: string;
    originalPlan?: string;
    currentApproach: string;
    rationale: string;
    result: string;
    openIssues: string;
  };
}
export interface Decision {
  id: string;
  projectId: string;
  targetId: string;
  before: string;
  content: string;
  rationale: string;
  status: "pending" | "approved" | "rejected" | "revision";
  originQuestionId?: string;
  authorId: string;
  baseVersion: number;
  affectedPeople: string[];
  affectedTaskIds: string[];
  category: Category;
  privacy: Privacy;
  source: SourceReference;
}
export interface Constraint extends ContextItem {
  category: "constraint";
}
export interface OpenQuestion extends ContextItem {
  category: "open_question";
}
export interface Vote {
  id: string;
  itemId: string;
  memberId: string;
  category: Category;
  round: number;
}
export interface Comment {
  id: string;
  entityId: string;
  memberId: string;
  content: string;
  timestamp: string;
}
export interface Task {
  id: string;
  title: string;
  owner: string;
  agent: string;
  status: string;
  dependsOnMemoryIds: string[];
}
export interface Project {
  id: string;
  name: string;
  version: number;
  memberIds: string[];
  tasks: Task[];
}
export interface ProjectVersion {
  id: string;
  projectId: string;
  version: number;
  timestamp: string;
  items: ContextItem[];
}
export interface HandoffPacket {
  id: string;
  projectId: string;
  projectVersion: number;
  recipient: string;
  task: string;
  purpose: string;
  items: ContextItem[];
  excluded: { id: string; reason: string }[];
  nextAction: string;
  timestamp: string;
  text: string;
}
export interface HandoffReceipt {
  id: string;
  packetId: string;
  workspaceId: string;
  timestamp: string;
}
export interface AgentWorkspace {
  id: string;
  projectId: string;
  recipient: string;
  task: string;
  packetId: string;
  loadedVersion: number;
  items: ContextItem[];
  progress: { content: string; timestamp: string }[];
  missing: string[];
}
export interface ChangeEvent {
  id: string;
  projectId: string;
  version: number;
  previousVersion: number;
  actorId: string;
  tool: string;
  type: string;
  entityIds: string[];
  timestamp: string;
  before: ContextItem[];
  after: ContextItem[];
}
export interface SyncRecommendation {
  id: string;
  workspaceId: string;
  itemId: string;
  level: "critical" | "relevant" | "low";
  reason: string;
  action: string;
  before?: ContextItem;
  after: ContextItem;
}
export interface SyncEvent {
  id: string;
  workspaceId: string;
  itemIds: string[];
  outcome: "approved" | "declined" | "deferred";
  timestamp: string;
  version: number;
}
export interface StudyEvent {
  projectId?: string;
  id: string;
  sessionId: string;
  condition: "Baseline" | "Crossville";
  scenario: string;
  timestamp: string;
  type: string;
  itemIds: string[];
  actorId: string;
  detail: string;
}
export interface Study {
  active: boolean;
  sessionId: string;
  condition: "Baseline" | "Crossville";
  scenario: string;
  baseline: string;
  started: boolean;
  complete: boolean;
}
export interface State {
  schema: 1;
  sourceActivity?: {
    id: string;
    projectId: string;
    actor: string;
    tool: string;
    content: string;
    timestamp: string;
  }[];
  conflicts: SourceConflict[];
  personal: PersonalSession[];
  projects: Project[];
  members: Member[];
  items: ContextItem[];
  decisions: Decision[];
  votes: Vote[];
  rounds: Record<string, number>;
  comments: Comment[];
  versions: ProjectVersion[];
  packets: HandoffPacket[];
  workspaces: AgentWorkspace[];
  receipts: HandoffReceipt[];
  changes: ChangeEvent[];
  syncEvents: SyncEvent[];
  logs: StudyEvent[];
  activeMemberId: string;
  activeProjectId: string;
  study: Study;
}
export interface SourceConflict {
  id: string;
  projectId: string;
  title: string;
  itemIds: string[];
  ownerId: string;
  status: "unresolved" | "resolved";
  keptId?: string;
}
export interface PersonalItem {
  id: string;
  title: string;
  content: string;
  category: string;
  access: string;
  status: string;
  revision: number;
  source: SourceReference;
}
export interface PersonalMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
  contextVersion: number;
  itemIds?: string[];
  tool?: string;
  steps?: { title: string; text: string }[];
  simulation?: boolean;
}
export interface PersonalDraft {
  id: string;
  itemId: string;
  category: string;
  before: string;
  after: string;
  why: string;
  baseVersion: number;
  sourceTool: string;
  origin: string;
  originMessageId: string | null;
  fingerprint: string;
  edited: boolean;
  rebased: boolean;
  createdAt: string;
  proposalId: string | null;
}
export interface PersonalSession {
  id: string;
  projectId: string;
  ownerId: string;
  tool: string;
  contextVersion: number;
  snapshotItems: PersonalItem[];
  withheldCount: number;
  includedCategories: string[];
  notes: string;
  notesEligible: boolean;
  autoManage: boolean;
  messages: PersonalMessage[];
  draft: PersonalDraft | null;
  managerState: string;
  updatedAt: string;
  dismissedFingerprint?: string;
}
