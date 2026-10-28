import { useEffect, useRef, useState, type ReactNode } from "react";
import { AdaptiveProvider, useSimulation } from "./context";
import {
  currentRecipient,
  workspace,
  canAdvance,
  exportEvents,
} from "./engine";
import { APPROACH, UPDATE, personName } from "./seed";
import { selectContext } from "./selection";
import {
  TOOLS,
  STAGES,
  type Recipient,
  type Condition,
  type Candidate,
  type SyncPolicy,
  type Importance,
  type AdaptiveState,
} from "./types";
import type { ContextItem } from "../model";
import {
  ProjectTools,
  ContextLibrary,
  PeopleAccess,
  ItemWorkflow,
  Discussion,
} from "../App";
import { Avatar, Layers, LockIcon } from "../figma/primitives";
import { download, parseState } from "../repository";
import { parseAdaptive } from "./repository";
import { adaptiveSeed } from "./seed";
import "./adaptive.css";
const PAGES = [
  "Shared workspace",
  "My workspace",
  "Activity & synchronization",
  "Team & tools",
  "Automation settings",
];
function Button({
  children,
  onClick,
  disabled = false,
  primary = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      className={`cv-button ${primary ? "primary" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`cv-badge ${tone}`}>{children}</span>;
}
function Dialog({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      className="cv-dialog"
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="cv-row">
        <h2 id="dialog-title">{title}</h2>
        <button
          autoFocus
          className="cv-icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export default function AdaptiveApp() {
  return (
    <AdaptiveProvider>
      <Shell />
    </AdaptiveProvider>
  );
}
function Shell() {
  const { state: s, send, legacy, error, clearError } = useSimulation();
  const [dark, setDark] = useState(false);
  const [reset, setReset] = useState(false);
  const p = s.base.projects.find((p) => p.id === s.base.activeProjectId)!;
  const actor = s.base.members.find((m) => m.id === s.view.actorId)!;
  const scenePrivate = s.view.page === "My workspace";
  return (
    <div className={`adaptive-shell ${dark ? "cv-dark" : ""}`}>
      <div className="cv-study-strip">
        <span>
          {s.story.active ? "GUIDED STORY" : "RESEARCH SIMULATION"} · FICTIONAL
          DATA · SIMULATED AI
        </span>
        <span>
          {s.study.condition === "manual"
            ? "A · Manual baseline"
            : s.study.condition === "opaque"
              ? "B · Automated opaque"
              : "C · Automated explainable"}
        </span>
      </div>
      <header className="cv-topbar">
        <div className="cv-brand">
          <Layers />
          <strong>Crossville</strong>
          <span>shared context, individual thinking</span>
        </div>
        <div className="cv-top-controls">
          <div className="cv-avatar-stack">
            {s.base.members.slice(0, 4).map((m) => (
              <Avatar key={m.id} name={m.name} small />
            ))}
          </div>
          <label className="cv-person-select">
            <span>Working as</span>
            <select
              aria-label="Selected collaborator"
              value={actor.id}
              onChange={(e) => legacy({ type: "member", id: e.target.value })}
            >
              {s.base.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="cv-icon-button"
            onClick={() => setDark(!dark)}
            aria-label="Toggle light and dark appearance"
          >
            ◐
          </button>
        </div>
      </header>
      <div className="cv-layout">
        <aside className="cv-sidebar">
          <div className="cv-team">
            <span className="cv-team-mark">R</span>
            <div>
              <b>Research workspace</b>
              <small>Team workspace</small>
            </div>
          </div>
          <div className="cv-nav-label">PROJECTS</div>
          <label className="cv-project-picker">
            <img
              src={`${import.meta.env.BASE_URL}assets/figma/57349.svg`}
              alt=""
            />
            <select
              aria-label="Project"
              value={p.id}
              onChange={(e) => legacy({ type: "project", id: e.target.value })}
            >
              {s.base.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="cv-nav-label">
            PROJECT CONTEXT <Badge>v{p.version}</Badge>
          </div>
          <nav aria-label="Crossville navigation">
            {PAGES.map((page, i) => (
              <button
                key={page}
                className={`cv-nav ${s.view.page === page ? "active" : ""}`}
                onClick={() =>
                  page === "My workspace"
                    ? send({
                        type: "OPEN_WORKSPACE",
                        personId: s.view.actorId,
                        tool: s.view.tool,
                      })
                    : send({ type: "NAVIGATE", page })
                }
              >
                <span aria-hidden>{["▦", "◇", "↻", "♧", "⚙"][i]}</span>
                {page}
              </button>
            ))}
          </nav>
          <div className="cv-private-invite">
            <LockIcon />
            <b>Your thinking. Your space.</b>
            <p>
              Work with your AI privately.
              <br />
              Share only what’s ready.
            </p>
            <Button
              onClick={() =>
                send({
                  type: "OPEN_WORKSPACE",
                  personId: s.view.actorId,
                  tool: s.view.tool,
                })
              }
            >
              Open my workspace ↗
            </Button>
          </div>
          <button
            className="cv-story-link"
            onClick={() =>
              send({ type: s.story.active ? "STORY_EXIT" : "STORY_OPEN" })
            }
          >
            ◉ {s.story.active ? "Exit guided story" : "Guided story"}{" "}
            <span>7 scenes</span>
          </button>
          <div className="cv-sidebar-bottom">
            <div>
              <Avatar name={actor.name} />
              <span>
                <b>{actor.name}</b>
                <small>{actor.role} · local simulation</small>
              </span>
            </div>
            <button onClick={() => setReset(true)} className="cv-reset-link">
              ↻ Reset Demo
            </button>
          </div>
        </aside>
        <main className={`cv-main ${s.story.active ? "with-guide" : ""}`}>
          <div className="cv-main-tabs">
            <span className="selected">
              {scenePrivate
                ? "Private workspace"
                : s.view.page === "Shared workspace"
                  ? "Project context"
                  : s.view.page}
            </span>
            {scenePrivate ? (
              <Badge>
                <LockIcon /> Private by default
              </Badge>
            ) : (
              <span className="cv-muted">
                Shared Context Study · v{p.version}
              </span>
            )}
          </div>
          {error && (
            <div className="cv-error" role="alert">
              {error}
              <button onClick={clearError} aria-label="Dismiss error">
                ×
              </button>
            </div>
          )}
          {s.migrationNotice && (
            <div className="cv-callout">
              Your existing project, history and private work have been
              preserved. Reset Demo starts the standardized two-week pilot
              scenario; the original browser storage remains available in
              settings.
            </div>
          )}
          {s.view.page === "Shared workspace" ? (
            <SharedWorkspace />
          ) : s.view.page === "My workspace" ? (
            <PrivateWorkspace
              key={`${s.base.activeProjectId}:${s.view.actorId}:${s.view.tool}`}
            />
          ) : s.view.page === "Activity & synchronization" ? (
            <Activity />
          ) : s.view.page === "Team & tools" ? (
            <div className="cv-page-content">
              <div className="cv-page-heading">
                <span>PEOPLE & PLATFORMS</span>
                <h1>A team. Many tools.</h1>
                <p>Local collaborators and simulated AI workspaces.</p>
              </div>
              <div className="legacy-content">
                <PeopleAccess state={s.base} send={legacy} />
              </div>
              <div className="cv-tool-grid">
                {TOOLS.map((tool) => (
                  <button
                    key={tool}
                    onClick={() =>
                      send({
                        type: "OPEN_WORKSPACE",
                        personId: s.view.actorId,
                        tool,
                      })
                    }
                  >
                    <span className={`cv-tool-mark ${tool.toLowerCase()}`}>
                      {tool[0]}
                    </span>
                    <b>{tool}</b>
                    <small>Simulated workspace ↗</small>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <Settings />
          )}
        </main>
        <ContextIntelligencePanel />
      </div>
      {s.story.active && <GuidedStory onReset={() => setReset(true)} />}
      <footer className="cv-footer">
        <span>Shared context, individual thinking.</span>
        <span>
          Deterministic local simulation · No real AI provider is connected
        </span>
      </footer>
      {reset && (
        <Dialog
          title="Restore the guided scenario?"
          close={() => setReset(false)}
        >
          <p>
            This resets the active demo to v4, clears its events and restores
            all recipient versions. Export a backup in Automation settings first
            if you want to retain this run.
          </p>
          <div className="cv-actions">
            <Button onClick={() => setReset(false)}>Cancel</Button>
            <Button
              primary
              onClick={() => {
                if (send({ type: "RESET" })) setReset(false);
              }}
            >
              Reset Demo
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
const titles: Record<string, string> = {
  brief: "Understanding how we work with AI",
  decision: "Our research methodology",
  constraint: "Keep the study small and safe",
  open_question: "What do we still need to learn?",
};
function SharedWorkspace() {
  const { state: s, send, legacy } = useSimulation();
  const [details, setDetails] = useState<ContextItem | null>(null);
  const p = s.base.projects.find((p) => p.id === s.base.activeProjectId)!;
  const shared = s.base.items.filter(
    (i) =>
      i.projectId === p.id &&
      i.status === "confirmed" &&
      i.privacy !== "private" &&
      !s.base.conflicts.some(
        (c) => c.status === "unresolved" && c.itemIds.includes(i.id),
      ),
  );
  return (
    <div className="cv-page-content">
      <div className="cv-page-heading">
        <span>THE TEAM’S SOURCE OF TRUTH</span>
        <h1>
          A little context.
          <br />A shared direction.
        </h1>
        <p>What we know, what we’ve decided, and what’s still open.</p>
        <div className="cv-inline-meta">
          Project context v{p.version}
          <i />4 connected sections
          <i />
          {p.memberIds.length} collaborators
        </div>
      </div>
      <div className="cv-context-grid">
        {(["brief", "decision", "constraint", "open_question"] as const).map(
          (category, index) => {
            const group = shared.filter((i) => i.category === category);
            const item =
              (category === "constraint"
                ? group.find((i) => /synthetic/i.test(i.content))
                : undefined) || group[0];
            return (
              <section className="cv-context-cell" key={category}>
                <div className="cv-section-label">
                  <span>
                    {category === "open_question"
                      ? "Open questions"
                      : category[0].toUpperCase() +
                        category.slice(1) +
                        (category === "decision" || category === "constraint"
                          ? "s"
                          : "")}
                  </span>
                  <span>0{index + 1}</span>
                </div>
                <button
                  className="cv-context-card"
                  onClick={() => item && setDetails(item)}
                  disabled={!item}
                >
                  <div className="cv-card-top">
                    <span>
                      {category === "constraint" ? <LockIcon /> : "◇"}{" "}
                      {category.replace("_", " ")}
                    </span>
                    <Badge>v{item?.version || 0}</Badge>
                  </div>
                  <div className="cv-card-body">
                    <h2>{titles[category]}</h2>
                    {category === "decision" && (
                      <small className="cv-eyebrow">CURRENT APPROACH</small>
                    )}
                    <p>{item?.content || "No approved item yet."}</p>
                    {category === "brief" && (
                      <>
                        <Badge tone="blue">Research focus</Badge>
                        <p className="cv-muted">
                          One shared context. Many private workspaces.
                        </p>
                      </>
                    )}
                    {category === "constraint" && (
                      <Badge tone="blue">Must · Privacy and sharing</Badge>
                    )}
                    {category === "open_question" && group.length > 1 && (
                      <span className="cv-additional">
                        + {group.length - 1} more open questions
                      </span>
                    )}
                  </div>
                  <div className="cv-card-footer">
                    <Avatar
                      name={item ? personName(s, item.authorId) : "You"}
                      small
                    />
                    <span>
                      {item ? personName(s, item.authorId) : "Team"} via{" "}
                      {item?.source.tool}
                      <small>
                        {item?.status === "confirmed"
                          ? "Approved shared context"
                          : "Awaiting confirmation"}
                      </small>
                    </span>
                    <span>↗</span>
                  </div>
                </button>
              </section>
            );
          },
        )}
      </div>
      <div className="cv-boundary-note">
        <LockIcon />
        <span>
          Automatic detection doesn’t mean automatic publication. Private work
          enters shared context only through a reviewed proposal.
        </span>
      </div>
      <ReviewQueue />
      <details className="cv-project-tools">
        <summary>
          Organize project context · sorting, votes, constraints & questions
        </summary>
        <p className="cv-muted">
          Existing collaboration tools use the same project records as the
          automation engine.
        </p>
        <div className="legacy-content">
          <ProjectTools
            state={s.base}
            send={legacy}
            openAgents={() =>
              send({
                type: "OPEN_WORKSPACE",
                personId: s.view.actorId,
                tool: s.view.tool,
              })
            }
          />
          <ContextLibrary
            state={s.base}
            send={legacy}
            handoff={() =>
              send({
                type: "OPEN_WORKSPACE",
                personId: s.view.actorId,
                tool: s.view.tool,
              })
            }
          />
        </div>
      </details>
      {details && (
        <Dialog
          title={titles[details.category] || "Context item"}
          close={() => setDetails(null)}
        >
          <p>{s.base.items.find((i) => i.id === details.id)?.content}</p>
          <dl className="cv-definition">
            <dt>Source</dt>
            <dd>
              {details.source.label}
              <br />
              {details.source.reference}
            </dd>
            <dt>Rationale</dt>
            <dd>{details.rationale || "No rationale recorded."}</dd>
            <dt>Dependencies</dt>
            <dd>{details.dependencies.join(", ") || "None recorded"}</dd>
          </dl>
          <div className="legacy-content">
            <ItemWorkflow
              item={s.base.items.find((i) => i.id === details.id) || details}
              state={s.base}
              send={legacy}
            />
            <Discussion id={details.id} state={s.base} send={legacy} />
          </div>
          <h3>Other current items in this section</h3>
          {shared
            .filter(
              (i) => i.category === details.category && i.id !== details.id,
            )
            .map((i) => (
              <article className="cv-selection" key={i.id}>
                <p>{i.content}</p>
                <small>{i.source.reference}</small>
                <Button onClick={() => setDetails(i)}>Inspect this item</Button>
              </article>
            ))}
          <h3>Earlier versions</h3>
          {s.base.versions
            .filter((v) => v.projectId === p.id)
            .map((v) => (
              <p className="cv-history-line" key={v.id}>
                v{v.version} ·{" "}
                {v.items.find((i) => i.id === details.id)?.content ||
                  "Not present in this version"}
              </p>
            ))}
        </Dialog>
      )}
    </div>
  );
}
function ReviewQueue() {
  const { state: s, send, legacy } = useSimulation();
  const proposals = s.base.decisions.filter(
    (d) => d.projectId === s.base.activeProjectId,
  );
  const actor = s.base.members.find((m) => m.id === s.view.actorId)!;
  return (
    <section className="cv-review-queue">
      <div className="cv-section-heading">
        <div>
          <span className="cv-eyebrow">HUMAN REVIEW, SHARED UNDERSTANDING</span>
          <h2>
            Pending review{" "}
            <Badge>
              {proposals.filter((d) => d.status === "pending").length}
            </Badge>
          </h2>
        </div>
        <span className="cv-muted">
          Reviewing as {actor.name} · {actor.role}
        </span>
      </div>
      {!proposals.some((d) => d.status === "pending") && (
        <p className="cv-empty">
          All caught up. Private candidates remain in their owner’s workspace.
        </p>
      )}
      {proposals
        .slice()
        .reverse()
        .map((d) => (
          <article key={d.id} className="cv-review-card">
            <div className="cv-row">
              <div className="cv-source-person">
                <Avatar name={personName(s, d.authorId)} small />
                <b>{personName(s, d.authorId)}</b>
                <span>via {d.source.tool}</span>
              </div>
              <Badge
                tone={
                  d.status === "approved"
                    ? "green"
                    : d.status === "pending"
                      ? "blue"
                      : "neutral"
                }
              >
                {d.status}
              </Badge>
            </div>
            {(
              s.patches[d.id] || [
                {
                  targetId: d.targetId,
                  content: d.content,
                  rationale: d.rationale,
                },
              ]
            ).map((patch, index) => {
              const patchRecord = s.patches[d.id]?.[index];
              const before =
                patchRecord?.baseVersion === 0
                  ? undefined
                  : d.before ||
                    s.base.changes
                      .flatMap((c) => c.before)
                      .find((i) => i.id === patch.targetId)?.content ||
                    s.base.items.find((i) => i.id === patch.targetId)?.content;
              return (
                <div className="cv-proposal-fields" key={index}>
                  <div>
                    <small>BEFORE</small>
                    <p>{before || "New shared context item"}</p>
                  </div>
                  <div className="after">
                    <small>PROPOSED</small>
                    <p>{patch.content}</p>
                  </div>
                  <p className="cv-proposal-rationale">
                    Why: {patch.rationale}
                  </p>
                </div>
              );
            })}
            <div className="cv-private-exclusion">
              <LockIcon /> Only these proposed fields are shared. Raw notes and
              conversation remain private.
            </div>
            {d.status === "pending" && (
              <div className="cv-actions">
                <Button
                  primary
                  disabled={actor.role !== "owner"}
                  onClick={() =>
                    s.patches[d.id]
                      ? send({
                          type: "REVIEW_PROPOSAL",
                          id: d.id,
                          outcome: "approved",
                        })
                      : legacy({
                          type: "resolve",
                          id: d.id,
                          status: "approved",
                        })
                  }
                >
                  Approve change
                </Button>
                <Button
                  disabled={actor.role !== "owner"}
                  onClick={() =>
                    s.patches[d.id]
                      ? send({
                          type: "REVIEW_PROPOSAL",
                          id: d.id,
                          outcome: "revision",
                        })
                      : legacy({
                          type: "resolve",
                          id: d.id,
                          status: "revision",
                        })
                  }
                >
                  Request revision
                </Button>
                <Button
                  disabled={actor.role !== "owner"}
                  onClick={() =>
                    s.patches[d.id]
                      ? send({
                          type: "REVIEW_PROPOSAL",
                          id: d.id,
                          outcome: "rejected",
                        })
                      : legacy({
                          type: "resolve",
                          id: d.id,
                          status: "rejected",
                        })
                  }
                >
                  Reject
                </Button>
              </div>
            )}
            <div className="legacy-content">
              <Discussion id={d.id} state={s.base} send={legacy} />
            </div>
            {actor.role !== "owner" && d.status === "pending" && (
              <p className="cv-muted">
                Switch the collaborator to Professor or You to review this
                proposal.
              </p>
            )}
          </article>
        ))}
    </section>
  );
}
function PrivateWorkspace() {
  const { state: s, send } = useSimulation();
  const r = currentRecipient(s);
  const [text, setText] = useState("");
  const [notes, setNotes] = useState(r?.notes || "");
  const [eligible, setEligible] = useState(r?.notesEligible || false);
  const [missing, setMissing] = useState("");
  const w = workspace(s, r);
  const actor = s.base.members.find((m) => m.id === s.view.actorId)!;
  return (
    <>
      <header className="cv-workspace-title">
        <div className={`cv-tool-mark ${s.view.tool.toLowerCase()}`}>
          {s.view.tool[0]}
        </div>
        <div>
          <h1>{r?.task?.title || "Your private project workspace"}</h1>
          <p>
            {actor.name} with {s.view.tool} ·{" "}
            {w
              ? `Context v${w.loadedVersion} · ${w.items.length} authorized items`
              : "Start a task to make context available"}
          </p>
        </div>
        <select
          aria-label="Simulated AI tool"
          value={s.view.tool}
          onChange={(e) =>
            send({
              type: "OPEN_WORKSPACE",
              personId: s.view.actorId,
              tool: e.target.value as Recipient["tool"],
            })
          }
        >
          {TOOLS.map((tool) => (
            <option key={tool}>{tool}</option>
          ))}
        </select>
      </header>
      {!r && (
        <div className="cv-empty">
          <p>Open this tool’s workspace to begin.</p>
          <Button
            primary
            onClick={() =>
              send({
                type: "OPEN_WORKSPACE",
                personId: s.view.actorId,
                tool: s.view.tool,
              })
            }
          >
            Open workspace
          </Button>
        </div>
      )}
      {r && !r.task && (
        <div className="cv-task-start">
          <span className="cv-task-symbol">↗</span>
          <h2>Pick up where the team left off.</h2>
          <p>
            Start your work. Crossville handles the authorized project context
            in the background.
          </p>
          <Button
            primary
            onClick={() => send({ type: "START_TASK", recipientId: r.id })}
          >
            {["Codex", "Cursor"].includes(r.tool)
              ? "Continue prototype development"
              : "Explore research approach"}
          </Button>
          <small>Local AI simulation · No external account is connected</small>
        </div>
      )}
      {r?.task && (
        <>
          <div className="cv-task-state">
            <Badge tone={w ? "green" : "blue"}>
              {r.task.status === "completed" ? "Task completed" : r.status}
            </Badge>
            <span>
              {s.study.condition === "manual"
                ? "Prepare and load context manually in this baseline."
                : "Context flows according to the project’s sharing policy."}
            </span>
            {w && r.task.status !== "completed" && (
              <Button
                onClick={() =>
                  send({ type: "COMPLETE_TASK", recipientId: r.id })
                }
              >
                Complete prototype task
              </Button>
            )}
          </div>
          {s.study.condition === "manual" && <ManualHandoff recipient={r} />}
          <div className="cv-chat-log" aria-live="polite">
            {r.messages.length === 0 && (
              <div className="cv-chat-empty">
                <Layers size={33} />
                <h2>
                  {w
                    ? "What would you like to explore?"
                    : "Getting your context ready."}
                </h2>
                <p>
                  {w
                    ? "Project context is available. Your conversation stays private."
                    : "Crossville is preparing the task’s authorized context. You can inspect progress in the context panel."}
                </p>
              </div>
            )}
            {r.messages.map((m) => (
              <article className={`cv-message ${m.role}`} key={m.id}>
                <Avatar name={m.role === "user" ? actor.name : r.tool} small />
                <div>
                  <div className="cv-message-heading">
                    <b>{m.role === "user" ? actor.name : r.tool}</b>
                    <small>
                      {m.role === "assistant" ? "Scripted simulation · " : ""}
                      context v{m.contextVersion}
                    </small>
                  </div>
                  <p>{m.content}</p>
                  {s.study.condition === "explainable" &&
                    m.sourceIds.length > 0 && (
                      <button
                        className="cv-text-link"
                        onClick={() => send({ type: "INSPECT", id: m.id })}
                      >
                        {m.sourceIds.length} source items · inspect context ↗
                      </button>
                    )}
                </div>
              </article>
            ))}
          </div>
          <div className="cv-composer-wrap">
            {s.story.active && s.story.step === 1 && (
              <button
                className="cv-suggestion"
                onClick={() => setText(APPROACH)}
              >
                Try the guided message: “Could we switch to action research…?”
                ↗
              </button>
            )}
            {s.story.active &&
              s.story.step === 4 &&
              r.tool === "NotebookLM" && (
                <button
                  className="cv-suggestion"
                  onClick={() => setText(UPDATE)}
                >
                  Use the walkthrough findings from NotebookLM ↗
                </button>
              )}
            <form
              className="cv-composer"
              onSubmit={(e) => {
                e.preventDefault();
                if (send({ type: "CHAT", recipientId: r.id, text }))
                  setText("");
              }}
            >
              <label className="cv-visually-hidden" htmlFor="message">
                Message {r.tool}
              </label>
              <textarea
                id="message"
                placeholder={`Ask ${r.tool} about your project…`}
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={!w}
              />
              <div>
                <span>
                  <LockIcon /> Private conversation · {w?.items.length || 0}{" "}
                  context items loaded
                </span>
                <button
                  className="cv-send"
                  aria-label="Send private message"
                  disabled={!w || !text.trim()}
                >
                  ↑
                </button>
              </div>
            </form>
            <p className="cv-composer-caption">
              Deterministic simulated response. No message is sent to a real AI
              service.
            </p>
          </div>
          <section className="cv-private-notes">
            <details>
              <summary>
                <LockIcon /> My private notes & missing context
              </summary>
              <label className="cv-field">
                Private notes
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <label className="cv-checkbox">
                <input
                  type="checkbox"
                  checked={eligible}
                  onChange={(e) => setEligible(e.target.checked)}
                />
                Allow deterministic detection of private candidates from these
                notes
              </label>
              <Button
                onClick={() =>
                  send({
                    type: "SAVE_NOTES",
                    recipientId: r.id,
                    notes,
                    eligible,
                  })
                }
              >
                Save private notes
              </Button>
              <label className="cv-field">
                Report missing context
                <textarea
                  rows={2}
                  value={missing}
                  onChange={(e) => setMissing(e.target.value)}
                />
              </label>
              <Button
                disabled={!missing.trim()}
                onClick={() => {
                  if (
                    send({
                      type: "MISSING_CONTEXT",
                      recipientId: r.id,
                      text: missing,
                    })
                  )
                    setMissing("");
                }}
              >
                Record missing context
              </Button>
            </details>
          </section>
          {s.candidates
            .filter(
              (c) =>
                c.recipientId === r.id &&
                c.ownerId === s.view.actorId &&
                c.state !== "dismissed",
            )
            .slice()
            .reverse()
            .map((c) => (
              <CandidateCard key={c.id} candidate={c} />
            ))}
          <ArchivedPrivate recipient={r} />
        </>
      )}
    </>
  );
}
function CandidateCard({ candidate: c }: { candidate: Candidate }) {
  const { state: s, send } = useSimulation();
  return (
    <section className="cv-candidate">
      <div className="cv-row">
        <div>
          <span className="cv-eyebrow">POTENTIAL PROJECT UPDATE DETECTED</span>
          <h2>
            {c.state === "private"
              ? "A private candidate. Your choice."
              : "Shared proposal submitted."}
          </h2>
        </div>
        <Badge tone={c.state === "private" ? "purple" : "blue"}>
          {c.state === "private" ? (
            <>
              <LockIcon /> Private candidate
            </>
          ) : (
            "In project review"
          )}
        </Badge>
      </div>
      <p className="cv-muted">
        Detection is automatic. Publication is not. Only the fields below can
        enter team review.
      </p>
      {c.patches.map((patch, index) => (
        <div key={index}>
          <label className="cv-field">
            {patch.category.replace("_", " ")} · proposed content
            <textarea
              rows={3}
              value={patch.content}
              disabled={c.state !== "private"}
              onChange={(e) =>
                send({
                  type: "EDIT_CANDIDATE",
                  id: c.id,
                  patchIndex: index,
                  content: e.target.value,
                  rationale: patch.rationale,
                  importance: patch.importance,
                })
              }
            />
          </label>
          <label className="cv-field">
            Rationale
            <input
              value={patch.rationale}
              disabled={c.state !== "private"}
              onChange={(e) =>
                send({
                  type: "EDIT_CANDIDATE",
                  id: c.id,
                  patchIndex: index,
                  content: patch.content,
                  rationale: e.target.value,
                  importance: patch.importance,
                })
              }
            />
          </label>
          <label className="cv-field">
            Importance
            <select
              disabled={c.state !== "private"}
              value={patch.importance}
              onChange={(e) =>
                send({
                  type: "EDIT_CANDIDATE",
                  id: c.id,
                  patchIndex: index,
                  content: patch.content,
                  rationale: patch.rationale,
                  importance: e.target.value as Importance,
                })
              }
            >
              <option value="relevant">Relevant · useful, low risk</option>
              <option value="critical">Critical · review under policy</option>
              <option value="unrelated">
                Unrelated to active prototype task
              </option>
            </select>
          </label>
        </div>
      ))}
      {c.state === "private" ? (
        <div className="cv-actions">
          <Button
            primary
            onClick={() => send({ type: "PROPOSE_CANDIDATE", id: c.id })}
          >
            Propose to shared project
          </Button>
          <Button onClick={() => send({ type: "DISMISS_CANDIDATE", id: c.id })}>
            Leave it private
          </Button>
        </div>
      ) : (
        <div className="cv-row">
          <p className="cv-muted">
            Review status:{" "}
            {s.base.decisions.find((d) => d.id === c.proposalId)?.status ||
              "pending"}
          </p>
          <Button
            onClick={() => send({ type: "NAVIGATE", page: "Shared workspace" })}
          >
            Open project review →
          </Button>
        </div>
      )}
    </section>
  );
}
function ArchivedPrivate({ recipient: r }: { recipient: Recipient }) {
  const { state: s } = useSimulation();
  const old = s.base.personal.filter(
    (p) => p.ownerId === r.personId && p.projectId === r.projectId,
  );
  if (!old.length) return null;
  return (
    <details className="cv-private-notes">
      <summary>Previous private workspace records ({old.length})</summary>
      {old.map((p) => (
        <div key={p.id}>
          <h3>
            {p.tool} · context v{p.contextVersion}
          </h3>
          <p>{p.notes}</p>
          {p.messages.map((m) => (
            <p key={m.id}>
              <b>{m.role}</b> · v{m.contextVersion}: {m.text}
            </p>
          ))}
        </div>
      ))}
    </details>
  );
}
function ManualHandoff({ recipient: r }: { recipient: Recipient }) {
  const { state: s, send } = useSimulation();
  const [ids, setIds] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const eligible = selectContext(s, r).filter(
    (x) => x.disposition !== "withheld" && x.item,
  );
  return (
    <section className="cv-manual">
      <h2>Prepare a manual context handoff</h2>
      <p>
        Read the same shared project material, choose what to copy, and write a
        summary for this task.
      </p>
      {eligible.map((i) => (
        <label className="cv-checkbox" key={i.itemId}>
          <input
            type="checkbox"
            checked={ids.includes(i.itemId)}
            onChange={() =>
              setIds(
                ids.includes(i.itemId)
                  ? ids.filter((id) => id !== i.itemId)
                  : [...ids, i.itemId],
              )
            }
          />
          <span>{i.content}</span>
        </label>
      ))}
      <label className="cv-field">
        Your summary
        <textarea
          rows={4}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </label>
      <Button
        primary
        disabled={!ids.length}
        onClick={() =>
          send({ type: "MANUAL_DELIVER", recipientId: r.id, ids, summary })
        }
      >
        Load manually prepared context
      </Button>
    </section>
  );
}
function ContextIntelligencePanel() {
  const { state: s, send } = useSimulation();
  const r = currentRecipient(s);
  const w = workspace(s, r);
  const p = s.base.projects.find((p) => p.id === s.base.activeProjectId)!;
  const job = s.jobs.filter((j) => j.recipientId === r?.id).at(-1);
  const explain = s.study.condition === "explainable";
  return (
    <aside className="cv-intelligence">
      <div className="cv-inspector-heading">
        <Layers />
        <b>Crossville Context</b>
        <span className="cv-live-dot" />
      </div>
      <div className="cv-sync-summary" role="status">
        <span className="cv-eyebrow">{r ? r.tool : "SHARED PROJECT"}</span>
        <h2>{r?.status || "Up to date"}</h2>
        <div className="cv-row">
          <span>Shared version</span>
          <b>v{p.version}</b>
        </div>
        {r && (
          <div className="cv-row">
            <span>Recipient loaded</span>
            <b>{w ? `v${w.loadedVersion}` : "Not yet loaded"}</b>
          </div>
        )}
        <p>
          {s.study.condition === "manual"
            ? "Manual preparation and delivery."
            : "Authorized context flows as you work."}
        </p>
      </div>
      {explain ? (
        <>
          <section className="cv-inspector-section">
            <h3>Visible accountability</h3>
            <p>
              Explainable rules use task categories, tags and dependencies. No
              semantic AI inference.
            </p>
            {job && (
              <div className="cv-flow">
                <span>Shared Project v{job.sourceVersion}</span>
                <span>↓ Crossville Context Engine</span>
                <span>↓ Relevance + permission checks</span>
                <b>
                  ↓ {r?.tool} · {job.status}
                </b>
                {STAGES.map((stage, i) => (
                  <div
                    key={stage}
                    className={
                      i === job.stage && job.status === "running"
                        ? "current"
                        : ""
                    }
                  >
                    {i < job.stage || job.status === "complete" ? "✓" : "○"}{" "}
                    {stage}
                  </div>
                ))}
              </div>
            )}
          </section>
          <details className="cv-inspector-section" open={s.view.inspector}>
            <summary
              onClick={() => send({ type: "INSPECT", id: r?.id || p.id })}
            >
              Why this context?
            </summary>
            {(job?.selection || (r ? selectContext(s, r) : [])).map((x, i) => (
              <article className="cv-selection" key={`${x.itemId}-${i}`}>
                <Badge
                  tone={x.disposition === "included" ? "green" : "neutral"}
                >
                  {x.disposition}
                </Badge>
                <p>{x.content}</p>
                <small>{x.reason}</small>
                {x.sourceRef && <small>Source: {x.sourceRef}</small>}
              </article>
            ))}
          </details>
          {r && (
            <section className="cv-inspector-section">
              <h3>Synchronization decisions</h3>
              {job?.deltas.map((d, i) => (
                <article className="cv-selection" key={i}>
                  <Badge>
                    {d.importance} · {d.outcome}
                  </Badge>
                  <p>{d.content}</p>
                  {d.before && <small>Previously: {d.before.content}</small>}
                  <small>{d.reason}</small>
                  <small>{d.sourceRef}</small>
                </article>
              ))}
              <p>
                {r.held.length} held · {r.deferred.length} deferred
              </p>
              <p className="cv-muted">
                Evaluated through v{r.evaluatedVersion}. Loaded version advances
                only when all eligible changes are accounted for.
              </p>
            </section>
          )}
        </>
      ) : (
        <section className="cv-inspector-section">
          <p>
            {s.study.condition === "opaque"
              ? "Automatic context delivery is active."
              : "Use the manual preparation area in your workspace."}
          </p>
        </section>
      )}
      {r && r.held.length > 0 && (
        <section className="cv-inspector-section">
          <h3>Review required</h3>
          <p>
            {r.held.length} changes await authorization under the current
            policy.
          </p>
          <Button
            onClick={() =>
              send({ type: "OVERRIDE_SYNC", recipientId: r.id, apply: true })
            }
          >
            Approve held updates
          </Button>
          <Button
            onClick={() =>
              send({ type: "OVERRIDE_SYNC", recipientId: r.id, apply: false })
            }
          >
            Keep working context
          </Button>
        </section>
      )}
      {explain && w && (
        <details className="cv-inspector-section">
          <summary>
            Recipient’s actual loaded context ({w.items.length})
          </summary>
          {w.items.map((i) => (
            <article key={i.id} className="cv-selection">
              <b>
                {i.category} · v{i.version}
              </b>
              <p>{i.content}</p>
              <small>{i.source.reference}</small>
            </article>
          ))}
        </details>
      )}
      <div className="cv-inspector-foot">
        <LockIcon /> Private work is never silently published.
        <br />
        Local simulation · No external transmission
      </div>
    </aside>
  );
}
function Activity() {
  const { state: s } = useSimulation();
  const explain = s.study.condition === "explainable";
  return (
    <div className="cv-page-content">
      <div className="cv-page-heading">
        <span>PROJECT MEMORY</span>
        <h1>
          Work moves.
          <br />
          Context follows.
        </h1>
        <p>
          Versioned decisions, local deliveries and synchronization outcomes.
        </p>
      </div>
      {s.base.versions
        .filter((v) => v.projectId === s.base.activeProjectId)
        .slice()
        .reverse()
        .map((v) => (
          <details className="cv-review-card" key={v.id}>
            <summary>
              Project v{v.version} · {v.items.length} context items
            </summary>
            {v.items.map((i) => (
              <p key={i.id}>{i.content}</p>
            ))}
          </details>
        ))}
      {s.events
        .slice()
        .reverse()
        .filter(
          (e) =>
            explain ||
            [
              "TASK_STARTED",
              "TASK_COMPLETED",
              "CONTEXT_LOADED",
              "PROJECT_VERSION_CHANGED",
            ].includes(e.type),
        )
        .map((e) => (
          <article className="cv-event" key={e.id}>
            <span className="cv-event-dot" />
            <div>
              <small>
                {new Date(e.timestamp).toLocaleTimeString()} · {e.condition}
              </small>
              <h3>{e.type.replaceAll("_", " ").toLowerCase()}</h3>
              <p>{e.detail}</p>
              <small>Recipient v{e.recipientVersion}</small>
            </div>
          </article>
        ))}
    </div>
  );
}
function Settings() {
  const { state: s, send, replace, repository } = useSimulation();
  const [error, setError] = useState("");
  const [condition, setCondition] = useState<Condition>(s.study.condition);
  const owner =
    s.base.members.find((m) => m.id === s.view.actorId)?.role === "owner";
  function policy(key: "routine" | "critical", value: SyncPolicy) {
    send({ type: "POLICY", ...s.policy, [key]: value });
  }
  return (
    <div className="cv-page-content">
      <div className="cv-page-heading">
        <span>RESEARCH & AUTOMATION</span>
        <h1>
          Your rules.
          <br />
          Context in motion.
        </h1>
        <p>Local simulation settings and controlled study conditions.</p>
      </div>
      <section className="cv-review-card">
        <h2>Comparison condition</h2>
        <p>
          Changing condition restores the same v4 scenario and starts a new
          session. Export the current log first.
        </p>
        <label className="cv-field">
          Condition
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as Condition)}
          >
            <option value="manual">A · Manual baseline</option>
            <option value="opaque">B · Automated opaque</option>
            <option value="explainable">C · Automated explainable</option>
          </select>
        </label>
        <Button
          disabled={s.study.started && !s.study.complete}
          onClick={() => send({ type: "CONDITION", condition })}
        >
          Restore scenario in selected condition
        </Button>
        <div className="cv-actions">
          <Button
            disabled={s.study.started}
            onClick={() => send({ type: "STUDY_START" })}
          >
            Start study task
          </Button>
          <Button
            disabled={!s.study.started || s.study.complete}
            onClick={() => send({ type: "STUDY_COMPLETE" })}
          >
            Complete study task
          </Button>
        </div>
        <small>Session: {s.study.sessionId}</small>
      </section>
      <section className="cv-review-card">
        <h2>Sharing & synchronization policy</h2>
        <p>
          Only owners can change policy. Private and restricted information
          always remains protected.
        </p>
        {(["routine", "critical"] as const).map((key) => (
          <label className="cv-field" key={key}>
            {key === "routine" ? "Eligible shared updates" : "Critical updates"}
            <select
              disabled={!owner}
              value={s.policy[key]}
              onChange={(e) => policy(key, e.target.value as SyncPolicy)}
            >
              <option value="automatic">Automatic</option>
              <option value="notify">Notify without applying</option>
              <option value="approval">Require approval</option>
            </select>
          </label>
        ))}
        <label className="cv-checkbox">
          <input
            disabled={!owner}
            type="checkbox"
            checked={s.policy.allowTeam}
            onChange={(e) =>
              send({ type: "POLICY", ...s.policy, allowTeam: e.target.checked })
            }
          />
          Allow team-classified information for project members
        </label>
      </section>
      <section className="cv-review-card">
        <h2>Observe the engine</h2>
        <label className="cv-checkbox">
          <input
            type="checkbox"
            checked={s.controls.slow}
            onChange={(e) =>
              send({ type: "CONTROL", ...s.controls, slow: e.target.checked })
            }
          />
          Slow down stage transitions
        </label>
        <label className="cv-checkbox">
          <input
            type="checkbox"
            checked={s.controls.paused}
            onChange={(e) =>
              send({ type: "CONTROL", ...s.controls, paused: e.target.checked })
            }
          />
          Pause background processing
        </label>
        <Button
          disabled={
            !s.controls.paused ||
            !s.jobs.some((j) => j.status === "queued" || j.status === "running")
          }
          onClick={() => send({ type: "TICK" })}
        >
          Step one engine event
        </Button>
      </section>
      <section className="cv-review-card">
        <h2>Data & event exports</h2>
        <p>
          Logs record actions and versions, not fabricated participant
          measurements. Full backups include private simulation notes.
        </p>
        <div className="cv-actions">
          <Button
            onClick={() =>
              download(
                "crossville-events.json",
                JSON.stringify(s.events, null, 2),
                "application/json",
              )
            }
          >
            Export JSON log
          </Button>
          <Button
            onClick={() =>
              download("crossville-events.csv", exportEvents(s), "text/csv")
            }
          >
            Export CSV log
          </Button>
          <Button
            onClick={() =>
              download(
                "crossville-backup.json",
                JSON.stringify(s, null, 2),
                "application/json",
              )
            }
          >
            Export full backup
          </Button>
        </div>
        <label className="cv-field">
          Restore a JSON backup (replaces this demo)
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              try {
                const file = e.target.files?.[0];
                if (!file) return;
                const raw = await file.text();
                let data: AdaptiveState;
                try {
                  data = parseAdaptive(raw);
                } catch {
                  data = adaptiveSeed(parseState(raw));
                }
                replace(data);
                setError("");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Invalid backup");
              }
            }}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <Button
          onClick={() => {
            const old = repository.restoreLegacy();
            if (old) replace(old);
            else setError("No original version-one browser data was found.");
          }}
        >
          Restore original browser project
        </Button>
      </section>
    </div>
  );
}
const SCENES = [
  [
    "A shared starting point",
    "The team uses different AI tools with the same approved two-week pilot context. Inspect the shared cards, then continue.",
  ],
  [
    "Explore privately with Claude",
    "Use the suggested message, send it, then explicitly propose the detected candidate. Your conversation remains private.",
  ],
  [
    "Agree before publishing",
    "Review as Professor and approve the methodology change. The canonical project advances from v4 to v5.",
  ],
  [
    "Start work in Codex",
    "Choose Continue prototype development. Starting the task triggers authorized context delivery without a handoff builder.",
  ],
  [
    "The project keeps moving",
    "Use the NotebookLM findings, propose the two updates, then review them as Professor. Codex receives eligible updates automatically.",
  ],
  [
    "Inspect the invisible work",
    "Inspect the context panel: sources, exclusions, previous context and synchronization outcomes. The recipient contains the delivered updates.",
  ],
  [
    "Close the collaborative loop",
    "Complete the Codex task. Its new question enters shared review; approve it as Professor to reach v7.",
  ],
];
function GuidedStory({ onReset }: { onReset: () => void }) {
  const { state: s, send, legacy } = useSimulation();
  const [title, body] = SCENES[s.story.step];
  const ready = canAdvance(s);
  const professor = s.base.members.find((m) => m.name === "Professor");
  return (
    <section className="cv-guide" aria-label="Guided story">
      <div className="cv-row">
        <span className="cv-eyebrow">
          GUIDED STORY · {s.story.step + 1} / 7
        </span>
        <button
          aria-label="Exit guided story"
          className="cv-icon-button"
          onClick={() => send({ type: "STORY_EXIT" })}
        >
          ×
        </button>
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      {[4, 6].includes(s.story.step) && professor && (
        <Button
          onClick={() => {
            legacy({ type: "member", id: professor.id });
            send({ type: "NAVIGATE", page: "Shared workspace" });
          }}
        >
          Review as Professor →
        </Button>
      )}
      <div className="cv-guide-controls">
        <button onClick={onReset}>Restart</button>
        <div>
          <Button
            disabled={s.story.step === 0}
            onClick={() => send({ type: "STORY_BACK" })}
          >
            Back
          </Button>
          <Button
            primary
            disabled={!ready}
            onClick={() =>
              send({ type: s.story.step === 6 ? "STORY_EXIT" : "STORY_NEXT" })
            }
          >
            {s.story.step === 6 ? "Finish story" : "Next →"}
          </Button>
        </div>
      </div>
      <div className="cv-guide-dots">
        {SCENES.map((_, i) => (
          <span key={i} className={i <= s.story.step ? "done" : ""} />
        ))}
      </div>
    </section>
  );
}
