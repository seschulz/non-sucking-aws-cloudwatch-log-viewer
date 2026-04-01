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
          className="bg-warning/30 text-warning-content rounded-sm px-0.5"
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
