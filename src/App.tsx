import { useState, useRef, useEffect, type ReactNode } from "react";
import {
  seed,
  transition,
  tools,
  categories,
  scenarios,
  consensus,
  permitted,
  visible,
  recommend,
  packet,
  syncRecommendations,
  csv,
  type Action,
} from "./engine";
import { LocalRepository, parseState, download } from "./repository";
import type {
  State,
  ContextItem,
  Category,
  Privacy,
  AgentWorkspace,
} from "./model";
const repo = new LocalRepository(localStorage);
const tabs = [
  "Overview",
  "Shared workspace",
  "Context library",
  "Handoff builder",
  "Agent workspaces",
  "Activity & sync",
  "People & access",
  "Research mode",
];
function Panel({
  title,
  children,
  subtitle,
}: {
  title: string;
  children: ReactNode;
  subtitle?: string;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
function Button({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button className="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
function Text({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="editor-label">
      {label}
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  values,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  values: string[];
}) {
  return (
    <label className="editor-label">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {values.map((v) => (
          <option key={v} value={v}>
            {v.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
export default function App() {
  const [state, setState] = useState<State>(() => {
    try {
      return repo.load();
    } catch {
      return seed();
    }
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const [screen, setScreen] = useState("Overview");
  const [dark, setDark] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const send = (a: Action) => {
    try {
      const next = transition(stateRef.current, a);
      repo.save(next);
      stateRef.current = next;
      setState(next);
      setError("");
      setNotice(a.type.replaceAll("_", " ") + " saved");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };
  const p = state.projects.find((p) => p.id === state.activeProjectId)!;
  const me = state.members.find((m) => m.id === state.activeMemberId)!;
  const items = state.items.filter(
    (i) => i.projectId === p.id && visible(state, i),
  );
  const baseline = state.study.active && state.study.condition === "Baseline";
  const [resetConfirm, setResetConfirm] = useState(false);
  return (
    <div className={`app-shell ${dark ? "dark" : ""}`}>
      <header className="topbar">
        <a
          className="brand"
          href="#overview"
          onClick={() => setScreen("Overview")}
        >
          <span className="brand-mark">c</span>Crossville{" "}
          <small>shared context</small>
        </a>
        <span className="simulated-badge">
          LOCAL RESEARCH PROTOTYPE · SIMULATED TOOLS
        </span>
        <div className="header-controls">
          <label>
            PERSON
            <select
              aria-label="Current user"
              value={me.id}
              onChange={(e) => send({ type: "member", id: e.target.value })}
            >
              {state.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            PROJECT
            <select
              aria-label="Current project"
              value={p.id}
              onChange={(e) => send({ type: "project", id: e.target.value })}
            >
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="theme-button"
            aria-label="Toggle theme"
            onClick={() => setDark(!dark)}
          >
            ◐
          </button>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="side-label">PROJECT CONTEXT</div>
          <div className="project-name">{p.name}</div>
          <nav aria-label="Main navigation">
            {(baseline ? ["Research mode"] : tabs).map((tab, i) => (
              <button
                key={tab}
                className={`nav-item ${screen === tab ? "selected" : ""}`}
                onClick={() => setScreen(tab)}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                {tab}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <span className="avatar">{me.name[0]}</span>
            <div>
              <b>{me.name}</b>
              <small>{me.role} · local simulation</small>
            </div>
          </div>
        </aside>
        <main className="main-content">
          <div className="page-intro">
            <div>
              <div className="eyebrow">
                CAPTURE → ORGANIZE → AGREE → HANDOFF → SYNC
              </div>
              <h1>{baseline ? "Baseline study" : screen}</h1>
              <p>One shared understanding. Every handoff has a history.</p>
            </div>
            {!baseline && (
              <div className="version-card">
                <small>CANONICAL CONTEXT</small>
                <b>v{p.version}</b>
                <span>
                  {items.filter((i) => i.status === "confirmed").length}{" "}
                  validated items
                </span>
              </div>
            )}
          </div>
          {state.study.active && (
            <div className="notice">
              Study {state.study.sessionId.slice(0, 8)} ·{" "}
              {state.study.condition} · {state.study.scenario} ·{" "}
              {state.study.complete
                ? "Completed"
                : state.study.started
                  ? "Task in progress"
                  : "Ready"}
            </div>
          )}
          <div role="status" aria-live="polite" className="status-line">
            {notice}
          </div>
          {error && (
            <div role="alert" className="notice warning">
              {error}
            </div>
          )}
          {baseline || screen === "Research mode" ? (
            <Research
              key={state.study.sessionId}
              state={state}
              send={send}
              onReset={() => setResetConfirm(true)}
            />
          ) : screen === "Overview" ? (
            <>
              <div className="metric-grid">
                {[
                  ["Shared context", items.length],
                  [
                    "Pending review",
                    state.decisions.filter(
                      (d) => d.projectId === p.id && d.status === "pending",
                    ).length,
                  ],
                  [
                    "Memory inbox",
                    items.filter((i) => i.category === "inbox").length,
                  ],
                  [
                    "Recipients behind",
                    state.workspaces.filter(
                      (w) =>
                        w.projectId === p.id &&
                        syncRecommendations(state, w.id).length,
                    ).length,
                  ],
                ].map(([label, value]) => (
                  <div className="metric" key={label}>
                    <span>{label}</span>
                    <b>{value}</b>
                  </div>
                ))}
              </div>
              <Panel title="Project purpose">
                <p>{items.find((i) => i.category === "brief")?.content}</p>
                <div className="actions">
                  <Button onClick={() => setScreen("Shared workspace")}>
                    Open shared workspace →
                  </Button>
                  <Button onClick={() => setScreen("Handoff builder")}>
                    Prepare a handoff →
                  </Button>
                </div>
              </Panel>
              <div className="two-col">
                <Panel title="What the team knows">
                  <div className="memory-list">
                    {items
                      .filter(
                        (i) =>
                          i.category !== "inbox" &&
                          i.status === "confirmed" &&
                          i.privacy !== "private" &&
                          !state.conflicts.some(
                            (c) =>
                              c.status === "unresolved" &&
                              c.itemIds.includes(i.id),
                          ),
                      )
                      .map((i) => (
                        <Item key={i.id} item={i} />
                      ))}
                  </div>
                </Panel>
                <div>
                  <Panel title="Team & tools">
                    <p>
                      {state.members
                        .filter((m) => p.memberIds.includes(m.id))
                        .map((m) => m.name)
                        .join(" · ")}
                    </p>
                    <p className="muted">{tools.join(" · ")}</p>
                    {p.tasks.map((t) => (
                      <div className="task-row" key={t.id}>
                        <div>
                          <b>{t.title}</b>
                          <span>
                            {t.owner} · {t.agent} · dependencies:{" "}
                            {t.dependsOnMemoryIds.join(", ")}
                          </span>
                        </div>
                        <em>{t.status}</em>
                      </div>
                    ))}
                  </Panel>
                  <Panel title="Pending decisions">
                    {state.decisions
                      .filter(
                        (d) => d.projectId === p.id && d.status === "pending",
                      )
                      .map((d) => (
                        <article key={d.id} className="proposal-card">
                          <b>{d.source.tool} · awaiting owner review</b>
                          <p>{d.content}</p>
                          <small>{d.rationale}</small>
                        </article>
                      ))}
                    <Button onClick={() => setScreen("Shared workspace")}>
                      Review with the team →
                    </Button>
                  </Panel>
                  <Panel title="Recent activity">
                    {state.logs
                      .filter((e) => !e.projectId || e.projectId === p.id)
                      .slice(-3)
                      .reverse()
                      .map((e) => (
                        <p className="muted" key={e.id}>
                          {e.type.replaceAll("_", " ")} ·{" "}
                          {state.members.find((m) => m.id === e.actorId)?.name}{" "}
                          · {e.timestamp}
                        </p>
                      ))}
                    {(state.sourceActivity || [])
                      .filter((a) => a.projectId === p.id)
                      .slice(0, 3)
                      .map((a) => (
                        <p className="muted" key={a.id}>
                          {a.actor} {a.content} · {a.tool}
                        </p>
                      ))}
                    <Button onClick={() => setScreen("Activity & sync")}>
                      Inspect history & sync →
                    </Button>
                  </Panel>
                  <details>
                    <summary>Review unresolved source conflicts</summary>
                    <SourceConflicts state={state} send={send} />
                  </details>
                </div>
              </div>
            </>
          ) : screen === "Shared workspace" ? (
            <Workspace
              key={p.id}
              state={state}
              send={send}
              openAgents={() => setScreen("Agent workspaces")}
            />
          ) : screen === "Context library" ? (
            <Library
              key={p.id}
              state={state}
              send={send}
              handoff={() => setScreen("Handoff builder")}
            />
          ) : screen === "Handoff builder" ? (
            <Handoff
              key={p.id}
              state={state}
              send={send}
              open={() => setScreen("Agent workspaces")}
            />
          ) : screen === "Agent workspaces" ? (
            <Agents key={p.id} state={state} send={send} />
          ) : screen === "Activity & sync" ? (
            <History state={state} send={send} />
          ) : (
            <Access state={state} send={send} />
          )}
          {!baseline && (
            <div className="data-controls">
              <Button
                onClick={() =>
                  download(
                    "crossville-project.json",
                    JSON.stringify(state, null, 2),
                  )
                }
              >
                Export project JSON
              </Button>
              <Button onClick={() => importRef.current?.click()}>
                Import project JSON
              </Button>
              <input
                hidden
                ref={importRef}
                type="file"
                accept="application/json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const next = parseState(await file.text());
                    repo.save(next);
                    setState(next);
                    setNotice("Project imported");
                  } catch (err) {
                    setError((err as Error).message);
                  }
                  e.target.value = "";
                }}
              />
            </div>
          )}
        </main>
      </div>
      <footer className="global-footer">
        <span>CROSSVILLE · SHARED MEMORY, HUMAN CONTROL</span>
        <span>
          No external AI connections · fictional study data · saved locally
        </span>
      </footer>
      {resetConfirm && (
        <ResetDialog
          close={() => setResetConfirm(false)}
          reset={() => {
            send({ type: "reset", scenario: state.study.scenario });
            setResetConfirm(false);
          }}
        />
      )}
    </div>
  );
}
function Item({ item }: { item: ContextItem }) {
  return (
    <article className="memory-card">
      <div className="memory-meta">
        <span className={`type type-${item.category}`}>
          {item.category.replaceAll("_", " ")}
        </span>
        <strong>v{item.version}</strong>
      </div>
      <p>{item.content}</p>
      <footer>
        {item.strictness && `${item.strictness} · ${item.ruleType} · `}
        {item.stage && `${item.stage} · `}
        {item.status} · {item.privacy} · {item.source.tool}
        <br />
        {item.source.label} · {item.updatedAt}
        <br />
        <code>{item.id}</code>
      </footer>
    </article>
  );
}
type Props = { state: State; send: (a: Action) => boolean };
function Discussion({ id, state, send }: Props & { id: string }) {
  const [text, setText] = useState("");
  return (
    <details>
      <summary>
        Discussion ({state.comments.filter((c) => c.entityId === id).length})
      </summary>
      {state.comments
        .filter((c) => c.entityId === id)
        .map((c) => (
          <p className="comment" key={c.id}>
            <b>{state.members.find((m) => m.id === c.memberId)?.name}</b>{" "}
            {c.content}
            <small>{c.timestamp}</small>
          </p>
        ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (send({ type: "comment", id, content: text })) setText("");
        }}
      >
        <Text label="Comment" value={text} onChange={setText} rows={2} />
        <button className="button" disabled={!text.trim()}>
          Post comment
        </button>
      </form>
    </details>
  );
}
function Workspace({
  state,
  send,
  openAgents,
}: Props & { openAgents: () => void }) {
  const [content, setContent] = useState("");
  const [source, setSource] = useState("");
  const [tool, setTool] = useState("ChatGPT");
  const [privacy, setPrivacy] = useState<Privacy>("shared");
  const items = state.items.filter(
    (i) => i.projectId === state.activeProjectId && visible(state, i),
  );
  const me = state.members.find((m) => m.id === state.activeMemberId)!;
  return (
    <>
      <div className="actions">
        <Button
          onClick={() => {
            if (send({ type: "personalStart" })) openAgents();
          }}
        >
          Open my private workspace
        </Button>
      </div>
      <div className="two-col">
        <Panel
          title="Capture a conversation memory"
          subtitle="New memories wait for the team in the inbox."
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (send({ type: "add", content, source, tool, privacy }))
                setContent("");
            }}
          >
            <Text
              label="Memory content"
              value={content}
              onChange={setContent}
            />
            <Text
              label="Source reference or conversation URL"
              value={source}
              onChange={setSource}
              rows={1}
            />
            <div className="form-row">
              <Select
                label="Source tool"
                value={tool}
                onChange={setTool}
                values={tools}
              />
              <Select
                label="Privacy"
                value={privacy}
                onChange={(v) => setPrivacy(v as Privacy)}
                values={["shared", "team", "private"]}
              />
            </div>
            <button
              className="button primary"
              disabled={!content.trim() || me.role === "viewer"}
            >
              Add memory to inbox
            </button>
          </form>
        </Panel>
        <Panel
          title="Memory sorting inbox"
          subtitle="Each collaborator casts a category vote. Switch person above to simulate the team."
        >
          {items
            .filter((i) => i.category === "inbox")
            .map((i) => (
              <Sorting key={i.id} item={i} state={state} send={send} />
            ))}
          {!items.some((i) => i.category === "inbox") && (
            <p className="muted">All memories organized.</p>
          )}
        </Panel>
      </div>
      <SourceConflicts state={state} send={send} />
      <Proposals state={state} send={send} />
      {categories
        .filter((c) => c !== "inbox")
        .map((c) => (
          <Panel key={c} title={c.replaceAll("_", " ")}>
            <div className="memory-list">
              {items
                .filter((i) => i.category === c)
                .map((i) => (
                  <div key={i.id}>
                    <Item item={i} />
                    <ItemWorkflow item={i} state={state} send={send} />
                    <Discussion id={i.id} state={state} send={send} />
                  </div>
                ))}
            </div>
            {!items.some((i) => i.category === c) && (
              <p className="muted">No items yet. Capture and sort a memory.</p>
            )}
          </Panel>
        ))}
    </>
  );
}
function Sorting({ item, state, send }: Props & { item: ContextItem }) {
  const [category, setCategory] = useState<Category>("decision");
  const [rationale, setRationale] = useState("");
  const c = consensus(state, item.id);
  return (
    <article
      className="sorting"
      tabIndex={0}
      aria-label="Memory sorting card: Right to vote, Left to undo"
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "ArrowRight")
          send({ type: "vote", id: item.id, category });
        if (e.key === "ArrowLeft") send({ type: "undoVote", id: item.id });
      }}
    >
      <Item item={item} />
      <div className="notice">
        Round {state.rounds[item.id] || 1} · {c.votes.length}/{c.required} votes
        ·{" "}
        {c.conflict
          ? "Disagreement — review or re-vote"
          : "Waiting for agreement"}
      </div>
      {c.votes.map((v) => (
        <p className="muted" key={v.id}>
          {state.members.find((m) => m.id === v.memberId)?.name}: {v.category}
        </p>
      ))}
      <Select
        label="Sort into"
        value={category}
        onChange={(v) => setCategory(v as Category)}
        values={categories.filter((c) => c !== "inbox")}
      />
      <div className="actions">
        <Button onClick={() => send({ type: "vote", id: item.id, category })}>
          Keep / submit category vote
        </Button>
        <Button
          disabled={!c.votes.some((v) => v.memberId === state.activeMemberId)}
          onClick={() => send({ type: "undoVote", id: item.id })}
        >
          Undo my vote
        </Button>
        <Button onClick={() => send({ type: "revote", id: item.id })}>
          Start re-vote
        </Button>
      </div>
      {c.conflict &&
        state.members.find((m) => m.id === state.activeMemberId)?.role ===
          "owner" && (
          <>
            <Text
              label="Owner resolution rationale"
              value={rationale}
              onChange={setRationale}
            />
            <Button
              disabled={!rationale.trim()}
              onClick={() =>
                send({
                  type: "resolveConflict",
                  id: item.id,
                  category,
                  rationale,
                })
              }
            >
              Resolve disagreement
            </Button>
          </>
        )}
      <Discussion id={item.id} state={state} send={send} />
    </article>
  );
}
function Proposals({ state, send }: Props) {
  const items = state.items.filter(
    (i) =>
      i.projectId === state.activeProjectId &&
      i.category !== "inbox" &&
      visible(state, i),
  );
  const [target, setTarget] = useState(
    items.find((i) => i.id === "method")?.id || items[0]?.id || "",
  );
  const [text, setText] = useState("");
  const [rationale, setRationale] = useState("");
  const [category, setCategory] = useState<Category>("decision");
  const p = state.projects.find((p) => p.id === state.activeProjectId)!;
  const [people, setPeople] = useState(p.memberIds);
  const [tasks, setTasks] = useState<string[]>(
    p.tasks
      .filter((t) => t.dependsOnMemoryIds.includes(target))
      .map((t) => t.id),
  );
  const me = state.members.find((m) => m.id === state.activeMemberId)!;
  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  return (
    <Panel
      title="Decision & context review"
      subtitle="Approved changes update canonical context, versions, dependent tasks, and future sync."
    >
      <details open={!state.decisions.length}>
        <summary>Propose a change</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (
              send({
                type: "proposal",
                targetId: target,
                content: text,
                rationale,
                category: target ? undefined : category,
                affectedPeople: people,
                affectedTaskIds: tasks,
              })
            ) {
              setText("");
              setRationale("");
            }
          }}
        >
          <label className="editor-label">
            Update target
            <select
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setTasks(
                  p.tasks
                    .filter((t) =>
                      t.dependsOnMemoryIds.includes(e.target.value),
                    )
                    .map((t) => t.id),
                );
              }}
            >
              <option value="">Create a new item</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.category}: {i.content.slice(0, 70)}
                </option>
              ))}
            </select>
          </label>
          {target && (
            <p className="before">
              Current: {items.find((i) => i.id === target)?.content}
            </p>
          )}
          {!target && (
            <Select
              label="New category"
              value={category}
              onChange={(v) => setCategory(v as Category)}
              values={categories.filter((c) => c !== "inbox")}
            />
          )}
          <Text label="Proposed content" value={text} onChange={setText} />
          <Text label="Rationale" value={rationale} onChange={setRationale} />
          <fieldset>
            <legend>Affected people</legend>
            {state.members
              .filter((m) => p.memberIds.includes(m.id))
              .map((m) => (
                <label className="check" key={m.id}>
                  <input
                    type="checkbox"
                    checked={people.includes(m.id)}
                    onChange={() => setPeople(toggle(people, m.id))}
                  />
                  {m.name}
                </label>
              ))}
          </fieldset>
          <fieldset>
            <legend>Dependent tasks requiring review</legend>
            {p.tasks
              .filter((t) => t.dependsOnMemoryIds.includes(target))
              .map((t) => (
                <label className="check" key={t.id}>
                  <input
                    type="checkbox"
                    checked={tasks.includes(t.id)}
                    onChange={() => setTasks(toggle(tasks, t.id))}
                  />
                  {t.title}
                </label>
              ))}
          </fieldset>
          <button
            className="button primary"
            disabled={!text.trim() || !rationale.trim() || me.role === "viewer"}
          >
            Submit for review
          </button>
        </form>
      </details>
      {state.decisions
        .filter((d) => d.projectId === p.id)
        .slice()
        .reverse()
        .map((d) => (
          <article className="proposal-card" key={d.id}>
            <div className="row">
              <b>
                {d.source.tool} ·{" "}
                {state.members.find((m) => m.id === d.authorId)?.name}
              </b>
              <span className="status-badge">{d.status}</span>
            </div>
            <p className="before">Before: {d.before || "New context"}</p>
            <p>Proposed: {d.content}</p>
            <p className="muted">Rationale: {d.rationale}</p>
            <p className="muted">
              Impact:{" "}
              {d.affectedPeople
                .map((id) => state.members.find((m) => m.id === id)?.name)
                .join(", ")}{" "}
              · tasks: {d.affectedTaskIds.join(", ") || "none"}
            </p>
            {d.targetId &&
              state.decisions.some(
                (x) =>
                  x.id !== d.id &&
                  x.targetId === d.targetId &&
                  x.status === "pending",
              ) && (
                <div className="notice warning">
                  Overlapping proposal. Approval uses item-version checks; a
                  later conflicting approval requires revision.
                </div>
              )}
            <Discussion id={d.id} state={state} send={send} />
            {d.status === "pending" && (
              <div className="actions">
                {(["approved", "revision", "rejected"] as const).map(
                  (status) => (
                    <Button
                      key={status}
                      disabled={me.role !== "owner"}
                      onClick={() =>
                        send({ type: "resolve", id: d.id, status })
                      }
                    >
                      {status === "approved"
                        ? "Approve"
                        : status === "revision"
                          ? "Request revision"
                          : "Reject"}
                    </Button>
                  ),
                )}
              </div>
            )}
            {d.status === "revision" && (
              <Button
                onClick={() => {
                  setTarget(d.targetId);
                  setText(d.content);
                  setRationale(d.rationale);
                }}
              >
                Use as revised draft
              </Button>
            )}
          </article>
        ))}
    </Panel>
  );
}
function Library({ state, send, handoff }: Props & { handoff: () => void }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [privacy, setPrivacy] = useState("all");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [ruleFilter, setRuleFilter] = useState("all");
  const [strictFilter, setStrictFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const items = state.items.filter(
    (i) => i.projectId === state.activeProjectId && visible(state, i),
  );
  return (
    <>
      <Panel title="Find the context behind the work">
        <label className="editor-label">
          Search content, sources or rationale
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search project context…"
          />
        </label>
        <div className="form-row">
          <Select
            label="Category"
            value={category}
            onChange={setCategory}
            values={["all", ...categories]}
          />
          <Select
            label="Privacy"
            value={privacy}
            onChange={setPrivacy}
            values={["all", "shared", "team", "private"]}
          />
          <Select
            label="State"
            value={status}
            onChange={setStatus}
            values={["all", "confirmed", "tentative", "disputed", "superseded"]}
          />
          <Select
            label="Source"
            value={source}
            onChange={setSource}
            values={["all", ...new Set(items.map((i) => i.source.tool))]}
          />
        </div>
        <div className="form-row">
          <Select
            label="Question lifecycle"
            value={stageFilter}
            onChange={setStageFilter}
            values={["all", "Open", "Exploring", "Answered", "Decided"]}
          />
          <Select
            label="Rule strictness"
            value={strictFilter}
            onChange={setStrictFilter}
            values={["all", "Must", "Prefer"]}
          />
          <Select
            label="Rule group"
            value={ruleFilter}
            onChange={setRuleFilter}
            values={["all", "Study limits", "Privacy and sharing"]}
          />
        </div>
        <p className="muted">
          {selected.length} selected for inspection. Handoff selection has its
          own recipient privacy checks.
        </p>
        <Button onClick={handoff}>Open handoff builder</Button>
      </Panel>
      <div className="memory-list">
        {items
          .filter(
            (i) =>
              (category === "all" || i.category === category) &&
              (privacy === "all" || i.privacy === privacy) &&
              (status === "all" || i.status === status) &&
              (source === "all" || i.source.tool === source) &&
              (stageFilter === "all" || i.stage === stageFilter) &&
              (strictFilter === "all" || i.strictness === strictFilter) &&
              (ruleFilter === "all" || i.ruleType === ruleFilter) &&
              (i.content + " " + i.source.label + " " + i.rationale)
                .toLowerCase()
                .includes(q.toLowerCase()),
          )
          .map((i) => (
            <Panel key={i.id} title={i.category.replaceAll("_", " ")}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={selected.includes(i.id)}
                  onChange={() => {
                    const included = !selected.includes(i.id);
                    setSelected(
                      included
                        ? [...selected, i.id]
                        : selected.filter((id) => id !== i.id),
                    );
                    send({ type: "selection", id: i.id, included });
                  }}
                />
                Select for inspection
              </label>
              <Item item={i} />
              <details open={selected.includes(i.id)}>
                <summary>Inspect provenance & dependencies</summary>
                <dl>
                  <dt>Source reference</dt>
                  <dd>{i.source.reference}</dd>
                  <dt>Author</dt>
                  <dd>
                    {state.members.find((m) => m.id === i.authorId)?.name}
                  </dd>
                  <dt>Created / updated</dt>
                  <dd>
                    {i.createdAt} / {i.updatedAt}
                  </dd>
                  <dt>Rationale</dt>
                  <dd>{i.rationale || "Not recorded"}</dd>
                  <dt>Relevance</dt>
                  <dd>{i.relevance}</dd>
                  <dt>Dependencies</dt>
                  <dd>{i.dependencies.join(", ") || "None recorded"}</dd>
                  <dt>Project</dt>
                  <dd>{i.projectId}</dd>
                </dl>
              </details>
              <ItemWorkflow item={i} state={state} send={send} />
              <Discussion id={i.id} state={state} send={send} />
            </Panel>
          ))}
      </div>
      <Proposals state={state} send={send} />
    </>
  );
}
function SourceConflicts({ state, send }: Props) {
  return (
    <>
      {state.conflicts
        .filter(
          (c) =>
            c.projectId === state.activeProjectId && c.status === "unresolved",
        )
        .map((c) => (
          <div className="notice warning" key={c.id}>
            <b>{c.title}</b>
            <p>
              Both sources are withheld from transfers until their owner chooses
              a retained source.
            </p>
            {c.itemIds.map((id) => {
              const i = state.items.find((i) => i.id === id)!;
              return (
                <div className="conflict-option" key={id}>
                  <p>
                    {i.content}
                    <br />
                    <small>
                      {i.source.label} · {i.source.reference}
                    </small>
                  </p>
                  <Button
                    disabled={
                      c.ownerId !== state.activeMemberId ||
                      state.members.find((m) => m.id === state.activeMemberId)
                        ?.role === "viewer"
                    }
                    onClick={() =>
                      send({ type: "sourceConflict", id: c.id, keepId: id })
                    }
                  >
                    Keep this source
                  </Button>
                </div>
              );
            })}
          </div>
        ))}
    </>
  );
}
function Handoff({ state, send, open }: Props & { open: () => void }) {
  const [recipient, setRecipient] = useState("Codex");
  const [task, setTask] = useState(
    "Continue building the research prototype using the team's approved methodology and constraints.",
  );
  const [ids, setIds] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const p = state.projects.find((p) => p.id === state.activeProjectId)!;
  const items = state.items.filter(
    (i) => i.projectId === p.id && visible(state, i),
  );
  const eligible = items.filter(
    (i) =>
      permitted(i, recipient) &&
      i.status === "confirmed" &&
      i.category !== "inbox" &&
      !state.conflicts.some(
        (c) => c.status === "unresolved" && c.itemIds.includes(i.id),
      ),
  );
  const toggle = (id: string) => {
    const included = !ids.includes(id);
    setIds(included ? [...ids, id] : ids.filter((x) => x !== id));
    send({ type: "selection", id, included });
    setPreview(false);
  };
  let pk;
  try {
    pk = packet(state, recipient, task, ids);
  } catch {
    pk = undefined;
  }
  return (
    <>
      <div className="two-col">
        <Panel
          title="01 · Define the receiving task"
          subtitle="Recipient workspaces are local simulations. No provider receives this data."
        >
          <Select
            label="Receiving person or tool"
            value={recipient}
            onChange={(v) => {
              setRecipient(v);
              setIds([]);
              setPreview(false);
            }}
            values={tools}
          />
          <Text
            label="Recipient task"
            value={task}
            onChange={(v) => {
              setTask(v);
              setPreview(false);
            }}
          />
          <Button
            onClick={() => {
              const recommended = eligible
                .filter((i) => recommend(i, task).level !== "low")
                .map((i) => i.id);
              for (const id of new Set([...ids, ...recommended]))
                send({
                  type: "selection",
                  id,
                  included: recommended.includes(id),
                });
              setIds(recommended);
              setPreview(false);
            }}
          >
            Recommend relevant context
          </Button>
          <p className="muted">
            Inspect category and keyword rules beside every item. Override by
            selecting or omitting items.
          </p>
          <SourceConflicts state={state} send={send} />
        </Panel>
        <Panel title="02 · Select and inspect">
          <p className="muted">
            {ids.filter((id) => eligible.some((i) => i.id === id)).length}{" "}
            selected · recommendations are deterministic, not AI retrieval.
          </p>
          {items.map((i) => {
            const allowed = eligible.some((x) => x.id === i.id);
            const r = recommend(i, task);
            return (
              <label className="context-option" key={i.id}>
                <input
                  type="checkbox"
                  disabled={!allowed}
                  checked={allowed && ids.includes(i.id)}
                  onChange={() => toggle(i.id)}
                />
                <span>
                  <b>
                    {i.category.replaceAll("_", " ")} · v{i.version}
                  </b>
                  <span>{i.content}</span>
                  <small>
                    {allowed
                      ? `${r.level}: ${r.reason}`
                      : !permitted(i, recipient)
                        ? "Excluded: privacy restriction"
                        : i.status !== "confirmed"
                          ? "Excluded: not confirmed"
                          : "Excluded: unresolved source conflict"}
                  </small>
                  <small>{i.source.reference}</small>
                </span>
              </label>
            );
          })}
          <Button
            disabled={!task.trim() || !pk?.items.length}
            onClick={() => setPreview(true)}
          >
            Inspect handoff preview →
          </Button>
        </Panel>
      </div>
      {preview && pk && (
        <Panel
          title={`03 · ${recipient} handoff preview`}
          subtitle={`Immutable snapshot will capture canonical v${p.version}.`}
        >
          <div className="notice">
            Included: {pk.items.length} · Omitted: {pk.excluded.length} · ~
            {Math.ceil(pk.text.length / 4)} tokens (character estimate)
          </div>
          {pk.items
            .flatMap((i) => i.dependencies)
            .filter((id) => !pk!.items.some((i) => i.id === id)).length > 0 && (
            <div className="notice warning">
              Some selected items have omitted dependencies. Inspect the
              dependency list before continuing.
            </div>
          )}
          <pre className="packet-preview">{pk.text}</pre>
          <div className="actions">
            <Button
              onClick={() => {
                if (send({ type: "handoff", recipient, task, ids }))
                  setPreview(false);
              }}
            >
              Generate historical packet
            </Button>
          </div>
        </Panel>
      )}
      <Panel
        title="Generated handoffs"
        subtitle="Later project edits never rewrite these snapshots."
      >
        {state.packets
          .filter((pk) => pk.projectId === p.id)
          .slice()
          .reverse()
          .map((pk) => (
            <article key={pk.id} className="proposal-card">
              <div className="row">
                <b>
                  {pk.recipient} · v{pk.projectVersion}
                </b>
                <span className="status-badge">
                  {pk.projectVersion < p.version
                    ? "Newer project context exists"
                    : "Current at generation"}
                </span>
              </div>
              <p>{pk.task}</p>
              <small>
                {pk.timestamp} · {pk.id}
              </small>
              <details>
                <summary>Inspect saved packet and omissions</summary>
                <pre>{pk.text}</pre>
              </details>
              <div className="actions">
                <Button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(pk.text);
                      setCopyStatus("Packet copied");
                    } catch {
                      setCopyStatus(
                        "Clipboard unavailable. Select text in the packet preview to copy.",
                      );
                    }
                  }}
                >
                  Copy
                </Button>
                <Button
                  onClick={() =>
                    download(
                      `handoff-${pk.id}.json`,
                      JSON.stringify(pk, null, 2),
                    )
                  }
                >
                  Download JSON
                </Button>
                <Button
                  onClick={() => {
                    if (send({ type: "load", id: pk.id })) open();
                  }}
                >
                  Transfer to simulated {pk.recipient}
                </Button>
              </div>
            </article>
          ))}
        <p role="status">{copyStatus}</p>
      </Panel>
    </>
  );
}
function SyncReview({
  workspace,
  state,
  send,
}: Props & { workspace: AgentWorkspace }) {
  const recs = syncRecommendations(state, workspace.id);
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const last = state.syncEvents
    .filter((e) => e.workspaceId === workspace.id)
    .at(-1);
  return (
    <section className="sync-box">
      <div className="row">
        <b>
          Loaded v{workspace.loadedVersion} → Canonical v
          {state.projects.find((p) => p.id === workspace.projectId)?.version}
        </b>
        <span className="type">{recs.length} changes</span>
      </div>
      {recs.length ? (
        <>
          <p>
            {recs.some((r) => r.level === "critical")
              ? "Critical update: immediate review recommended."
              : recs.some((r) => r.level === "relevant")
                ? "Relevant context: defer until a task boundary."
                : "Unrelated updates can wait without interruption."}
          </p>
          {last && (
            <p className="muted">
              Last decision: {last.outcome} · {last.timestamp}
            </p>
          )}
          <Button
            onClick={() => {
              setOpen(!open);
              if (!open) send({ type: "syncInspect", id: workspace.id });
            }}
          >
            Inspect sync recommendations
          </Button>
          {open && (
            <>
              <p className="muted">
                Choose individual changes. This review never replaces the entire
                working context.
              </p>
              {recs.map((r) => (
                <label className="context-option" key={r.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(r.itemId)}
                    onChange={() =>
                      setSelected(
                        selected.includes(r.itemId)
                          ? selected.filter((id) => id !== r.itemId)
                          : [...selected, r.itemId],
                      )
                    }
                  />
                  <span>
                    <b>
                      {r.level.toUpperCase()} · {r.action}
                    </b>
                    <small>{r.reason}</small>
                    <span className="before">
                      Before: {r.before?.content || "Not loaded"}
                    </span>
                    <span>After: {r.after.content}</span>
                    <small>{r.after.source.reference}</small>
                  </span>
                </label>
              ))}
              <div className="actions">
                <Button
                  disabled={
                    !selected.some((id) => recs.some((r) => r.itemId === id))
                  }
                  onClick={() => {
                    send({
                      type: "sync",
                      id: workspace.id,
                      ids: selected,
                      outcome: "approved",
                    });
                    setSelected([]);
                  }}
                >
                  Approve selected changes
                </Button>
                <Button
                  onClick={() =>
                    send({
                      type: "sync",
                      id: workspace.id,
                      ids: recs.map((r) => r.itemId),
                      outcome: "declined",
                    })
                  }
                >
                  Decline sync
                </Button>
                <Button
                  onClick={() => {
                    send({
                      type: "sync",
                      id: workspace.id,
                      ids: recs.map((r) => r.itemId),
                      outcome: "deferred",
                    });
                    setOpen(false);
                  }}
                >
                  Defer sync
                </Button>
              </div>
            </>
          )}
        </>
      ) : (
        <p className="muted">
          No eligible updates pending. Excluded context remains excluded.
        </p>
      )}
    </section>
  );
}
function Agents({ state, send }: Props) {
  const workspaces = state.workspaces.filter(
    (w) => w.projectId === state.activeProjectId,
  );
  const [id, setId] = useState("");
  const w = workspaces.find((w) => w.id === id) || workspaces.at(-1);
  const [text, setText] = useState("");
  const [missing, setMissing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [why, setWhy] = useState("");
  const [category, setCategory] = useState<Category>("constraint");
  if (!w)
    return (
      <Panel title="No receiving workspace yet">
        <p>
          Generate a packet in Handoff builder, then transfer it to a simulated
          recipient.
        </p>
      </Panel>
    );
  return (
    <>
      <Panel
        title="Receiving workspaces"
        subtitle="Each packet can open a separate task branch; original packets stay immutable."
      >
        <label className="editor-label">
          Choose a recipient / branch
          <select value={w.id} onChange={(e) => setId(e.target.value)}>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.recipient} · {w.task.slice(0, 45)} · {w.id.slice(0, 6)}
              </option>
            ))}
          </select>
        </label>
        <p>
          <b>{w.recipient}</b> · Simulation only
        </p>
        <p>{w.task}</p>
        <SyncReview key={w.id} workspace={w} state={state} send={send} />
      </Panel>
      <div className="two-col">
        <Panel title="Loaded working context">
          <div className="memory-list">
            {w.items.map((i) => (
              <Item key={i.id} item={i} />
            ))}
          </div>
          <p className="muted">Source packet: {w.packetId}</p>
          <p className="muted">
            Missing categories:{" "}
            {["brief", "decision", "constraint", "open_question"]
              .filter((c) => !w.items.some((i) => i.category === c))
              .join(", ") || "None"}
          </p>
        </Panel>
        <Panel title="Continue the task">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (send({ type: "progress", id: w.id, content: text, missing }))
                setText("");
            }}
          >
            <Text
              label="Task progress or missing information"
              value={text}
              onChange={setText}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={missing}
                onChange={(e) => setMissing(e.target.checked)}
              />
              Report missing context
            </label>
            <button className="button primary" disabled={!text.trim()}>
              Record in workspace
            </button>
          </form>
          {w.progress.map((note, i) => (
            <p className="comment" key={i}>
              {note.content}
              <small>{note.timestamp}</small>
            </p>
          ))}
          {w.missing.map((note, i) => (
            <p className="notice warning" key={i}>
              Missing: {note}
            </p>
          ))}
        </Panel>
      </div>
      <Panel
        title="Return a finding to shared review"
        subtitle="Only the shown fields are submitted. Private notes and conversations stay local."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (
              send({
                type: "feedback",
                id: w.id,
                content: feedback,
                rationale: why,
                category,
              })
            ) {
              setFeedback("");
              setWhy("");
            }
          }}
        >
          <Select
            label="Proposed category"
            value={category}
            onChange={(v) => setCategory(v as Category)}
            values={categories.filter((c) => c !== "inbox")}
          />
          <Text
            label="Proposed requirement or new information"
            value={feedback}
            onChange={setFeedback}
          />
          <Text label="Rationale and evidence" value={why} onChange={setWhy} />
          <button
            className="button primary"
            disabled={!feedback.trim() || !why.trim()}
          >
            Submit feedback for team review
          </button>
        </form>
      </Panel>
      <Panel
        title="Your private AI exploration"
        subtitle="Adapted from Prototype B: notes → simulated chat → editable draft → human review."
      >
        <Button
          onClick={() => send({ type: "personalOpen", workspaceId: w.id })}
        >
          Load this working context into my private workspace
        </Button>
        <Private
          key={`${state.activeMemberId}-${state.activeProjectId}-${state.personal.some((x) => x.projectId === state.activeProjectId && x.ownerId === state.activeMemberId)}`}
          state={state}
          send={send}
        />
      </Panel>
    </>
  );
}
function Private({ state, send }: Props) {
  const session = state.personal.find(
    (s) =>
      s.projectId === state.activeProjectId &&
      s.ownerId === state.activeMemberId,
  );
  const [prompt, setPrompt] = useState("");
  const [notes, setNotes] = useState(session?.notes || "");
  if (!session)
    return (
      <p className="muted">
        Load a receiving workspace to start. Private sessions are isolated by
        member and project.
      </p>
    );
  const draft = session.draft;
  const changed = session.notes !== notes;
  return (
    <div className="private-grid" key={session.id}>
      <section>
        <h3>Private notes</h3>
        <Text
          label="Personal notes (not shared automatically)"
          value={notes}
          onChange={setNotes}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={session.notesEligible}
            onChange={(e) =>
              send({
                type: "personalNotes",
                id: session.id,
                text: notes,
                eligible: e.target.checked,
                auto: session.autoManage,
              })
            }
          />
          Allow notes to inform private draft
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={session.autoManage}
            onChange={(e) =>
              send({
                type: "personalNotes",
                id: session.id,
                text: notes,
                eligible: session.notesEligible,
                auto: e.target.checked,
              })
            }
          />
          Automatic simulated extraction
        </label>
        <Button
          onClick={() =>
            send({
              type: "personalNotes",
              id: session.id,
              text: notes,
              eligible: session.notesEligible,
              auto: session.autoManage,
            })
          }
        >
          {changed ? "Save notes & derive draft" : "Save notes"}
        </Button>
        <Select
          label="Private exploration tool"
          value={session.tool}
          onChange={(tool) =>
            send({ type: "personalTool", id: session.id, tool })
          }
          values={tools}
        />
        <h3>Chat context v{session.contextVersion}</h3>
        {["brief", "decisions", "constraints", "questions", "fact"].map((c) => (
          <label className="check" key={c}>
            <input
              type="checkbox"
              disabled={c === "brief"}
              checked={c === "brief" || session.includedCategories.includes(c)}
              onChange={() =>
                send({
                  type: "personalCategories",
                  id: session.id,
                  categories: session.includedCategories.includes(c)
                    ? session.includedCategories.filter((x) => x !== c)
                    : [...session.includedCategories, c],
                })
              }
            />
            {c}
          </label>
        ))}
      </section>
      <section>
        <h3>Simulated conversation</h3>
        <div className="chat-log">
          {session.messages.map((m) => (
            <article className={`chat ${m.role}`} key={m.id}>
              <b>
                {m.role === "assistant"
                  ? `${m.tool} · scripted simulation`
                  : "You"}{" "}
                · v{m.contextVersion}
              </b>
              <p>{m.text}</p>
              {m.steps?.map((step) => (
                <p key={step.title}>
                  <b>{step.title}</b> {step.text}
                </p>
              ))}
              <small>Sources: {m.itemIds?.join(", ") || "User message"}</small>
              {m.role === "assistant" && (
                <Button
                  onClick={() =>
                    send({
                      type: "personalGenerate",
                      id: session.id,
                      origin: "chat",
                      messageId: m.id,
                    })
                  }
                >
                  Use this response in my proposal
                </Button>
              )}
            </article>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (send({ type: "personalChat", id: session.id, text: prompt }))
              setPrompt("");
          }}
        >
          <Text
            label="Explore a task privately"
            value={prompt}
            onChange={setPrompt}
          />
          <button className="button primary" disabled={!prompt.trim()}>
            Send simulated message
          </button>
        </form>
      </section>
      <section>
        <h3>Editable context candidate</h3>
        <p className="muted">
          Human edits are protected from automatic extraction.
        </p>
        {draft ? (
          <>
            <label className="editor-label">
              Proposal target
              <select
                disabled={!!draft.proposalId}
                value={draft.itemId}
                onChange={(e) =>
                  send({
                    type: "personalTarget",
                    id: session.id,
                    targetId: e.target.value,
                  })
                }
              >
                {session.snapshotItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.category}: {i.content.slice(0, 40)}
                  </option>
                ))}
              </select>
            </label>
            <p className="before">Before: {draft.before}</p>
            <Text
              label="Proposed shared content"
              value={draft.after}
              onChange={(after) =>
                send({
                  type: "personalDraft",
                  id: session.id,
                  after,
                  why: draft.why,
                })
              }
            />
            <Text
              label="Why this should change"
              value={draft.why}
              onChange={(why) =>
                send({
                  type: "personalDraft",
                  id: session.id,
                  after: draft.after,
                  why,
                })
              }
            />
            <p className="muted">
              {draft.edited ? "Human edited" : "Simulated extraction"} · base v
              {draft.baseVersion} · {draft.sourceTool}
            </p>
            <div className="actions">
              <Button
                disabled={!!draft.proposalId}
                onClick={() => send({ type: "personalSubmit", id: session.id })}
              >
                Send shown draft for review
              </Button>
              <Button
                onClick={() => send({ type: "personalRebase", id: session.id })}
              >
                Rebase / revise draft
              </Button>
              <Button
                onClick={() =>
                  send({ type: "personalDismiss", id: session.id })
                }
              >
                Dismiss
              </Button>
            </div>
            {draft.proposalId && (
              <p className="notice">
                Linked review:{" "}
                {state.decisions.find((d) => d.id === draft.proposalId)?.status}
                . Notes and chat were excluded.
              </p>
            )}
          </>
        ) : (
          <p>
            No draft. Save eligible notes or generate from the latest response.
          </p>
        )}
        <div className="actions">
          <Button
            onClick={() => send({ type: "personalManual", id: session.id })}
          >
            Write a manual proposal
          </Button>
          <Button
            onClick={() =>
              send({
                type: "personalGenerate",
                id: session.id,
                origin: "notes",
              })
            }
          >
            Suggest from notes
          </Button>
          <Button
            onClick={() =>
              send({ type: "personalGenerate", id: session.id, origin: "chat" })
            }
          >
            Suggest from response
          </Button>
        </div>
      </section>
    </div>
  );
}
function History({ state, send }: Props) {
  const p = state.projects.find((p) => p.id === state.activeProjectId)!;
  return (
    <>
      <Panel title="Recipient version awareness">
        {state.workspaces
          .filter((w) => w.projectId === p.id)
          .map((w) => (
            <div key={w.id}>
              <h3>
                {w.recipient} · {w.task}
              </h3>
              <SyncReview workspace={w} state={state} send={send} />
            </div>
          ))}
        <SourceConflicts state={state} send={send} />
      </Panel>
      <Panel title="Canonical version history">
        {state.versions
          .filter((v) => v.projectId === p.id)
          .slice()
          .reverse()
          .map((v) => (
            <details key={v.id}>
              <summary>
                v{v.version} · {v.timestamp} · {v.items.length} items
              </summary>
              <div className="memory-list">
                {v.items
                  .filter((i) => visible(state, i))
                  .map((i) => (
                    <Item key={i.id} item={i} />
                  ))}
              </div>
            </details>
          ))}
      </Panel>
      <Panel title="What changed and why">
        {state.changes
          .filter((c) => c.projectId === p.id)
          .slice()
          .reverse()
          .map((c) => (
            <article className="proposal-card" key={c.id}>
              <b>
                {c.type.replaceAll("_", " ")} · v{c.previousVersion} → v
                {c.version}
              </b>
              <p className="muted">
                {state.members.find((m) => m.id === c.actorId)?.name} · {c.tool}{" "}
                · {c.timestamp}
              </p>
              {c.after
                .filter((i) => visible(state, i))
                .map((i) => (
                  <div key={i.id}>
                    <p className="before">
                      Before:{" "}
                      {c.before.find((x) => x.id === i.id)?.content ||
                        "New context"}
                    </p>
                    <p>After: {i.content}</p>
                    <small>{i.rationale}</small>
                  </div>
                ))}
            </article>
          ))}
      </Panel>
      <Panel title="Handoff receipts & sync outcomes">
        {state.receipts
          .filter((r) =>
            state.packets.some(
              (p) =>
                p.id === r.packetId && p.projectId === state.activeProjectId,
            ),
          )
          .map((r) => (
            <p key={r.id}>
              Received {r.packetId.slice(0, 8)} → {r.workspaceId.slice(0, 8)} ·{" "}
              {r.timestamp}
            </p>
          ))}
        {state.syncEvents
          .filter((e) =>
            state.workspaces.some(
              (w) =>
                w.id === e.workspaceId && w.projectId === state.activeProjectId,
            ),
          )
          .map((e) => (
            <p key={e.id}>
              {e.outcome} · v{e.version} ·{" "}
              {e.itemIds.join(", ") || "no selected items"} · {e.timestamp}
            </p>
          ))}
      </Panel>
      <Panel title="Original project activity">
        {(state.sourceActivity || [])
          .filter((a) => a.projectId === p.id)
          .map((a) => (
            <p key={a.id}>
              {a.actor} {a.content} · {a.tool} · {a.timestamp}
            </p>
          ))}
      </Panel>
      <Panel title="Activity trail">
        {state.logs
          .filter((e) => !e.projectId || e.projectId === p.id)
          .slice()
          .reverse()
          .map((e) => (
            <div className="history-row" key={e.id}>
              <span className="timeline-dot" />
              <div>
                <b>{e.type.replaceAll("_", " ")}</b>
                <small>
                  {state.members.find((m) => m.id === e.actorId)?.name} ·{" "}
                  {e.detail}
                </small>
              </div>
              <time>{e.timestamp}</time>
            </div>
          ))}
      </Panel>
    </>
  );
}
function Access({ state, send }: Props) {
  const [name, setName] = useState("");
  const me = state.members.find((m) => m.id === state.activeMemberId)!;
  return (
    <Panel
      title="People, permissions & personal notes"
      subtitle="Role checks are enforced in local transitions. They are research simulation controls, not server authentication."
    >
      {state.members.map((m) => (
        <div className="member-row" key={m.id}>
          <span className="avatar">{m.name[0]}</span>
          <div className="member-info">
            <b>{m.name}</b>
            <span>
              {m.role === "owner"
                ? "Review proposals, manage access, contribute, vote"
                : m.role === "editor"
                  ? "Contribute, vote, discuss, propose"
                  : "Read and explore; cannot approve or change canonical context"}
            </span>
          </div>
          <select
            aria-label={`Role for ${m.name}`}
            disabled={me.role !== "owner"}
            value={m.role}
            onChange={(e) =>
              send({
                type: "role",
                id: m.id,
                role: e.target.value as "owner" | "editor" | "viewer",
              })
            }
          >
            <option>owner</option>
            <option>editor</option>
            <option>viewer</option>
          </select>
        </div>
      ))}
      <form
        className="add-member"
        onSubmit={(e) => {
          e.preventDefault();
          if (send({ type: "addMember", name })) setName("");
        }}
      >
        <label>
          New collaborator
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button
          className="button"
          disabled={!name.trim() || me.role !== "owner"}
        >
          Add editor
        </button>
      </form>
      <h3>Your fictional personal notes</h3>
      {me.personalNotes.map((note, i) => (
        <p key={i}>{note}</p>
      ))}
      <p className="muted">
        Private notes are omitted from handoff packets and shared review
        payloads. Full project JSON exports contain the local study dataset.
      </p>
    </Panel>
  );
}
const studyPrompts: Record<string, string> = {
  Recall:
    "Find the current methodology and its rationale. Explain what remains unresolved.",
  Branching:
    "Create a separate receiving workspace for an alternative pilot task. Preserve the original context.",
  "Updating requirements":
    "Propose a methodology update, review its impact, and approve it as an owner.",
  "Context selection":
    "Choose only relevant, permitted context for a prototype implementation task.",
  "Cross-tool handoff":
    "Transfer approved methodology and constraints to Codex, record progress, then review a later update.",
  "Provenance checking":
    "Trace a decision to its conversation reference and inspect its version history.",
};
function Research({ state, send, onReset }: Props & { onReset: () => void }) {
  const [condition, setCondition] = useState(state.study.condition);
  const [scenario, setScenario] = useState(state.study.scenario);
  const [text, setText] = useState(state.study.baseline);
  const [copied, setCopied] = useState("");
  return (
    <>
      <Panel
        title="Study setup"
        subtitle="Fictional data; no measurements or outcomes are inferred."
      >
        <div className="form-row">
          <Select
            label="Condition"
            value={condition}
            onChange={(v) => setCondition(v as "Baseline" | "Crossville")}
            values={["Baseline", "Crossville"]}
          />
          <Select
            label="Scenario"
            value={scenario}
            onChange={setScenario}
            values={scenarios}
          />
        </div>
        <div className="actions">
          <Button
            onClick={() =>
              send({ type: "study", condition, scenario, active: true })
            }
          >
            Apply study condition
          </Button>
          <Button
            onClick={() =>
              send({
                type: "study",
                condition: state.study.condition,
                scenario: state.study.scenario,
                active: false,
              })
            }
          >
            Exit Research Mode
          </Button>
          <Button onClick={onReset}>Reset current scenario</Button>
        </div>
        <p>Task: {studyPrompts[state.study.scenario]}</p>
        <p className="muted">
          Reset restores scenario-specific fixtures, clears prior work and
          starts a new session. Export logs first.
        </p>
        <div className="actions">
          <Button
            disabled={state.study.started || !state.study.active}
            onClick={() => send({ type: "studyStart" })}
          >
            Start task
          </Button>
          <Button
            disabled={!state.study.started || state.study.complete}
            onClick={() => send({ type: "studyComplete" })}
          >
            Complete task
          </Button>
        </div>
      </Panel>
      {state.study.condition === "Baseline" && state.study.active ? (
        <Panel
          title="Manual text handoff"
          subtitle="Conventional copy and paste condition. Structured inspection, recommendations, version and sync tools are unavailable during this task."
        >
          <p className="baseline-material">
            {state.projects.find((p) => p.id === state.activeProjectId)?.name}.{" "}
            {state.items
              .filter(
                (i) =>
                  i.projectId === state.activeProjectId &&
                  i.privacy === "shared" &&
                  i.status === "confirmed" &&
                  i.category !== "inbox",
              )
              .map((i) => `${i.content} (Source: ${i.source.label}.)`)
              .join(" ")}{" "}
            {state.decisions
              .filter(
                (d) =>
                  d.projectId === state.activeProjectId &&
                  d.status === "pending",
              )
              .map((d) => `Unapproved suggestion awaiting review: ${d.content}`)
              .join(" ")}
          </p>
          <Text
            label="Write your unstructured summary for the next person or tool"
            value={text}
            onChange={setText}
            rows={9}
          />
          <div className="actions">
            <Button onClick={() => send({ type: "baseline", text })}>
              Save manual handoff
            </Button>
            <Button
              onClick={async () => {
                send({ type: "baseline", text });
                try {
                  await navigator.clipboard.writeText(text);
                  setCopied("Manual summary copied");
                } catch {
                  setCopied(
                    "Clipboard unavailable; select text and copy manually.",
                  );
                }
              }}
            >
              Copy manual handoff
            </Button>
            <Button
              onClick={() =>
                download("baseline-handoff.txt", text, "text/plain")
              }
            >
              Download text
            </Button>
          </div>
          <p role="status">{copied}</p>
        </Panel>
      ) : (
        <Panel title="Crossville condition">
          <p>
            Use the main navigation to complete the task with structured
            context, handoff inspection and controlled synchronization.
          </p>
        </Panel>
      )}
      <Panel title="Study event log">
        <p>
          {state.logs.length} events · session {state.study.sessionId}
        </p>
        <div className="actions">
          <Button
            onClick={() =>
              download(
                "crossville-study-events.json",
                JSON.stringify(state.logs, null, 2),
              )
            }
          >
            Export event JSON
          </Button>
          <Button
            onClick={() =>
              download("crossville-study-events.csv", csv(state), "text/csv")
            }
          >
            Export event CSV
          </Button>
        </div>
        <p className="muted">
          Exports contain logged actions, IDs and timestamps. They do not
          calculate study results.
        </p>
      </Panel>
    </>
  );
}

