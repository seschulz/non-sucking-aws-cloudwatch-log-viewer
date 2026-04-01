import { useState, useMemo } from "react";
import type { LogEvent } from "../../stores/logStore";
import { useLogStore } from "../../stores/logStore";
import { tryParseJson } from "../../utils/jsonDetect";
import { getByPath } from "../../utils/jsonPath";
import { detectLogLevel } from "../../utils/logLevel";
import { highlightMatches } from "../../utils/highlighter";
import JsonPrettyPrint from "./JsonPrettyPrint";
import type { ColDef } from "./LogTable";

interface LogRowProps {
  event: LogEvent;
  showGroup: boolean;
  showMessage: boolean;
  columns: ColDef[];
}

function extractFilterTerms(filterPattern: string): string[] {
  const terms: string[] = [];
  const quotedRegex = /"([^"]+)"/g;
  let match;
  while ((match = quotedRegex.exec(filterPattern)) !== null) {
    terms.push(match[1]);
  }
  if (terms.length === 0 && filterPattern && !filterPattern.trim().startsWith("{")) {
    terms.push(filterPattern.trim());
  }
  return terms.filter((t) => t.length > 0);
}

export default function LogRow({ event, showGroup, showMessage, columns }: LogRowProps) {
  const [expanded, setExpanded] = useState(false);
  const pinnedColumns = useLogStore((s) => s.pinnedColumns);
  const filterPattern = useLogStore((s) => s.filterPattern);

  const parsed = useMemo(() => tryParseJson(event.message), [event.message]);
  const logLevel = useMemo(
    () => detectLogLevel(event.message, parsed?.json),
    [event.message, parsed],
  );
  const filterTerms = useMemo(() => extractFilterTerms(filterPattern), [filterPattern]);

  const timestamp = useMemo(() => {
    const d = new Date(event.timestamp);
    const pad = (n: number) => String(n).padStart(2, "0");
    const ms = String(d.getMilliseconds()).padStart(3, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${ms}`;
  }, [event.timestamp]);

  const pinnedValues = useMemo(() => {
    if (!parsed?.json || pinnedColumns.length === 0) return {};
    const vals: Record<string, string> = {};
    for (const col of pinnedColumns) {
      const v = getByPath(parsed.json, col);
      if (v !== undefined) {
        vals[col] = typeof v === "object" ? JSON.stringify(v) : String(v);
      }
    }
    return vals;
  }, [parsed, pinnedColumns]);

  const truncatedMessage = useMemo(() => {
    const preferred = parsed?.json?.log_processed?.message;
    const raw = typeof preferred === "string" ? preferred : event.message;
    const msg = raw.trim();
    return msg.length > 300 ? msg.slice(0, 300) + "..." : msg;
  }, [event.message, parsed]);

  // Render cell content for a given column key
  const renderCell = (col: ColDef) => {
    switch (col.key) {
      case "__expand":
        return (
          <svg
            className={`mt-0.5 h-3.5 w-3.5 text-neutral-500 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        );
      case "__time":
        return (
          <span className="font-mono text-base-content/40">
            {timestamp}
          </span>
        );
      case "__level":
        return (
          <span
            className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 ${logLevel.badgeClass} w-[46px] text-[9px] font-bold uppercase tracking-wide`}
          >
            {logLevel.level}
          </span>
        );
      case "__group":
        return (
          <span className="badge badge-sm badge-accent badge-outline truncate">
            {event.logGroupName?.split("/").pop() || event.logGroupName}
          </span>
        );
      case "__message":
        return (
          <span className="truncate text-base-content">
            {filterTerms.length > 0
              ? highlightMatches(truncatedMessage, filterTerms)
              : truncatedMessage}
          </span>
        );
      default:
        // Pinned column
        return (
          <span
            className="truncate text-base-content"
            title={`${col.key}: ${pinnedValues[col.key] ?? "—"}`}
          >
            {filterTerms.length > 0 && pinnedValues[col.key]
              ? highlightMatches(pinnedValues[col.key], filterTerms)
              : (pinnedValues[col.key] ?? "—")}
          </span>
        );
    }
  };

  return (
    <div
      className={`border-l-4 ${logLevel.borderClass} ${logLevel.rowTintClass} cursor-pointer transition-colors duration-150 hover:bg-base-300/70 ${
        expanded ? "bg-base-200/30" : ""
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Collapsed row */}
      <div className="flex items-start px-3 py-1 text-xs">
        {columns.map((col, idx) => {
          const isLast = idx === columns.length - 1;
          return (
            <div
              key={col.key}
              className="shrink-0 truncate"
              style={col.flex && isLast ? { flex: 1, minWidth: col.minWidth } : { width: col.width }}
            >
              {renderCell(col)}
            </div>
          );
        })}
      </div>

      {/* Expanded view */}
      {expanded && (
        <div className="border-t border-base-300 bg-base-100 px-4 py-3" onClick={(e) => e.stopPropagation()}>
          {/* Full message */}
          <div className="mb-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-base-content/40">
              Message
            </span>
            <pre className="mt-1 whitespace-pre-wrap break-all text-xs text-base-content">
              {filterTerms.length > 0
                ? highlightMatches(event.message, filterTerms)
                : event.message}
            </pre>
          </div>

          {/* Metadata */}
          <div className="mb-2 flex flex-wrap gap-3 text-[10px] text-base-content/40">
            <span>
              <span className="text-base-content/50">Stream:</span> {event.logStreamName}
            </span>
            <span>
              <span className="text-base-content/50">Group:</span> {event.logGroupName}
            </span>
            <span>
              <span className="text-base-content/50">Event ID:</span> {event.eventId}
            </span>
          </div>

          {/* Pretty JSON */}
          {parsed && (
            <div className="mt-2 rounded-lg border border-base-300 bg-base-200/50 p-3">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-base-content/40">
                Parsed JSON
              </span>
              <JsonPrettyPrint data={parsed.json} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
