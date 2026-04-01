import { useState, useMemo } from "react";
import type { Anomaly, LogEvent } from "../../stores/logStore";
import { tryParseJson } from "../../utils/jsonDetect";
import JsonPrettyPrint from "../LogViewer/JsonPrettyPrint";

interface AnomalyDetailProps {
  anomaly: Anomaly;
  logEvents: LogEvent[];
}

const SEVERITY_STYLES = {
  critical: "bg-error text-error-content",
  warning: "bg-warning text-warning-content",
  info: "bg-info text-info-content",
};

export default function AnomalyDetail({ anomaly, logEvents }: AnomalyDetailProps) {
  const eventIdSet = useMemo(() => new Set(anomaly.eventIds), [anomaly.eventIds]);
  const matchedLogs = useMemo(
    () => logEvents.filter((e) => eventIdSet.has(e.eventId)),
    [logEvents, eventIdSet],
  );
  const missingCount = anomaly.eventIds.length - matchedLogs.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-base-300">
        <div className="flex items-center gap-2 mb-2">
          <span className={`${SEVERITY_STYLES[anomaly.severity]} px-2 py-0.5 rounded text-[10px] font-bold`}>
            {anomaly.severity.toUpperCase()}
          </span>
          <h3 className="text-base font-semibold text-base-content">{anomaly.title}</h3>
        </div>
        <p className="text-sm text-base-content/70">{anomaly.description}</p>
      </div>

      {/* Recommendation */}
      <div className="mx-4 mt-3 px-3 py-2 rounded-lg border border-info/20 bg-info/5">
        <div className="text-[9px] font-semibold uppercase tracking-widest text-info/60 mb-1">
          Recommendation
        </div>
        <p className="text-sm text-base-content/80">{anomaly.recommendation}</p>
      </div>

      {/* Referenced Logs */}
      <div className="flex-1 overflow-auto mt-3">
        <div className="px-4 mb-2 flex items-center gap-2">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-base-content/30">
            Referenced Logs
          </span>
          <span className="text-[10px] text-base-content/40">
            ({matchedLogs.length} found{missingCount > 0 ? `, ${missingCount} not matched` : ""})
          </span>
        </div>
        <div className="px-2">
          {matchedLogs.map((event) => (
            <LogEntryRow key={event.eventId} event={event} />
          ))}
          {matchedLogs.length === 0 && (
            <div className="px-2 py-4 text-center text-sm text-base-content/40">
              No matching log entries found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LogEntryRow({ event }: { event: LogEvent }) {
  const [expanded, setExpanded] = useState(false);
  const parsed = useMemo(() => tryParseJson(event.message), [event.message]);

  const timestamp = useMemo(() => {
    const d = new Date(event.timestamp);
    const pad = (n: number) => String(n).padStart(2, "0");
    const ms = String(d.getMilliseconds()).padStart(3, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${ms}`;
  }, [event.timestamp]);

  return (
    <div className="border-b border-base-300/50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-2 py-1.5 hover:bg-base-300/40 transition-colors"
      >
        <div className="flex items-center gap-2 text-xs">
          <svg
            className={`h-3 w-3 text-base-content/30 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-base-content/40 shrink-0">{timestamp}</span>
          <span className="text-base-content/30 shrink-0 truncate max-w-[140px]">{event.logStreamName}</span>
          <span className="text-base-content/70 truncate">
            {event.message.length > 200 ? event.message.slice(0, 200) + "..." : event.message}
          </span>
        </div>
      </button>
      {expanded && (
        <div className="px-4 py-2 bg-base-100 border-t border-base-300/50">
          <pre className="whitespace-pre-wrap break-all text-xs text-base-content mb-2">
            {event.message}
          </pre>
          {parsed && (
            <div className="rounded-lg border border-base-300 bg-base-200/50 p-3">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-base-content/40">
                Parsed JSON
              </span>
              <JsonPrettyPrint data={parsed.json} />
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-base-content/40">
            <span><span className="text-base-content/50">Stream:</span> {event.logStreamName}</span>
            <span><span className="text-base-content/50">Group:</span> {event.logGroupName}</span>
          </div>
        </div>
      )}
    </div>
  );
}
