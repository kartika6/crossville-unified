# Adaptive verification

- `npm test`: 46 passing tests (35 preserved collaboration tests and 11 automation tests).
- `npm run check`: passes TypeScript checking.
- `npm run build`: passes production bundling.
- Browser-driven walkthrough completed against local Vite: private Claude prompt → private candidate → explicit proposal → Professor approves v5 → Teammate A starts Codex task → local context/receipt loaded v5 without manual preparation → NotebookLM proposes two fields → Professor approves v6 → Codex automatically contains both fields and a v6 acknowledgement → Codex task completion creates proposed question → Professor approval reaches v7.
- Reload retained v7, approved proposals, loaded workspaces and guided-story position.
- Desktop and 390px narrow-screen screenshots inspected. Tablet CSS breakpoint is implemented; a browser-control timeout prevented completing a separate tablet interaction check. No exhaustive screen-reader audit has been performed. Native labeled controls, keyboard focus styles, native modal dialogs, live status text and reduced-motion styles are included.
- Tests cover selection privacy/status/conflicts, deduplication, immutable packets, actual recipient delivery, critical review/decline/approval, notify policy, all three conditions, persistence/reset/export, paused stepping and an in-flight version race.

Known simulation scope: scripted responses, deterministic category/tag/dependency relevance, local delivery/receipts, local role switching. Real platform API adapters, true multi-user network collaboration and authentication are intentionally outside scope. The new revision is runnable locally; the existing public GitHub Pages deployment has not been updated by this implementation pass.