function ItemWorkflow({ item, state, send }: Props & { item: ContextItem }) {
  const [strictness, setStrictness] = useState(item.strictness || "Must");
  const [ruleType, setRuleType] = useState(item.ruleType || "Study limits");
  const [stage, setStage] = useState(
    item.stage === "Decided" ? "Answered" : item.stage || "Open",
  );
  const [assignee, setAssignee] = useState(item.assigneeId || "");
  const [findings, setFindings] = useState(item.findings || "");
  const me = state.members.find((m) => m.id === state.activeMemberId)!;
  return (
    <details>
      <summary>Lifecycle, related work & loaded recipients</summary>
      {item.category === "constraint" && (
        <>
          <div className="form-row">
            <Select
              label="Strictness"
              value={strictness}
              onChange={(v) => setStrictness(v as "Must" | "Prefer")}
              values={["Must", "Prefer"]}
            />
            <Select
              label="Rule type"
              value={ruleType}
              onChange={(v) =>
                setRuleType(v as "Study limits" | "Privacy and sharing")
              }
              values={["Study limits", "Privacy and sharing"]}
            />
          </div>
          <p className="muted">
            Must rules govern the task. Prefer rules are recommendations.
            Changes require owner review.
          </p>
          <Button
            disabled={me.role !== "owner"}
            onClick={() =>
              send({ type: "strictness", id: item.id, strictness, ruleType })
            }
          >
            Approve rule classification change
          </Button>
        </>
      )}
      {item.category === "open_question" && (
        <>
          <p>Current stage: {item.stage || "Open"}</p>
          {item.stage !== "Decided" ? (
            <>
              <Select
                label="Question stage"
                value={stage}
                onChange={(v) =>
                  setStage(v as "Open" | "Exploring" | "Answered")
                }
                values={["Open", "Exploring", "Answered"]}
              />
              <label className="editor-label">
                Question owner
                <select
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {state.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <Text
                label="Findings / answer"
                value={findings}
                onChange={setFindings}
              />
              <div className="actions">
                <Button
                  disabled={me.role === "viewer"}
                  onClick={() =>
                    send({
                      type: "question",
                      id: item.id,
                      stage,
                      assigneeId: assignee,
                      findings,
                    })
                  }
                >
                  Save question progress
                </Button>
                <Button
                  disabled={me.role === "viewer" || item.stage !== "Answered"}
                  onClick={() => send({ type: "promoteQuestion", id: item.id })}
                >
                  Propose findings as decision
                </Button>
              </div>
            </>
          ) : (
            <p>Linked decision: {item.linkedDecisionId}</p>
          )}
        </>
      )}
      <p className="muted">Who has this loaded:</p>
      {state.workspaces
        .filter(
          (w) =>
            w.projectId === item.projectId &&
            w.items.some((i) => i.id === item.id),
        )
        .map((w) => {
          const loaded = w.items.find((i) => i.id === item.id)!;
          return (
            <p className="muted" key={w.id}>
              {w.recipient} · item v{loaded.version} ·{" "}
              {loaded.version < item.version ? "Behind" : "Current"} · project
              snapshot v{w.loadedVersion}
            </p>
          );
        })}
      {!state.workspaces.some((w) => w.items.some((i) => i.id === item.id)) && (
        <p className="muted">No recipient has loaded this item.</p>
      )}
    </details>
  );
}

function ResetDialog({
  close,
  reset,
}: {
  close: () => void;
  reset: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="panel dialog"
      aria-labelledby="reset-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <h2 id="reset-title">Reset this study scenario?</h2>
      <p>
        This replaces local projects, packets, workspaces and logs. Export data
        first if needed.
      </p>
      <div className="actions">
        <button autoFocus className="button" onClick={close}>
          Cancel
        </button>
        <Button onClick={reset}>Restore scenario</Button>
      </div>
    </dialog>
  );
}

// Reused by the adaptive shell with the same canonical store and transitions.
export { Workspace as ProjectTools, Library as ContextLibrary, Access as PeopleAccess, ItemWorkflow, Discussion };
