export type Role = "owner" | "editor" | "viewer";
export type MemoryType = "brief" | "decision" | "constraint" | "open_question";
export type ToolName = "Claude" | "ChatGPT" | "Codex" | "Gemini" | "NotebookLM";
export type Member = {
  id: string;
  name: string;
  title: string;
  role: Role;
  tools: ToolName[];
  personalNotes: string[];
};
export type MemoryItem = {
  id: string;
  type: MemoryType;
  text: string;
  version: number;
  author: string;
  source: string;
  updatedAt: string;
};
export type Task = {
  id: string;
  owner: string;
  agent: string;
  title: string;
  status: "Reviewed" | "Needs update";
  dependsOnMemoryIds: string[];
};
export type Project = {
  id: string;
  name: string;
  memoryVersion: number;
  memberIds: string[];
  memories: MemoryItem[];
  tasks: Task[];
};
export type Slice = {
  id: string;
  projectId: string;
  memberId: string;
  tool: ToolName;
  types: MemoryType[];
  memoryIds: string[];
  memoryVersion: number;
  text: string;
  timestamp: string;
};
export type Proposal = {
  id: string;
  projectId: string;
  authorId: string;
  tool: ToolName;
  targetIds: string[];
  before: string;
  after: string;
  rationale: string;
  affectedPeople: string[];
  affectedTaskIds: string[];
  staysPrivate: string[];
  status: "Pending" | "Approved" | "Revision requested" | "Rejected";
  createdAt: string;
  resolvedAt?: string;
};
export type StudyEvent = {
  id: string;
  action: string;
  actor: string;
  projectId: string;
  timestamp: string;
  memoryVersion?: number;
};
export type WorkspaceState = {
  members: Member[];
  projects: Project[];
  proposals: Proposal[];
  slices: Slice[];
  events: StudyEvent[];
  activeMemberId: string;
  activeProjectId: string;
  screen: string;
  dark: boolean;
};
