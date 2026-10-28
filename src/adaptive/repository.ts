import type { StoragePort } from "../repository.ts";
import { parseState } from "../repository.ts";
import type { AdaptiveState } from "./types.ts";
import { adaptiveSeed } from "./seed.ts";
export const adaptiveKey = "crossville-adaptive-v2";
export function parseAdaptive(text: string): AdaptiveState {
  const x: unknown = JSON.parse(text);
  if (!x || typeof x !== "object") throw Error("Invalid simulation backup.");
  const s = x as AdaptiveState;
  if (s.schema !== 2) throw Error("This is not an adaptive Crossville backup.");
  s.base = parseState(JSON.stringify(s.base));
  if (
    !Array.isArray(s.recipients) ||
    !Array.isArray(s.candidates) ||
    !Array.isArray(s.jobs) ||
    !Array.isArray(s.events) ||
    !s.metadata ||
    !s.patches ||
    !s.policy ||
    !s.study ||
    !s.story ||
    !s.view ||
    !s.controls
  )
    throw Error("Incomplete simulation backup.");
  if (!["manual", "opaque", "explainable"].includes(s.study.condition))
    throw Error("Unknown study condition.");
  for (const r of s.recipients) {
    if (
      typeof r.id !== "string" ||
      typeof r.personId !== "string" ||
      !Array.isArray(r.messages) ||
      !Array.isArray(r.held) ||
      !Array.isArray(r.deferred) ||
      !r.coverage ||
      !s.base.members.some((m) => m.id === r.personId)
    )
      throw Error("Invalid recipient record.");
    if (r.workspaceId && !s.base.workspaces.some((w) => w.id === r.workspaceId))
      throw Error("Recipient references missing context.");
  }
  for (const j of s.jobs)
    if (
      !Array.isArray(j.selection) ||
      !Array.isArray(j.deltas) ||
      !Array.isArray(j.sourceItems) ||
      j.stage < 0 ||
      j.stage > 5 ||
      !s.recipients.some((r) => r.id === j.recipientId)
    )
      throw Error("Invalid automation event queue.");
  return s;
}
export class SimulationRepository {
  private storage: StoragePort;
  constructor(storage: StoragePort) {
    this.storage = storage;
  }
  load() {
    const saved = this.storage.getItem(adaptiveKey);
    if (saved) return parseAdaptive(saved);
    const legacy = this.storage.getItem("crossville-unified-v1");
    return legacy ? adaptiveSeed(parseState(legacy)) : adaptiveSeed();
  }
  save(s: AdaptiveState) {
    this.storage.setItem(adaptiveKey, JSON.stringify(s));
  }
  restoreLegacy() {
    const saved = this.storage.getItem("crossville-unified-v1");
    if (!saved) throw Error("No previous workspace is stored in this browser.");
    return adaptiveSeed(parseState(saved));
  }
}
