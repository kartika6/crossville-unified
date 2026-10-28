export type Category = "Brief" | "Decisions" | "Constraints" | "Open questions";
export type Person = "You" | "Teammate A" | "Teammate B" | "Professor";
export type Votes = Record<Person, Category | null>;

export const CATEGORIES: Category[] = [
  "Brief",
  "Decisions",
  "Constraints",
  "Open questions",
];
export const PEOPLE: Person[] = [
  "You",
  "Teammate A",
  "Teammate B",
  "Professor",
];
export const AV: Record<string, string> = {
  You: "bg-[#e6edff] text-[#4c6cb7]",
  "Teammate A": "bg-[#f2e8dd] text-[#98754d]",
  "Teammate B": "bg-[#e8e6f5] text-[#81739c]",
  Professor: "bg-[#e2eee8] text-[#638a74]",
};
export const initial = (p: string) =>
  p === "You" ? "Y" : p === "Professor" ? "P" : p.slice(-1);

type Others = Record<Exclude<Person, "You">, Category | null>;
export type Card = {
  text: string;
  who: string;
  tool: string;
  cat: Category;
  conf: string;
  match: string;
  others: Others;
};

const all = (c: Category): Others => ({
  "Teammate A": c,
  "Teammate B": c,
  Professor: c,
});

// Simulated teammate votes: cards 1, 2, 4, 6 agree; card 3 conflicts; card 5 waits on Teammate B.
export const CARDS: Card[] = [
  {
    text: "Switch the study method to action research inside our team.",
    who: "Teammate B",
    tool: "NotebookLM",
    cat: "Decisions",
    conf: "High",
    match: "Switch the study method",
    others: all("Decisions"),
  },
  {
    text: "Interviews need IRB approval, which takes four weeks.",
    who: "Teammate A",
    tool: "Claude",
    cat: "Constraints",
    conf: "High",
    match: "need IRB approval",
    others: all("Constraints"),
  },
  {
    text: "Do we still need outside participants?",
    who: "Professor",
    tool: "ChatGPT",
    cat: "Open questions",
    conf: "Medium",
    match: "Do we still need",
    others: {
      "Teammate A": "Brief",
      "Teammate B": "Open questions",
      Professor: "Open questions",
    },
  },
  {
    text: "The study explores how teams share context with their own AI tools.",
    who: "You",
    tool: "Claude",
    cat: "Brief",
    conf: "High",
    match: "The study explores",
    others: all("Brief"),
  },
  {
    text: "Use two-week cycles for each action research round.",
    who: "Teammate B",
    tool: "Gemini",
    cat: "Decisions",
    conf: "Medium",
    match: "Use two-week cycles",
    others: {
      "Teammate A": "Decisions",
      "Teammate B": null,
      Professor: "Decisions",
    },
  },
  {
    text: "Sessions must stay under 45 minutes.",
    who: "Teammate A",
    tool: "Codex",
    cat: "Constraints",
    conf: "Low",
    match: "must stay under",
    others: all("Constraints"),
  },
];

export type Entry = {
  id: number;
  text: string;
  who: string;
  tool: string;
  suggested: Category;
  votes: Votes;
  revote?: boolean;
  target?: Category;
};

export const makeEntry = (id: number, you: Category): Entry => {
  const c = CARDS[id];
  return {
    id,
    text: c.text,
    who: c.who,
    tool: c.tool,
    suggested: c.cat,
    votes: { You: you, ...c.others },
  };
};

export type Status =
  | { kind: "waiting"; names: Person[] }
  | { kind: "agreed"; cat: Category }
  | { kind: "conflict"; cats: Category[] };

export const statusOf = (votes: Votes): Status => {
  const names = PEOPLE.filter((p) => votes[p] === null);
  if (names.length) return { kind: "waiting", names };
  const cats = Array.from(new Set(PEOPLE.map((p) => votes[p] as Category)));
  return cats.length === 1
    ? { kind: "agreed", cat: cats[0] }
    : { kind: "conflict", cats };
};

// Majority category among the three teammates, used for the simulated re-vote.
export const majority = (votes: Votes): Category => {
  const counts = new Map<Category, number>();
  (["Teammate A", "Teammate B", "Professor"] as Person[]).forEach((p) => {
    const v = votes[p];
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  });
  return (
    Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Brief"
  );
};
