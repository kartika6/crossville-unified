import test from "node:test";
import assert from "node:assert/strict";
import { adaptiveSeed, APPROACH, UPDATE } from "../src/adaptive/seed.ts";
import {
  reduceAdaptive as act,
  reduceLegacy,
  flushAutomation,
  workspace,
  exportEvents,
} from "../src/adaptive/engine.ts";
import { selectContext } from "../src/adaptive/selection.ts";
import {
  SimulationRepository,
  parseAdaptive,
} from "../src/adaptive/repository.ts";
import type { AdaptiveState } from "../src/adaptive/types.ts";
function open(s = adaptiveSeed()) {
  s = act(s, { type: "OPEN_WORKSPACE", personId: "teammate-a", tool: "Codex" });
  const r = s.recipients.find((r) => r.tool === "Codex")!;
  return act(s, { type: "START_TASK", recipientId: r.id });
}
function approve(
  s: AdaptiveState,
  person: string,
  tool: "Claude" | "NotebookLM",
  text: string,
) {
  s = act(s, { type: "OPEN_WORKSPACE", personId: person, tool });
  s = flushAutomation(s);
  const r = s.recipients.find((r) => r.personId === person && r.tool === tool)!;
  s = act(s, { type: "CHAT", recipientId: r.id, text });
  const c = s.candidates.at(-1)!;
  s = act(s, { type: "PROPOSE_CANDIDATE", id: c.id });
  s = reduceLegacy(s, { type: "member", id: "professor" });
  return act(s, {
    type: "REVIEW_PROPOSAL",
    id: s.candidates.at(-1)!.proposalId!,
    outcome: "approved",
  });
}
test("task start creates a real immutable snapshot and local receipt; unchanged task does not duplicate", () => {
  let s = open();
  assert.ok(s.jobs.length);
  s = flushAutomation(s);
  const r = s.recipients.find((r) => r.tool === "Codex")!;
  assert.ok(workspace(s, r)?.items.some((i) => i.id === "method"));
  assert.ok(s.base.receipts.length);
  const count = s.base.packets.length;
  s = act(s, { type: "START_TASK", recipientId: r.id });
  s = flushAutomation(s);
  assert.equal(s.base.packets.length, count);
  assert.ok(
    s.events.some(
      (e) => e.type === "HANDOFF_DELIVERED" || e.type === "CONTEXT_LOADED",
    ),
  );
});
test("selection excludes private, pending, superseded and unresolved conflict records", () => {
  const s = open();
  const r = s.recipients.find((r) => r.tool === "Codex")!;
  const selected = selectContext(s, r);
  const included = selected.filter((x) => x.disposition === "included");
  assert.ok(included.length > 0);
  for (const x of included) {
    assert.equal(x.item!.status, "confirmed");
    assert.notEqual(x.item!.privacy, "private");
    assert.ok(
      !s.base.conflicts.some(
        (c) => c.status === "unresolved" && c.itemIds.includes(x.itemId),
      ),
    );
  }
  assert.ok(selected.some((x) => x.disposition === "withheld"));
  assert.ok(!JSON.stringify(selected).includes("private-raw-secret"));
});
test("private detection does not publish until explicit proposal and professor approval", () => {
  let s = adaptiveSeed();
  const r = s.recipients.find(
    (r) => r.personId === "you" && r.tool === "Claude",
  )!;
  s = act(s, { type: "CHAT", recipientId: r.id, text: APPROACH });
  assert.equal(s.base.projects[0].version, 4);
  assert.equal(s.base.decisions.length, 0);
  s = act(s, { type: "PROPOSE_CANDIDATE", id: s.candidates[0].id });
  assert.equal(s.base.projects[0].version, 4);
  s = reduceLegacy(s, { type: "member", id: "professor" });
  s = act(s, {
    type: "REVIEW_PROPOSAL",
    id: s.candidates[0].proposalId!,
    outcome: "approved",
  });
  assert.equal(s.base.projects[0].version, 5);
  assert.ok(s.base.items.some((i) => i.status === "superseded"));
});
test("full guided cycle: v5 task delivery, two relevant v6 sync updates, immutable packet, reviewed feedback v7", () => {
  let s = approve(adaptiveSeed(), "you", "Claude", APPROACH);
  s = flushAutomation(open(s));
  const r = s.recipients.find((r) => r.tool === "Codex")!;
  assert.equal(workspace(s, r)?.loadedVersion, 5);
  const packet = JSON.stringify(s.base.packets);
  s = approve(s, "teammate-b", "NotebookLM", UPDATE);
  assert.equal(s.base.projects[0].version, 6);
  s = flushAutomation(s);
  const updated = s.recipients.find((x) => x.id === r.id)!;
  assert.ok(
    workspace(s, updated)?.items.some((i) => i.id === "automation-controls"),
  );
  assert.ok(
    workspace(s, updated)?.items.some((i) => i.id === "boundary-labels"),
  );
  assert.equal(workspace(s, updated)?.loadedVersion, 6);
  assert.equal(
    JSON.stringify(s.base.packets.slice(0, JSON.parse(packet).length)),
    packet,
  );
  s = act(s, { type: "OPEN_WORKSPACE", personId: "teammate-a", tool: "Codex" });
  s = act(s, { type: "COMPLETE_TASK", recipientId: r.id });
  assert.equal(s.base.projects[0].version, 6);
  const c = s.candidates.at(-1)!;
  s = reduceLegacy(s, { type: "member", id: "professor" });
  s = act(s, {
    type: "REVIEW_PROPOSAL",
    id: c.proposalId!,
    outcome: "approved",
  });
  assert.equal(s.base.projects[0].version, 7);
});
test("critical updates are held; declining does not change loaded context; approval applies", () => {
  let s = flushAutomation(open());
  const r = s.recipients.find((r) => r.tool === "Codex")!;
  const old = JSON.stringify(workspace(s, r));
  s = approve(s, "you", "Claude", APPROACH);
  s = flushAutomation(s);
  assert.ok(s.recipients.find((x) => x.id === r.id)!.held.length);
  assert.equal(
    JSON.stringify(
      workspace(
        s,
        s.recipients.find((x) => x.id === r.id),
      ),
    ),
    old,
  );
  s = act(s, { type: "OPEN_WORKSPACE", personId: "teammate-a", tool: "Codex" });
  s = act(s, { type: "OVERRIDE_SYNC", recipientId: r.id, apply: false });
  assert.equal(
    JSON.stringify(
      workspace(
        s,
        s.recipients.find((x) => x.id === r.id),
      ),
    ),
    old,
  );
  s = act(s, { type: "OVERRIDE_SYNC", recipientId: r.id, apply: true });
  s = flushAutomation(s);
  assert.ok(
    workspace(
      s,
      s.recipients.find((x) => x.id === r.id),
    )
      ?.items.find((i) => i.id === "method")
      ?.content.includes("action research"),
  );
});
test("manual condition never automatically delivers; opaque uses same context without inspector access", () => {
  for (const condition of ["manual", "opaque", "explainable"] as const) {
    let s = act(adaptiveSeed(), { type: "CONDITION", condition });
    s = open(s);
    s = flushAutomation(s);
    const r = s.recipients.find((r) => r.tool === "Codex")!;
    if (condition === "manual") {
      assert.equal(workspace(s, r), undefined);
      const ids = selectContext(s, r)
        .filter((x) => x.disposition === "included")
        .map((x) => x.itemId);
      s = act(s, {
        type: "MANUAL_DELIVER",
        recipientId: r.id,
        ids,
        summary: "My summary",
      });
      assert.ok(
        workspace(
          s,
          s.recipients.find((x) => x.id === r.id),
        ),
      );
    } else assert.ok(workspace(s, r));
    if (condition !== "explainable")
      assert.throws(() => act(s, { type: "INSPECT", id: r.id }));
  }
});
test("persistence, reset and JSON/CSV study exports retain real events", () => {
  const memory = new Map<string, string>();
  const repo = new SimulationRepository({
    getItem: (k) => memory.get(k) || null,
    setItem: (k, v) => {
      memory.set(k, v);
    },
  });
  const s = flushAutomation(open());
  repo.save(s);
  assert.deepEqual(repo.load(), s);
  assert.deepEqual(parseAdaptive(JSON.stringify(s)), s);
  assert.ok(exportEvents(s).includes("sessionId"));
  assert.ok(JSON.parse(JSON.stringify(s.events)).length > 0);
  const reset = act(s, { type: "RESET" });
  assert.equal(reset.base.projects[0].version, 4);
  assert.equal(reset.jobs.length, 0);
  assert.equal(reset.candidates.length, 0);
});

