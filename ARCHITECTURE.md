# Crossville architecture

React 19 + TypeScript strict + Vite 8; CSS reuses the root layout vocabulary with B's restrained blue context cards. No external runtime service, account or paid API. Node 24+ runs strip-types domain tests.

## Ownership
- `src/model.ts`: typed entities, including Project, ProjectVersion, Member, ContextItem, Decision, Constraint, OpenQuestion, Vote, Comment, SourceReference, HandoffPacket, HandoffReceipt, AgentWorkspace, ChangeEvent, SyncRecommendation, SyncEvent, private sessions and StudyEvent.
- `src/engine.ts`: seed migration, pure cloned-state transitions, permissions, privacy, consensus, review, packet generation, selective sync, logging and typed projections for B's private simulation.
- `src/repository.ts`: StoragePort/LocalRepository boundary, import validation and downloadable exports. A database adapter can replace it without changing domain transitions.
- `src/App.tsx`: views and form drafts; all meaningful domain changes dispatch typed actions to the same state. A state ref serializes consecutive actions without losing events to stale render closures. UI draft text, filters, selection and disclosure state are intentionally transient.
- `src/vendor/personal.mjs`: unmodified B private workspace logic; `personal.d.mts` declares its typed adapter contract. No loose TypeScript `any` is used.
- `src/bSeed.ts`: original B fixture serialized as readonly data. `src/data/sampleData.ts` preserves root fixtures; `src/original` records root types/component provenance.

## Relationships
Project → items, versions, tasks, decisions, conflicts, handoffs. ContextItem → source + related IDs. Packet → copied item records + canonical version + selected-source references. Workspace → original packet + working item snapshots + per-item versions. Receipt → packet/workspace. ChangeEvent → before/after entities and project versions. SyncEvent → workspace + approved item IDs + outcome. Private session → member/project + copied loaded context; old messages keep their own version and item IDs. Study events retain session/condition/scenario/action/actor/time/references.

## State transitions and invariants
Capture creates an unconfirmed inbox item. Category votes are one/member/round. All eligible non-viewer project collaborators must agree; disagreement marks disputed; owner can resolve with rationale or a new round can start. Only confirmation creates canonical version events. Proposals never mutate current context before owner approval. Approval is blocked if the target version changed. Before/after and source records are cloned into version history.

Packets include only explicitly selected, permitted, confirmed, non-inbox items. Unresolved selected source conflicts block generation. Private item names/content/source are redacted from exclusions; only anonymous restriction entries remain. Team-only items can go to named teammates but not AI destinations. A packet's purpose comes from a selected brief, so omitted context is not silently reintroduced. Dependencies and omissions remain inspectable. Packet JSON includes source references, versions, uncertainty, recipient guidance and next action.

A packet load copies exact selected context into a receiving branch and records a receipt. Subsequent canonical changes leave it unchanged. Sync compares per-item revisions plus canonical change history for new items. Governing constraints/approved decisions are conservatively critical; task-keyword/brief matches are relevant; unrelated items low. Users inspect and override recommendations by selecting individual deltas, or decline/defer. No automatic mutation or actual interruption occurs. A partial sync leaves the loaded version old until all eligible pending changes are applied. Previously omitted older items are not silently reintroduced.

B's private simulation receives typed projections from the recipient context. Human-edited and submitted drafts survive automatic inputs and new packet loads. Submission copies only reviewed fields and uses original stale-draft checks. Reviewed canonical changes must pass the normal sync flow before personal context is explicitly loaded/rebased.

## Persistence and limitations
One localStorage key, `crossville-unified-v1`, persists all fictional research state on every successful transition; imports are validated before replacement. Storage failure reports an error and does not claim a save. A malformed existing store falls back to seed in memory; exporting a prior browser backup is recommended for real study operations. Whole-project JSON includes private simulation records and is intended for the local study administrator. This is not encryption or production authorization. No cross-device or simultaneous multi-tab merge is implemented; use one browser tab per study session. LocalStorage capacity limits long studies; JSON exports provide backup. All external tools remain clearly marked simulations.
