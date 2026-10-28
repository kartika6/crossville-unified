// Adapted from the supplied Figma Make ConstraintsPanel.tsx and consensus.ts.
export function LockIcon({
  filled = false,
  size = 12,
}: {
  filled?: boolean;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.1"
    >
      <rect
        x="1.8"
        y="4.5"
        width="6.4"
        height="4.3"
        rx="1"
        fill={filled ? "currentColor" : "none"}
      />
      <path d="M3.2 4.5V3.2a1.8 1.8 0 013.6 0v1.3" />
    </svg>
  );
}
export function Avatar({
  name,
  small = false,
}: {
  name: string;
  small?: boolean;
}) {
  const palettes: Record<string, string> = {
    You: "you",
    "Teammate A": "a",
    "Teammate B": "b",
    Professor: "professor",
  };
  return (
    <span
      title={name}
      className={`cv-avatar ${palettes[name] || "you"} ${small ? "small" : ""}`}
    >
      {name === "You" ? "Y" : name === "Professor" ? "P" : name.slice(-1)}
    </span>
  );
}
export function Layers({ size = 23 }: { size?: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    >
      <path d="m3 7 9-5 9 5-9 5zM3 12l9 5 9-5M3 17l9 5 9-5" />
    </svg>
  );
}
