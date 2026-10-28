# Verification record — 2026-10-27

## Automated checks

- Available root prototype: original production build passes; 3 original tests pass.
- Uploaded Prototype B (`../chatgpt-prototype`): 33 original domain/service/personal tests pass; `npm run check` validates all 6 browser modules. Buildless project has no build script. Original server was started and its private workspace was inspected in-browser.
- Unified prototype: **35/35 tests pass** with Node 24 strip-types runner; strict TypeScript check passes; Vite **8.3.5** production build passes. Standalone dependencies are installed, pinned and locked in this folder.
- Lockfile preparation reported a Vite dev-server advisory in inherited 8.3.1. Unified app was updated to patched 8.3.5; dependency install reports **0 vulnerabilities**. Original dependencies were preserved.

The tests cover capture/shared inbox, one-vote-per-member, consensus, disagreement, owner resolution, re-voting/history, undo, permission boundaries, proposal approval/version/task/provenance, reject/revise, stale conflicts, permitted selection, private redaction, team-only privacy, source conflict/supersession, packet immutability, exact recipient load/receipt, critical/relevant/low rules, inspectable sync logs, decline/defer invariance, selective partial sync and loaded-version correctness, reviewed recipient feedback, persistence round trips, malformed nested import rejection, study reset/session/scenario fixtures, JSON/CSV log contents, task lifecycle and baseline gating, comments, private member isolation/human edit protection, private payload exclusion, submitted-draft protection, direct personal entry/manual target selection, stable draft tool provenance, earlier-response extraction and preserved old messages.

## Actual browser verification

Using the app's browser controls against the local Vite server:

1. Inspected Overview, project context cards and navigation.
2. Opened Handoff builder; selected Codex, used the prefilled continuation task, recommended context. Confirmed 6 permitted selected items; private/tentative/superseded/conflicting items disabled and source references visible.
3. Opened JSON preview; checked purpose, methodology/milestone/rationale, constraints, dependencies, exclusions and recipient guidance.
4. Generated historical packet, transferred to simulated Codex. Confirmed exact loaded context, task, packet ID and v4 receipt-backed receiving branch.
5. Recorded task progress. Returned to Workspace; approved methodology proposal and submitted a sorting vote. Confirmed canonical v5 while Codex retained v4 and original interview methodology.
6. Opened critical sync recommendation and checked the before/after methodology. Declined it, then selected and approved the delta. Confirmed recipient v5, new method and no remaining eligible changes.
7. Opened the private workspace from loaded branch. Confirmed versioned scripted response, selected context, notes/eligibility/automation and editable draft controls.
8. Submitted a new Codex finding for shared review. Reloaded page; confirmed v5, pending feedback, preserved progress and dependent-task flags.
9. Entered Research Mode and applied Baseline. Confirmed structured navigation, project exports and canonical version card disappeared. Started task, edited/saved a manual summary, completed task.
10. Opened reset. Native modal isolated focus with Cancel initially focused; reset restored starting canonical data and a fresh session. A retained form-draft issue discovered during this check was fixed by keying the research form to session ID. Baseline source narrative now derives from the same current fictional shared context, without structured controls.
11. Narrow layout was visually inspected in the app side panel. Initial overflow was repaired with minimum-width constraints and wrapping. Desktop/tablet CSS breakpoints are implemented; this environment's browser pane did not provide a controlled full desktop viewport sweep. No claim of exhaustive visual/accessibility certification.

## Prototype A evidence

Public Figma Make preview successfully opened. Inspected decision filters/details, votes/discussion/loaded versions; constraint Must/Prefer and Study/Privacy matrix/details/role preview; question filters/ownership/findings/lifecycle/promotion; sorting suggested category, confidence/reason disclosure, Keep/Wrong category, Undo and keyboard hints. Editor view is sign-up gated and does not expose source/code controls in this session. Source-level builds, storage semantics and asset parity for A remain unverified.

## Reproduce

From `unified-app`:

```sh
npm ci
npm test
npm run check
npm run build
npm run dev -- --host 127.0.0.1 --port 5173
```

Use the walkthrough in README and RESEARCH_MODE. All source data is fictional; no external provider transmission, invitations or deployment was performed. Browser checks are a recorded manual walkthrough, not an automated cross-browser suite. Automated tests exercise domain/repository behavior rather than rendering screenshots.


## GitHub Pages deployment — 2026-10-27

Live URL: https://kartika6.github.io/crossville-unified/ . Re-ran all 35 tests and built with `npm run build:pages` (Vite base `/crossville-unified/`). Published `.nojekyll`, index.html and the generated JS/CSS assets to the root of `gh-pages`, deployment commit `2c78b0bf21677222f00bd14bb0b79026705e78e3`. GitHub Pages settings confirmed that source. The hosted URL returned HTTP 200, rendered the React application, and live Handoff builder recommendations selected 6 permitted items while private/unconfirmed/conflicting sources remained disabled. The source repository is now public. Deployments are explicit snapshots; editing main does not automatically republish.
