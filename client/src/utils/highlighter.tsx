import React from "react";

export function highlightMatches(
  text: string,
  terms: string[],
): React.ReactNode[] {
  if (!terms.length || !text) return [text];

  // Build a combined regex for all terms, case-insensitive
  const escaped = terms
    .filter((t) => t.length > 0)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return [text];

  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (regex.test(part)) {
      // Reset lastIndex since we used .test
      regex.lastIndex = 0;
      return (
        <mark
          key={i}
          className="rounded-sm bg-amber-300/60 px-0.5 text-amber-950 ring-1 ring-amber-500/30 dark:bg-yellow-300/75 dark:text-zinc-950 dark:ring-yellow-200/50"
        >
          {part}
        </mark>
      );
    }
    // Also reset for next iteration
    regex.lastIndex = 0;
    return <span key={i}>{part}</span>;
  });
}
