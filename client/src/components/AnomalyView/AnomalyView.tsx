import { useState, useRef, useCallback } from "react";
import { useLogStore } from "../../stores/logStore";
import AnomalyCard from "./AnomalyCard";
import AnomalyDetail from "./AnomalyDetail";

function getInitialSplit(): number {
  try {
    const stored = localStorage.getItem("aws-logs:anomaly-split");
    if (stored) {
      const val = Number(stored);
      if (!Number.isNaN(val) && val >= 20 && val <= 60) return val;
    }
  } catch { /* ignore */ }
  return 40;
}

export default function AnomalyView() {
  const analysisResult = useLogStore((s) => s.analysisResult);
  const selectedAnomalyIndex = useLogStore((s) => s.selectedAnomalyIndex);
  const setSelectedAnomalyIndex = useLogStore((s) => s.setSelectedAnomalyIndex);
  const clearAnalysis = useLogStore((s) => s.clearAnalysis);
  const logEvents = useLogStore((s) => s.logEvents);

  const containerRef = useRef<HTMLDivElement>(null);
  const [splitPercent, setSplitPercent] = useState(getInitialSplit);
  const splitRef = useRef(splitPercent);
  splitRef.current = splitPercent;

  const onSplitResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (me: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const pct = ((me.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.max(20, Math.min(60, pct));
      setSplitPercent(clamped);
      splitRef.current = clamped;
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        localStorage.setItem("aws-logs:anomaly-split", String(splitRef.current));
      } catch { /* ignore */ }
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  if (!analysisResult) return null;

  const selectedAnomaly =
    selectedAnomalyIndex !== null ? analysisResult.anomalies[selectedAnomalyIndex] : null;

  // Empty state
  if (analysisResult.anomalies.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <svg className="h-16 w-16 text-success/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-center">
          <p className="text-base-content/70 text-sm">{analysisResult.summary}</p>
        </div>
        <button type="button" onClick={clearAnalysis} className="btn btn-outline btn-sm">
          Back to Logs
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden">
      {/* Left panel — anomaly list */}
      <div className="flex flex-col border-r border-base-300 overflow-hidden" style={{ width: `${splitPercent}%` }}>
        {/* Header */}
        <div className="px-3 py-2 border-b border-base-300 flex items-center gap-2">
          <button
            type="button"
            onClick={clearAnalysis}
            className="btn btn-ghost btn-xs"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Logs
          </button>
        </div>

        {/* Summary */}
        <div className="px-3 py-2 border-b border-base-300 bg-info/5">
          <p className="text-xs text-base-content/60">{analysisResult.summary}</p>
        </div>

        {/* Anomaly list */}
        <div className="flex-1 overflow-auto">
          {analysisResult.anomalies.map((anomaly, idx) => (
            <AnomalyCard
              key={`${anomaly.severity}-${anomaly.title}`}
              anomaly={anomaly}
              isSelected={selectedAnomalyIndex === idx}
              onClick={() => setSelectedAnomalyIndex(idx)}
            />
          ))}
        </div>
      </div>

      {/* Resize handle */}
      <div
        className="group flex items-center justify-center w-2 -ml-1 -mr-1 cursor-col-resize z-10"
        onMouseDown={onSplitResize}
      >
        <div className="w-[3px] h-10 rounded-full bg-accent/0 group-hover:bg-accent/60 transition-colors" />
      </div>

      {/* Right panel — detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedAnomaly ? (
          <AnomalyDetail anomaly={selectedAnomaly} logEvents={logEvents} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-base-content/30 text-sm">
            Select an anomaly to view details
          </div>
        )}
      </div>
    </div>
  );
}
