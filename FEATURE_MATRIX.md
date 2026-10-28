# Feature preservation matrix

Legend: B = supplied GitHub ZIP; R = available root React prototype; A = browser-inspected Figma Make preview; local source not supplied. Every B and R meaningful interaction is accounted for below. A preservation cannot be verified without source.

| Source feature | Disposition | Unified location / reason |
|---|---|---|
| B/R project switching and independent data | Integrated | Header selector; Study and Campus projects share typed architecture, not contents |
| B/R brief, decisions, constraints, questions | Integrated | Overview, workspace and library; root ethics/task dependencies retained |
| B interviews baseline and pending action research alternative | Preserved | B fixture migration; approval required to adopt alternative |
| B milestone original/current plan, result and progress | Preserved | Typed context metadata and packet sections; approved updates retain milestone metadata |
| B/R before/after, rationale, provenance | Integrated | Review cards and context inspector |
| B/R approve/reject/request revision | Preserved | Owner-only transition checks; revision can be loaded as a new draft |
| B stale proposal prevention | Preserved / refined | Per-target item versions prevent overwrites; unrelated project changes need not invalidate unrelated proposals |
| R affected people and dependent task selections | Preserved | Proposal form; approval flags selected tasks |
| B context source conflict ownership and supersession | Preserved | Conflict review in Overview, Workspace, Builder and History; selected unresolved sources cannot transfer |
| A sorting, consensus, re-voting, disagreements | Implemented from requirements | Shared inbox; one vote/member/round; all eligible editors/owners agree, or owner resolves with rationale |
| A decisions rationale, alternatives, loaded-recipient detail | Consolidated | Rationale/proposal comparison plus Lifecycle details and versioned history; alternatives remain explicit discussion/proposal text rather than a separate list field |
| A constraint strictness/type matrix | Integrated | Must/Prefer + study/privacy metadata, library filters, owner-approved versioned changes |
| A questions lifecycle/assignment/findings/promotion | Integrated | Lifecycle controls, library filters and linked question→decision review; becomes Decided only after owner approval |
| A sorting drag/Keep/Wrong/Undo/keyboard | Consolidated | Accessible category selector, vote/undo and focused-card arrow controls; swipe gestures deliberately replaced for responsive and keyboard use |
| A canvas zoom | Deliberately replaced | Responsive layout and browser zoom; no fixed-scale canvas that clips on tablets |
| A discussions | Implemented from requirements | Context and proposal comments persist across screens |
| B/R handoff task/tool/category selection | Integrated / extended | Item-level selection with categories visible; ChatGPT, Claude, Gemini, Codex, Cursor, NotebookLM, people and Other |
| B retrieval reasons and private/old/proposed filtering | Preserved | Deterministic recommendations plus mandatory boundary checks |
| B four-part packet and source turn refs | Preserved | Purpose, current progress, milestone details, nextAction plus constraints, dependencies and reference URIs |
| B/R packet preview, copy, download | Preserved | Builder saved-packet controls; clipboard failure has manual-copy instructions |
| B/R historical stale handoffs | Preserved / extended | Persistent immutable packet snapshots, newer-version labels and receipts |
| B receiving preview | Replaced by fuller equivalent | Stateful recipient branches with loaded context, progress, missing information and feedback |
| B private notes and member isolation | Preserved | Private exploration under Agent workspaces; exact same personal.mjs logic reused |
| B selected loaded categories / brief always included | Preserved | Private context checkboxes affect new scripted replies |
| B chat and step-by-step scripted replies | Preserved | Versioned messages, source item IDs, tool and simulation labels |
| B extraction on notes/chat, eligibility and pause | Preserved | Notes controls and automatic simulated extraction |
| B draft editing protection, dismiss, regenerate | Preserved | Human editing blocks automatic replacement; explicit suggestions can regenerate |
| B submit shown fields only / no raw private inputs | Preserved | Original submitDraftPayload reused through state adapter |
| B linked submitted drafts and revision/rebase | Preserved | Linked status, rebase/revise and new suggestion; stale submission blocked |
| B new packet preserves personal work | Preserved | Load current branch into existing member/project private workspace |
| B explicit full refresh | Deliberately replaced | Approve selected deltas, then explicitly load working context into private session; avoids replacing entire context |
| B/R dark appearance | Preserved | Header theme button (presentation preference is session-local) |
| B Share explanatory dialog | Consolidated | People & access plus permanent simulation notices; no invitation or external-link sharing action |
| R add members and manage roles | Preserved | Owner controls; retains at least one owner |
| B/R history | Integrated | Versions, before/after changes, actor/tool, receipts, sync outcomes and event trail |
| B browser-local persistence | Preserved / extended | One localStorage repository includes packets and all shared/private state |
| R ephemeral state | Replaced | Persistent state required by unified workflow |
| B reset | Extended | Confirmed reset restores scenario-specific seed and new session |
| A original assets and fixed canvas | Unverified | Exported folder/assets missing; preview verified visually; responsive section canvas implemented from observed UI and requirements |
| Selective adaptive asynchronous sync | New | Critical/relevant/low reasons; approve, decline, defer; partial versions never claim full currency |
| Research conditions and six scenarios | New | Baseline gated at UI and engine; session logging, reset, JSON/CSV export |
| JSON project import/export | New | Whole-local-state round trip with schema and structure validation |

No real external integration existed in available code. No real AI adapter was removed. Prototypes remain runnable independently in the root and `../chatgpt-prototype`.

## Adaptive revision

| Feature | Treatment |
|---|---|
| Shared context, sorting, voting, comments, constraints, questions | Preserved through canonical legacy reducers and reused shared-workspace tools |
| Old private records and versioned packets | Preserved in migrated base; per-owner archive and immutable history |
| Manual handoff builder as primary navigation | Deliberately replaced by task-triggered automation; manual preparation retained in baseline A |
| Manual routine sync | Replaced by policy-authorized selective automatic sync; review/decline preserved for held changes |
| Handoff/source inspector | Integrated into Crossville Context in explainable condition C |
| Research comparison | Expanded to manual, automated opaque and automated explainable |
| Project versions, import/export | Preserved and extended with schema 2 backups and recipient change coverage |
