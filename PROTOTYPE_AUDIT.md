# Prototype audit — 2026-10-27

## Evidence and original build verification

**Prototype A:** `figma-prototype/` was not supplied in the workspace. The user subsequently provided a Figma Make link: https://www.figma.com/make/D3Hl5iP1dsWZwWDJPjadmZ/Extend-Project-Workspace-Review . The public preview was inspected successfully, including the Make editor shell. The editor is sign-up gated and source/code controls are unavailable in this session. The named Workspace.tsx, SortModal.tsx, DecisionsPanel.tsx, ConstraintsPanel.tsx, QuestionsPanel.tsx, consensus.ts and public/assets have not been available locally. No claim of source migration or complete feature fidelity is made for A.

**Prototype B:** imported intact from the user-supplied `/Users/kartika/Downloads/crossville-context-main.zip` into `chatgpt-prototype/` (archive commit f8ef1a3bd63f4d8325a1f3d49737a7fe851f81d8). Earlier GitHub archive/API attempts returned 404; this is resolved by the ZIP. It is a buildless HTML/ES-module app; `npm run build` does not exist. `npm test`: 33/33 pass. `npm run check`: all six modules pass. Source, tests, CSS, README and maintained design handoff were inspected. No external document's past instructions were interpreted as authorization to send invitations, publish, or modify accounts.

**Additional available root prototype:** React + TypeScript + Vite Shared Context Workspace. Inspected models, reducer, seed data, helpers and screens. Original `npm run build` and all 3 tests pass. Root source remains intact.

## 1. Features unique to A, verified in its public preview
Collaborative four-section canvas, pending/conflicting/agreed/superseded decision filters, decision rationale and alternatives, per-person Keep/Wrong category votes, comments, re-vote requests and who-has-this-loaded indicators. Constraints use a Study limits/Privacy and sharing × Must/Prefer matrix, with strictness history and role-based changes. Questions have Open/Exploring/Answered/Decided stages, assignment, findings, history and promotion to decision. Sorting presents suggested category/confidence/reason, team progress, Keep/Wrong category, Undo, drag and keyboard hints. Zoom, theme, activity, agent handoff and private-workspace entry are visible. Source-level persistence and exact behavior of every control cannot be established from preview inspection; no data-changing action was performed on the shared Figma preview. Unified equivalents are based on observed UI and requirements, not a claim of source migration. A's original visual assets cannot yet be compared.

## 2. Verified features unique to B
- Hash-routed project and private workspace pages, context/category and Activity tabs, project picker and right review inspector.
- Task-led retrieval with keyword explanations, explicit sources, current/shared-only selection, proposed/superseded/private exclusions.
- Source conflict pairs requiring a non-viewer source owner to keep one and supersede the other.
- Four-part packets: overall goal, current progress, milestone details (original plan, current approach, rationale, result, open issues), next steps, constraints and source turns.
- Private member/project workspaces, loaded category selection, personal notes, extraction eligibility, automatic extraction switch, scripted versioned conversations.
- Editable/dismissable/regeneratable suggestions; automatic input preserves human edits and submitted proposal links. Rebase/revise against updated context.
- Only shown draft fields enter review; conversations and notes are excluded. Viewer exploration permitted; submission requires owner/editor. Old messages keep their original context references.
- New packet loads preserve existing private notes, conversation and draft. Explicit context refresh; stale draft protection.
- Browser-local persistence, malformed saved-state recovery, dark theme, reset, clipboard fallback, packet download.
- Share dialog explains simulated membership; it does not send invitations.

## 3. Overlap and consolidation
All available sources have project briefs, decisions, constraints, questions, local actor roles, owner review, before/after proposals, versions, provenance, handoff text and history. Unified versions of these use one store and the same IDs. The root prototype adds explicit affected people/tasks and owner-managed membership. See FEATURE_MATRIX.md for individual dispositions.

## 4. Current models and storage
B: `Project` with items/proposals/conflicts/activity, item access/status/revision/source conversation+turn/milestone, snapshots, private workspaces with notes/messages/draft. `createDemoService` is an asynchronous adapter over browser localStorage, with separate project and private keys. No actual HTTP backend or real model adapter. Recent packet shortcuts are session-only. Domain rules live in domain.mjs; private behavior in personal.mjs; rendering in app.mjs/private-ui.mjs.

Root: React Context/useReducer; members/projects/memories/tasks/slices/proposals/events; strings for IDs; project memoryVersion and item versions. All state is in memory; refresh loses it. Form drafts are component state. UI checks are stronger than the old reducer's permission enforcement.

## 5. Simulation versus functional behavior
Both available sources simulate users/tools and AI responses. B's retrieval and extraction are deterministic, but change persistent demo records. Root formatting/clipboard is functional; no external transfers. Share is explanatory. No authentication, external chat search, external AI APIs, real background AI or live collaboration exists. Unified UI labels simulations; transfers create packets, receipts and usable receiving state.

## 6. Differences and risks
B is buildless imperative DOM/ES modules; root is React/TS. B uses plural categories and active/superseded/proposed; root uses singular categories and memory versions. Both have overlapping method IDs with different approved approaches. Migration chooses B's interviews baseline and preserves its pending action-research proposal, rather than silently promoting it to an approved decision. Root's ethics constraint, dependent tasks and additional question remain. Campus projects are consolidated; B's richer fixtures supply four sections. Private notes stay member-scoped. Full JSON export intentionally contains the entire fictional local dataset.

Risk mitigations: typed adapter around B's unchanged private-workspace module; singular unified categories; stable IDs; permission/privacy filtering at transitions; clone snapshots; optimistic item version checks; explicit partial sync with per-item versions; malformed import checks; no production-security claims. Source conflict changes are versioned and supersede alternatives. Relevance is conservative category/keyword logic, inspectable and overridable, not an AI judgment.

## 7. Unified navigation and architecture
Overview → Shared workspace → Context library → Handoff builder → Agent workspaces → Activity & sync, with supporting People & access and Research Mode. One canonical State owns all projects/context/decisions/votes/comments/versions/packets/workspaces/changes/sync/study records. Reused B personal logic runs against typed projections of that state; no second private persistence store is introduced. Historical packets remain independent from mutable receiving context. Baseline hides structured navigation and blocks structured mutations in the transition boundary.

## Feature preservation checklist
- [x] Inspect and preserve available originals.
- [x] Run root build/tests and B tests/module checks.
- [x] Migrate B fixtures, source references, pending proposal, conflict and milestone metadata.
- [x] Reuse B private simulation/extraction implementation with typed adapter.
- [x] Consolidate root role, impact, task, slice and approval features.
- [x] Inspect A public preview and build consensus, section canvas, rule classification, question lifecycle/promotion and loaded-recipient indicators from verified UI plus requirements.
- [x] Add local persistence, JSON import/export, immutable packets and receiving state.
- [x] Add selective sync and feedback review loop.
- [x] Add research conditions/scenarios and JSON/CSV logs.
- [x] Document intentional changes and simulation boundaries.
- [ ] Verify A against its original source/assets (local files unavailable).