test("notify policy evaluates changes without applying them", () => {
  let s = flushAutomation(open());
  s = reduceLegacy(s, { type: "member", id: "professor" });
  s = act(s, { type: "POLICY", ...s.policy, routine: "notify" });
  s = approve(s, "teammate-b", "NotebookLM", UPDATE);
  s = flushAutomation(s);
  const r = s.recipients.find((r) => r.tool === "Codex")!;
  assert.equal(workspace(s, r)?.loadedVersion, 4);
  assert.ok(r.held.length);
  assert.ok(
    !workspace(s, r)?.items.some((i) => i.id === "automation-controls"),
  );
});
test("permission rules still apply when synchronization is overridden", () => {
  let s = flushAutomation(open());
  const r = s.recipients.find((r) => r.tool === "Codex")!;
  const item = s.base.items.find((i) => i.id === "prototype-requirement")!;
  item.privacy = "private";
  s = act(s, { type: "OPEN_WORKSPACE", personId: "teammate-a", tool: "Codex" });
  s = act(s, { type: "OVERRIDE_SYNC", recipientId: r.id, apply: true });
  s = flushAutomation(s);
  const selected = selectContext(s, s.recipients.find((x) => x.id === r.id)!);
  assert.ok(
    !selected.some((x) => x.disposition === "included" && x.itemId === item.id),
  );
});
test("paused queue advances one actual stage per explicit tick and reset restores recipients", () => {
  let s = open();
  s = act(s, { type: "CONTROL", paused: true, slow: true });
  const stage = s.jobs[0].stage;
  s = act(s, { type: "TICK" });
  assert.ok(s.jobs[0].stage > stage || s.jobs[0].status === "running");
  assert.ok(
    !workspace(
      s,
      s.recipients.find((r) => r.tool === "Codex"),
    ),
  );
  const reset = act(s, { type: "RESET" });
  assert.ok(!reset.recipients.some((r) => r.tool === "Codex"));
  assert.equal(reset.controls.paused, false);
});

test('an in-flight older sync cannot claim a newer unevaluated canonical version',()=>{let s=flushAutomation(open());s=reduceLegacy(s,{type:'member',id:'professor'});s=act(s,{type:'POLICY',...s.policy,critical:'automatic'});s=approve(s,'you','Claude',APPROACH);s=approve(s,'teammate-b','NotebookLM',UPDATE);const r=s.recipients.find(r=>r.tool==='Codex')!;for(let i=0;i<150;i++){const job=s.jobs.find(j=>j.recipientId===r.id&&j.sourceVersion===5);if(job?.status==='complete'){assert.ok(workspace(s,s.recipients.find(x=>x.id===r.id))!.loadedVersion<=5);break}s=act(s,{type:'TICK'})}s=flushAutomation(s);assert.equal(workspace(s,s.recipients.find(x=>x.id===r.id))?.loadedVersion,6)});
