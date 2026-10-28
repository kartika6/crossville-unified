# Crossville — unified context handoff research prototype

A runnable, local-first research app connecting **Capture → Organize → Agree → Prepare → Inspect → Transfer → Continue → Sync → Review** through one shared state model. All AI tools and collaboration identities are explicitly simulated. No API key, paid service or account is required.

## Start the app

Install **Node.js 24 or newer** (includes npm). Open a terminal and run:

```sh
git clone https://github.com/kartika6/crossville-unified.git
cd crossville-unified
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Open **http://127.0.0.1:5173/** in your browser. Leave that terminal running. Stop with **Ctrl+C**. Alternatively download this repository as a ZIP, extract it and open a terminal in the extracted folder before running `npm ci`. The lockfile pins tested dependencies; use `npm install` if intentionally updating them.

## Tests, type check and production build

Run from the repository folder:

```sh
npm test
npm run check
npm run build
npm run preview -- --host 127.0.0.1 --port 4174
```

`npm test` runs the critical workflow tests using Node's built-in test runner. `npm run check` checks strict TypeScript types. `npm run build` creates deployable static files in `dist/`. The optional preview serves those production files at **http://127.0.0.1:4174/**. No server backend is needed.

## Try the continuous workflow

1. Open **Shared workspace**. Add a fictional conversation memory and source reference. It appears in the sorting inbox.
2. Cast a category vote, then switch the **Person** selector through Teammate A, Teammate B and Professor and vote. Agreement categorizes it; different votes create a visible conflict. Start a re-vote or resolve as an owner with rationale. Undo is available before consensus; focus a sorting card and use Right to vote or Left to undo.
3. As **You**, review the pending methodology proposal. Inspect before/after, rationale, affected people/tasks and discussion; approve. The canonical project version increases. Other editors can propose and discuss; owners approve, reject or request revision.
4. In **Handoff builder**, choose **Codex** and the prefilled continuation task. Recommend context, inspect the rules and sources, override inclusions, and preview. Resolve the pilot-duration source conflict if you want either conflicting source in the packet. Private, unconfirmed and superseded content cannot be sent.
5. Generate the historical packet, then **Transfer to simulated Codex**. Record progress and missing context in the receiving workspace. Copy/download produces actual text/JSON; no external AI receives data.
6. Return to Shared workspace and approve a later method or constraint proposal. The recipient keeps its earlier context. In **Agent workspaces**, inspect the sync recommendation and before/after, then decline, defer or approve individual changes. Partial sync preserves any remaining stale items and the old loaded version.
7. Submit a finding from the recipient to shared review; approve as owner. It becomes canonical context and appears in future sync recommendations.
8. Inspect **Activity & sync** for snapshots, changes, source history, receipts and sync outcomes.

## Preserved private exploration

**Open my private workspace** in Shared workspace creates a local context handoff and opens the associated receiving branch. Alternatively load a particular branch into your private workspace in Agent workspaces. Notes, conversations, extraction eligibility, automation controls, protected human edits, manual drafts, selected-response suggestions, proposal targets and stale-draft checks reuse Prototype B's behavior. Only reviewed draft fields are submitted, never the raw notes or conversation. Switch person/project to inspect separate private sessions. Sync a branch, explicitly load its updated context, then rebase/revise an old draft. Old messages and original handoff snapshots remain unchanged.

## Figma-preview lifecycle features

Constraint details support **Must/Prefer** strictness and **Study limits/Privacy and sharing** groups, with owner review and versioned updates. Questions support assignment, findings, **Open → Exploring → Answered → Decided**, and promotion of findings through an approved decision proposal. Library filters expose those classifications. Details show which recipients have loaded an item and which are behind.

## Data and study controls

Changes persist in browser localStorage under `crossville-unified-v1`. Use **Export project JSON** to back up the complete fictional local dataset, including private simulation records. **Import project JSON** restores a validated Crossville export. A malformed import is rejected before replacing state. Handoff exports contain only permitted selected snapshots; project backups have a different scope.

Research mode provides six scenarios, **Baseline** manual text handoff and **Crossville** structured handoff conditions, task start/completion, session IDs and JSON/CSV event export. Baseline hides structured tools and blocks their mutations. **Reset current scenario** asks for confirmation, restores its seed, clears prior work/logs and starts a fresh session. See [RESEARCH_MODE.md](RESEARCH_MODE.md). Export before resetting. Use one tab per study session; simultaneous tab edits are not merged.

## Sources and limitations

- The available original React prototype remains intact in the original integration workspace (`Crossvile/src`); it is not duplicated in this standalone repository. Its models, layout, roles and impact/task review informed the unified implementation.
- The original GitHub prototype from the supplied ZIP remains intact in the original integration workspace (`Crossvile/chatgpt-prototype`); it is not duplicated here. Its fixtures, milestone/source data and private-workspace module are integrated here, rather than embedded as a separate app.
- Prototype A's public Figma Make preview was inspected for sorting, consensus, constraint and question interactions. Its local exported source/assets are still unavailable; exact source-level preservation cannot be certified. The original gestures are replaced by accessible buttons/keyboard controls. Providing its exported code ZIP would enable exact remaining comparisons and asset reuse.
- All provider integrations, retrieval, extraction and replies are simulations. No proprietary account connection, model API, real background agent, authentication or realtime multi-user database is implemented or claimed.
- Client roles and local private sessions are research controls, not secure account isolation. localStorage has browser quota limits. Full project exports contain local private simulation data. Use fictional materials.
- No research measurements or outcomes have been invented. Study material equivalence and accessibility need study-team pilot validation.

## Documentation and verification

- [PROTOTYPE_AUDIT.md](PROTOTYPE_AUDIT.md): evidence, source differences, models, simulation and integration risks.
- [FEATURE_MATRIX.md](FEATURE_MATRIX.md): feature-by-feature preservation and deliberate replacements.
- [ARCHITECTURE.md](ARCHITECTURE.md): data ownership, invariants, snapshot and sync rules.
- [RESEARCH_MODE.md](RESEARCH_MODE.md): study conditions, tasks, reset and logging.
- [VERIFICATION.md](VERIFICATION.md): automated checks and actual browser walkthrough evidence.
- [docs/CONTEXT_HANDOFF.md](docs/CONTEXT_HANDOFF.md): implementation handoff for future developers.


## Live prototype and GitHub Pages

**Open the interactive prototype:** https://kartika6.github.io/crossville-unified/

The public GitHub Pages site serves an explicit production snapshot from the root of the `gh-pages` branch. The `main` branch contains editable source.

```sh
npm ci
npm test
npm run build:pages
```

`build:pages` uses the `/crossville-unified/` asset base path. To update the hosted prototype, publish the contents of `dist/` plus an empty `.nojekyll` file to the `gh-pages` branch. Source edits on `main` do not automatically rebuild the hosted snapshot. No participant browser data, personal localStorage state, credentials or installed dependencies are deployed.
