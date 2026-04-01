import { useEffect } from "react";
import { useLogStore } from "./stores/logStore";
import Toolbar from "./components/Toolbar/Toolbar";
import LogTable from "./components/LogViewer/LogTable";
import Histogram from "./components/Histogram/Histogram";
import ToastContainer from "./components/ToastContainer";
import { useResizable } from "./hooks/useResizable";
import AnomalyView from "./components/AnomalyView/AnomalyView";

export default function App() {
  const theme = useLogStore((s) => s.theme);
  const histogramData = useLogStore((s) => s.histogramData);
  const isHistogramLoading = useLogStore((s) => s.isHistogramLoading);
  const histogramError = useLogStore((s) => s.histogramError);
  const analysisResult = useLogStore((s) => s.analysisResult);
  const isAnalyzing = useLogStore((s) => s.isAnalyzing);
  const profile = useLogStore((s) => s.profile);
  const region = useLogStore((s) => s.region);
  const selectedLogGroups = useLogStore((s) => s.selectedLogGroups);
  const logEvents = useLogStore((s) => s.logEvents);
  const nextToken = useLogStore((s) => s.nextToken);
  const queryTime = useLogStore((s) => s.queryTime);
  const isTailing = useLogStore((s) => s.isTailing);
  const showHistogramPanel = isHistogramLoading || histogramError || (histogramData && histogramData.length > 0);

  const { size: histogramHeight, handleMouseDown: onHistogramResize } = useResizable({
    storageKey: "aws-logs:histogram-height",
    defaultSize: 140,
    min: 60,
    max: 300,
    direction: "vertical",
  });

  // Sync the data-theme attribute on <html> whenever theme changes
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
  }, [theme]);

  return (
    <div
      className="flex min-h-screen flex-col bg-base-100 text-base-content"
    >
      <Toolbar />
      <div className="flex flex-1 flex-col gap-3 p-3">
        {showHistogramPanel && (
          <>
            <div
              className="rounded-lg border border-base-300 bg-base-200/40 overflow-hidden"
              style={{ height: histogramHeight }}
            >
              <Histogram height={histogramHeight} />
            </div>
            {/* Histogram resize handle */}
            <div
              className="group flex items-center justify-center h-2 -mt-1.5 -mb-1.5 cursor-row-resize z-10"
              onMouseDown={onHistogramResize}
            >
              <div className="h-[3px] w-10 rounded-full bg-accent/0 group-hover:bg-accent/60 transition-colors" />
            </div>
          </>
        )}
        <div className="flex flex-1 flex-col rounded-lg border border-base-300 bg-base-200/40 overflow-hidden">
          {isAnalyzing ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <span className="loading loading-spinner loading-lg text-secondary" />
              <span className="text-sm text-base-content/50">Analyzing logs...</span>
            </div>
          ) : analysisResult ? (
            <AnomalyView />
          ) : (
            <LogTable />
          )}
        </div>
      </div>
      {/* Status bar — sticky footer */}
      <div className="sticky bottom-0 z-40 flex items-center justify-between border-t border-base-300 bg-base-200/80 backdrop-blur px-4 py-1 text-[10px] text-base-content/40">
        <span>
          {profile ?? "—"} · {region ?? "—"}
          {selectedLogGroups.length > 0 && <> · {selectedLogGroups.length} log group{selectedLogGroups.length !== 1 ? "s" : ""}</>}
          {logEvents.length > 0 && <> · {logEvents.length.toLocaleString()} events{nextToken ? "+" : ""}</>}
        </span>
        <span>
          {queryTime !== null && <>{queryTime}s · </>}
          Live Tail: {isTailing ? <span className="text-warning">On</span> : "Off"}
        </span>
      </div>
      <ToastContainer />
    </div>
  );
}
