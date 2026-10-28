import type { MemoryItem } from "../types";
export function MemoryCard({ item }: { item: MemoryItem }) {
  return (
    <article className="memory-card">
      <div className="memory-meta">
        <span className={`type type-${item.type}`}>
          {item.type.replace("_", " ")}
        </span>
        <strong>v{item.version}</strong>
      </div>
      <p>{item.text}</p>
      <footer>
        {item.author} <span>·</span> {item.source} <span>·</span>{" "}
        {item.updatedAt}
      </footer>
    </article>
  );
}
