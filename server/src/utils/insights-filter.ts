/**
 * Convert a CloudWatch filter pattern to a Logs Insights filter clause.
 *
 * Handles:
 * - JSON filters: { $.field = "value" && $.other = "val" }
 * - Quoted text: "some text"
 * - Plain text: ERROR
 */
export function buildInsightsFilter(filterPattern: string): string {
  const pattern = filterPattern.trim();

  if (pattern.startsWith("{")) {
    // JSON filter pattern → Insights syntax
    const insightsFilter = pattern
      .replace(/^\{\s*/, "")
      .replace(/\s*\}$/, "")
      .replace(/\$\./g, "")
      .replace(/&&/g, "and")
      .replace(/\|\|/g, "or")
      .replace(/=\s*"\*([^"]*)\*"/g, "like /$1/");
    return `filter ${insightsFilter}`;
  }

  // Strip surrounding quotes (client may auto-quote for FilterLogEvents compat)
  const unquoted = pattern.replace(/^"(.*)"$/, "$1");
  return `filter @message like /${unquoted.replace(/[/\\]/g, "\\$&")}/`;
}

/**
 * Build stream filter clause for Insights.
 */
export function buildStreamFilter(logStreams: string): string {
  const streams = logStreams.split(",").filter(Boolean);
  const streamFilter = streams.map((s) => `@logStream = "${s}"`).join(" or ");
  return `filter (${streamFilter})`;
}
