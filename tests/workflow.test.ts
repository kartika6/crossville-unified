import test from "node:test";
import assert from "node:assert/strict";
import {
  seed,
  transition,
  consensus,
  packet,
  syncRecommendations,
  recommend,
  csv,
  personalItem,
} from "../src/engine.ts";
import { LocalRepository, parseState, storageKey } from "../src/repository.ts";
import type { State } from "../src/model.ts";
const capture = (s = seed()) =>
  transition(s, {
    type: "add",
    content: "Use fictional interview transcripts.",
    source: "conversation://chat/turn/4",
    tool: "ChatGPT",
    privacy: "shared",
  });
const lastItem = (s: State) => s.items.at(-1)!;
function handoff() {
  let s = seed();
  s = transition(s, {
    type: "handoff",
    recipient: "Codex",
    task: "Continue building research methodology prototype",
    ids: ["study-brief", "method", "ethics", "constraints"],
  });
  s = transition(s, { type: "load", id: s.packets[0].id });
  return s;
}
function update(
  s: State,
  id = "method",
  content = "Use a reviewed action research pilot.",
) {
  s = transition(s, {
    type: "proposal",
    targetId: id,
    content,
    rationale: "Pilot requirement update",
  });
  return transition(s, {
    type: "resolve",
    id: s.decisions.at(-1)!.id,
    status: "approved",
  });
}
test("adding context persists an inbox item in shared state without adopting it", () => {
  const s = capture();
  assert.equal(lastItem(s).category, "inbox");
  assert.equal(lastItem(s).status, "tentative");
  assert.equal(s.projects[0].version, 4);
  assert.equal(s.logs.at(-1)!.type, "memory_captured");
});
test("unanimous sorting votes categorize the correct shared item and bump version", () => {
  let s = capture();
  const id = lastItem(s).id;
  for (const member of s.members) {
    s = transition(s, { type: "member", id: member.id });
    s = transition(s, { type: "vote", id, category: "constraint" });
  }
  assert.equal(s.items.find((i) => i.id === id)!.category, "constraint");
  assert.equal(consensus(s, id).agreed, true);
  assert.equal(s.projects[0].version, 5);
});
test("disagreement creates disputed state; owner resolves with rationale", () => {
  let s = capture();
  const id = lastItem(s).id;
  s = transition(s, { type: "vote", id, category: "decision" });
  s = transition(s, { type: "member", id: "teammate-a" });
  s = transition(s, { type: "vote", id, category: "fact" });
  assert.ok(consensus(s, id).conflict);
  assert.equal(s.items.find((i) => i.id === id)!.status, "disputed");
  assert.throws(() =>
    transition(s, {
      type: "resolveConflict",
      id,
      category: "fact",
      rationale: "Consolidate votes",
    }),
  );
  s = transition(s, { type: "member", id: "you" });
  s = transition(s, {
    type: "resolveConflict",
    id,
    category: "fact",
    rationale: "Reviewed source: observational fact",
  });
  assert.equal(s.items.find((i) => i.id === id)!.status, "confirmed");
});
test("re-voting keeps vote history but resets active consensus", () => {
  let s = capture();
  const id = lastItem(s).id;
  s = transition(s, { type: "vote", id, category: "fact" });
  s = transition(s, { type: "revote", id });
  assert.equal(s.votes.length, 1);
  assert.equal(consensus(s, id).votes.length, 0);
});
test("same member vote updates rather than duplicates", () => {
  let s = capture();
  const id = lastItem(s).id;
  s = transition(s, { type: "vote", id, category: "fact" });
  s = transition(s, { type: "vote", id, category: "decision" });
  assert.equal(consensus(s, id).votes.length, 1);
  assert.equal(consensus(s, id).votes[0].category, "decision");
});
test("approve methodology updates project, item, provenance, dependent tasks and version snapshot", () => {
  const s = transition(seed(), {
    type: "resolve",
    id: "method-update",
    status: "approved",
  });
  assert.equal(s.projects[0].version, 5);
  assert.equal(s.items.find((i) => i.id === "method")!.version, 5);
  assert.equal(
    s.items.find((i) => i.id === "method")!.source.tool,
    "NotebookLM",
  );
  assert.equal(s.projects[0].tasks[0].status, "Needs update");
  assert.equal(s.versions.at(-1)!.version, 5);
});
test("editors cannot approve or change access; viewers cannot contribute or vote", () => {
  let s = transition(seed(), { type: "member", id: "teammate-a" });
  assert.throws(() =>
    transition(s, { type: "resolve", id: "method-update", status: "approved" }),
  );
  assert.throws(() =>
    transition(s, { type: "role", id: "teammate-b", role: "owner" }),
  );
  s = transition(seed(), { type: "role", id: "teammate-a", role: "viewer" });
  s = transition(s, { type: "member", id: "teammate-a" });
  assert.throws(() => capture(s));
});
test("stale conflicting proposals cannot overwrite an approved decision", () => {
  let s = seed();
  s = transition(s, {
    type: "proposal",
    targetId: "method",
    content: "A conflicting method",
    rationale: "Try another",
  });
  const id = s.decisions.at(-1)!.id;
  s = transition(s, {
    type: "resolve",
    id: "method-update",
    status: "approved",
  });
  assert.throws(
    () => transition(s, { type: "resolve", id, status: "approved" }),
    /Conflicting version/,
  );
});
test("reject and request revision preserve canonical version", () => {
  for (const status of ["rejected", "revision"] as const) {
    const s = transition(seed(), {
      type: "resolve",
      id: "method-update",
      status,
    });
    assert.equal(s.projects[0].version, 4);
    assert.equal(s.decisions[0].status, status);
  }
});
test("handoff includes only selected confirmed permitted items and redacts private metadata", () => {
  const pk = packet(seed(), "Codex", "Implement prototype", [
    "method",
    "private-note",
    "b-private-note",
    "old-plan",
    "future-idea",
  ]);
  assert.deepEqual(
    pk.items.map((i) => i.id),
    ["method"],
  );
  assert.ok(!pk.text.includes("SYNTHETIC_PRIVATE_NOTE"));
  assert.ok(!pk.text.includes("b-private-note"));
  assert.ok(!pk.text.includes("Fictional personal planning"));
});
test("team-only context is permitted for teammates but excluded from AI packets", () => {
  const s = seed();
  s.items.find((i) => i.id === "ethics")!.privacy = "team";
  assert.equal(packet(s, "Codex", "Build", ["ethics"]).items.length, 0);
  assert.equal(packet(s, "Professor", "Review", ["ethics"]).items.length, 1);
});
test("source conflict blocks packet until owner selects source and supersedes alternative", () => {
  let s = seed();
  assert.throws(
    () => packet(s, "Codex", "Plan pilot", ["scope-current"]),
    /conflict/,
  );
  s = transition(s, {
    type: "sourceConflict",
    id: "pilot-duration",
    keepId: "scope-current",
  });
  assert.equal(
    s.items.find((i) => i.id === "scope-conflict")!.status,
    "superseded",
  );
  assert.equal(
    packet(s, "Codex", "Plan pilot", ["scope-current", "scope-conflict"]).items
      .length,
    1,
  );
});
test("packet is immutable after approval and recipient progress", () => {
  let s = handoff();
  const original = JSON.stringify(s.packets[0]);
  s = update(s);
  s = transition(s, {
    type: "progress",
    id: s.workspaces[0].id,
    content: "Built a task branch",
    missing: false,
  });
  assert.equal(JSON.stringify(s.packets[0]), original);
  assert.notEqual(
    s.workspaces[0].items.find((i) => i.id === "method")!.content,
    s.items.find((i) => i.id === "method")!.content,
  );
});
test("recipient load copies exact packet selection and creates a receipt", () => {
  const s = handoff();
  assert.deepEqual(s.workspaces[0].items, s.packets[0].items);
  assert.notEqual(s.workspaces[0].items, s.packets[0].items);
  assert.equal(s.receipts[0].workspaceId, s.workspaces[0].id);
});
test("later approved decision produces critical inspectable sync recommendation", () => {
  const s = update(handoff());
  const r = syncRecommendations(s, s.workspaces[0].id).find(
    (r) => r.itemId === "method",
  )!;
  assert.equal(r.level, "critical");
  assert.ok(r.before);
  assert.ok(r.reason);
  assert.equal(r.action, "Immediate review");
});
test("task-related changes are relevant and unrelated facts can wait", () => {
  const s = seed();
  const base = s.items.find((i) => i.id === "method")!;
  assert.equal(
    recommend(
      {
        ...base,
        category: "fact",
        content: "Prototype implementation detail",
        relevance: "",
      },
      "Build prototype",
    ).level,
    "relevant",
  );
  assert.equal(
    recommend(
      {
        ...base,
        category: "fact",
        content: "Lunch menu tomorrow",
        relevance: "",
      },
      "Build prototype",
    ).level,
    "low",
  );
});
test("decline or defer sync never changes loaded working context", () => {
  const s = update(handoff());
  for (const outcome of ["declined", "deferred"] as const) {
    const next = transition(s, {
      type: "sync",
      id: s.workspaces[0].id,
      ids: ["method"],
      outcome,
    });
    assert.deepEqual(next.workspaces, s.workspaces);
    assert.equal(next.syncEvents.at(-1)!.outcome, outcome);
  }
});
test("partial sync applies selected changes and does not falsely advance loaded version", () => {
  let s = update(handoff());
  s = update(s, "ethics", "Use only fictional participant data.");
  const wid = s.workspaces[0].id;
  const oldVersion = s.workspaces[0].loadedVersion;
  s = transition(s, {
    type: "sync",
    id: wid,
    ids: ["method"],
    outcome: "approved",
  });
  assert.equal(s.workspaces[0].loadedVersion, oldVersion);
  assert.ok(syncRecommendations(s, wid).some((r) => r.itemId === "ethics"));
  s = transition(s, {
    type: "sync",
    id: wid,
    ids: ["ethics"],
    outcome: "approved",
  });
  assert.equal(s.workspaces[0].loadedVersion, s.projects[0].version);
  assert.equal(syncRecommendations(s, wid).length, 0);
});
test("recipient feedback enters review, only approval creates canonical context", () => {
  let s = handoff();
  const before = s.items.length;
  s = transition(s, {
    type: "feedback",
    id: s.workspaces[0].id,
    content: "Require source IDs in every exported packet.",
    rationale: "Traceability",
    category: "constraint",
  });
  assert.equal(s.items.length, before);
  const d = s.decisions.at(-1)!;
  assert.equal(d.status, "pending");
  assert.equal(d.source.tool, "Codex");
  s = transition(s, { type: "resolve", id: d.id, status: "approved" });
  assert.equal(s.items.length, before + 1);
  assert.ok(
    syncRecommendations(s, s.workspaces[0].id).some(
      (r) => r.after.content === d.content,
    ),
  );
});
test("refresh persistence round trip preserves votes, handoffs, review and logs", () => {
  const data = new Map<string, string>();
  const repo = new LocalRepository({
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  });
  const s = update(handoff());
  repo.save(s);
  assert.deepEqual(repo.load(), s);
  assert.ok(data.has(storageKey));
});
test("invalid imports are rejected without mutating existing state", () => {
  assert.throws(() => parseState('{"schema":2}'));
  const s = seed();
  s.items.push({ ...s.items[0] });
  assert.throws(() => parseState(JSON.stringify(s)), /duplicate/);
});
test("study scenario reset restores scenario fixture and clears handoffs and decisions", () => {
  let s = handoff();
  s = transition(s, {
    type: "study",
    scenario: "Recall",
    condition: "Crossville",
    active: true,
  });
  const oldSession = s.study.sessionId;
  s = transition(s, { type: "reset", scenario: "Recall" });
  assert.equal(s.packets.length, 0);
  assert.equal(s.workspaces.length, 0);
  assert.equal(s.projects[0].version, 4);
  assert.match(
    s.items.find((i) => i.id === "scenario-task")!.content,
    /approved methodology/,
  );
  assert.notEqual(s.study.sessionId, oldSession);
});
test("study JSON and CSV log exports retain session condition scenario and action IDs", () => {
  let s = transition(seed(), {
    type: "study",
    scenario: "Context selection",
    condition: "Crossville",
    active: true,
  });
  s = transition(s, { type: "studyStart" });
  s = transition(s, { type: "selection", id: "method", included: true });
  s = transition(s, { type: "studyComplete" });
  assert.ok(csv(s).includes("context_included"));
  assert.ok(csv(s).includes("Context selection"));
  assert.ok(JSON.stringify(s.logs).includes("task_completed"));
});
test("baseline condition prevents structured actions at the state boundary", () => {
  const s = transition(seed(), {
    type: "study",
    scenario: "Recall",
    condition: "Baseline",
    active: true,
  });
  assert.throws(() => capture(s), /baseline/);
  assert.throws(
    () =>
      transition(s, {
        type: "handoff",
        recipient: "Codex",
        task: "Build",
        ids: ["method"],
      }),
    /baseline/,
  );
  assert.equal(
    transition(s, { type: "baseline", text: "Manual summary" }).study.baseline,
    "Manual summary",
  );
});
test("private workspace uses B simulation, isolates members, protects human edits and excludes notes from payload", () => {
  let s = handoff();
  s = transition(s, { type: "personalOpen", workspaceId: s.workspaces[0].id });
  const id = s.personal[0].id;
  s = transition(s, {
    type: "personalNotes",
    id,
    text: "Explore a bounded research pilot with synthetic data.",
    eligible: true,
    auto: true,
  });
  assert.ok(s.personal[0].draft);
  s = transition(s, {
    type: "personalDraft",
    id,
    after: "Human edited private candidate",
    why: "Reviewer evidence",
  });
  s = transition(s, {
    type: "personalChat",
    id,
    text: "What are the next steps?",
  });
  assert.equal(s.personal[0].draft!.after, "Human edited private candidate");
  s = transition(s, { type: "personalSubmit", id });
  assert.equal(s.decisions.at(-1)!.content, "Human edited private candidate");
  assert.ok(
    !JSON.stringify(s.decisions.at(-1)).includes(
      "Explore a bounded research pilot",
    ),
  );
  assert.throws(() => transition(s, { type: "personalSubmit", id }));
  s = transition(s, { type: "member", id: "teammate-a" });
  assert.throws(() =>
    transition(s, {
      type: "personalChat",
      id,
      text: "Read another member notes",
    }),
  );
});
test("private old messages stay versioned after approved sync and reload", () => {
  let s = handoff();
  s = transition(s, { type: "personalOpen", workspaceId: s.workspaces[0].id });
  const id = s.personal[0].id;
  const original = JSON.stringify(s.personal[0].messages);
  s = update(s);
  s = transition(s, {
    type: "sync",
    id: s.workspaces[0].id,
    ids: ["method"],
    outcome: "approved",
  });
  s = transition(s, { type: "personalOpen", workspaceId: s.workspaces[0].id });
  assert.equal(JSON.stringify(s.personal[0].messages), original);
  assert.equal(s.personal[0].contextVersion, 5);
  assert.ok(personalItem(s.items[0]).source.reference);
  assert.equal(id, s.personal[0].id);
});
test("constraint strictness changes require owner and produce critical sync deltas", () => {
  let s = handoff();
  const viewer = transition(s, { type: "member", id: "teammate-a" });
  assert.throws(() =>
    transition(viewer, {
      type: "strictness",
      id: "ethics",
      strictness: "Prefer",
      ruleType: "Privacy and sharing",
    }),
  );
  s = transition(s, {
    type: "strictness",
    id: "ethics",
    strictness: "Prefer",
    ruleType: "Privacy and sharing",
  });
  assert.equal(s.items.find((i) => i.id === "ethics")!.strictness, "Prefer");
  assert.equal(
    syncRecommendations(s, s.workspaces[0].id).find(
      (r) => r.itemId === "ethics",
    )!.level,
    "critical",
  );
});
test("question lifecycle stores owner and findings; promotion requires review before creating a decision", () => {
  let s = seed();
  assert.throws(() =>
    transition(s, {
      type: "question",
      id: "outside-teams",
      stage: "Answered",
      assigneeId: "professor",
      findings: "",
    }),
  );
  s = transition(s, {
    type: "question",
    id: "outside-teams",
    stage: "Exploring",
    assigneeId: "professor",
    findings: "Pilot with our team first.",
  });
  s = transition(s, {
    type: "question",
    id: "outside-teams",
    stage: "Answered",
    assigneeId: "professor",
    findings: "Pilot with our team first.",
  });
  s = transition(s, { type: "promoteQuestion", id: "outside-teams" });
  assert.equal(
    s.items.find((i) => i.id === "outside-teams")!.stage,
    "Answered",
  );
  const proposal = s.decisions.at(-1)!;
  assert.equal(proposal.originQuestionId, "outside-teams");
  assert.throws(() =>
    transition(s, { type: "promoteQuestion", id: "outside-teams" }),
  );
  s = transition(s, { type: "resolve", id: proposal.id, status: "approved" });
  const question = s.items.find((i) => i.id === "outside-teams")!;
  assert.equal(question.stage, "Decided");
  assert.equal(
    s.items.find((i) => i.id === question.linkedDecisionId)!.category,
    "decision",
  );
  assert.equal(s.changes.at(-1)!.type, "question_promoted");
});
test("undo removes only the current acting member vote and preserves the other vote", () => {
  let s = capture();
  const id = lastItem(s).id;
  s = transition(s, { type: "vote", id, category: "fact" });
  s = transition(s, { type: "member", id: "teammate-a" });
  s = transition(s, { type: "vote", id, category: "decision" });
  assert.ok(consensus(s, id).conflict);
  s = transition(s, { type: "undoVote", id });
  assert.equal(consensus(s, id).votes.length, 1);
  assert.equal(consensus(s, id).votes[0].memberId, "you");
  assert.equal(s.items.find((i) => i.id === id)!.status, "tentative");
});
test("direct private entry creates traceable context and supports manual draft targeting and tool switching", () => {
  let s = transition(seed(), { type: "personalStart" });
  assert.equal(s.workspaces.length, 1);
  assert.equal(s.receipts.length, 1);
  const id = s.personal[0].id;
  s = transition(s, { type: "personalManual", id });
  s = transition(s, { type: "personalTarget", id, targetId: "ethics" });
  s = transition(s, {
    type: "personalDraft",
    id,
    after: "Use fictional data in the demonstration.",
    why: "Keep scope controlled",
  });
  const oldTool = s.personal[0].draft!.sourceTool;
  s = transition(s, { type: "personalTool", id, tool: "Gemini" });
  assert.equal(s.personal[0].draft!.sourceTool, oldTool);
  s = transition(s, { type: "personalSubmit", id });
  assert.equal(s.decisions.at(-1)!.targetId, "ethics");
  assert.throws(() =>
    transition(s, {
      type: "personalDraft",
      id,
      after: "Changed after submission",
      why: "Should require revision",
    }),
  );
});
test("private selection of earlier response derives from that response without deleting later history", () => {
  let s = transition(seed(), { type: "personalStart" });
  const id = s.personal[0].id;
  s = transition(s, {
    type: "personalChat",
    id,
    text: "Explore action research inside our own team.",
  });
  const selected = s.personal[0].messages.at(-1)!.id;
  s = transition(s, {
    type: "personalChat",
    id,
    text: "What should we implement next?",
  });
  const count = s.personal[0].messages.length;
  s = transition(s, {
    type: "personalGenerate",
    id,
    origin: "chat",
    messageId: selected,
  });
  assert.match(s.personal[0].draft!.after, /planning, acting, observing/);
  assert.equal(s.personal[0].messages.length, count);
  assert.equal(s.personal[0].draft!.originMessageId, selected);
});
test("malformed nested saved records cannot enter the renderer", () => {
  for (const mutate of [
    (s: State) => {
      s.members[0].personalNotes = null as unknown as string[];
    },
    (s: State) => {
      s.items[0].source.reference = null as unknown as string;
    },
    (s: State) => {
      s.projects[0].tasks[0].dependsOnMemoryIds = null as unknown as string[];
    },
  ]) {
    const s = seed();
    mutate(s);
    assert.throws(() => parseState(JSON.stringify(s)));
  }
});
test("study start and completion must follow configured task lifecycle", () => {
  let s = seed();
  assert.throws(() => transition(s, { type: "studyStart" }));
  s = transition(s, {
    type: "study",
    condition: "Crossville",
    scenario: "Recall",
    active: true,
  });
  assert.throws(() => transition(s, { type: "studyComplete" }));
  s = transition(s, { type: "studyStart" });
  assert.throws(() =>
    transition(s, {
      type: "study",
      condition: "Baseline",
      scenario: "Recall",
      active: true,
    }),
  );
  s = transition(s, { type: "studyComplete" });
  assert.throws(() => transition(s, { type: "studyStart" }));
});
test("comments survive persistence and attach to the correct proposal", () => {
  let s = transition(seed(), {
    type: "comment",
    id: "method-update",
    content: "Please explain the pilot recruitment scope.",
  });
  const restored = parseState(JSON.stringify(s));
  assert.equal(restored.comments[0].entityId, "method-update");
  assert.equal(restored.comments[0].memberId, "you");
  assert.equal(restored.items.find((i) => i.id === "method")!.version, 4);
});
test("sync inspection logs IDs and inspectable rule explanations", () => {
  const s = update(handoff());
  const next = transition(s, { type: "syncInspect", id: s.workspaces[0].id });
  assert.equal(next.logs.at(-1)!.type, "sync_recommendations");
  assert.ok(next.logs.at(-1)!.itemIds.includes("method"));
  assert.match(next.logs.at(-1)!.detail, /critical/);
  assert.deepEqual(next.workspaces, s.workspaces);
});
