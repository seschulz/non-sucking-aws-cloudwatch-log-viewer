import { useState, useRef, useEffect } from "react";
import { useLogStore } from "../../stores/logStore";

const PRESETS = [
  { value: "general", label: "General Anomalies" },
  { value: "error-spikes", label: "Error Spikes" },
  { value: "latency", label: "Latency Issues" },
  { value: "custom", label: "Custom Prompt" },
];

export default function AnalyzeButton() {
  const logEvents = useLogStore((s) => s.logEvents);
  const isAnalyzing = useLogStore((s) => s.isAnalyzing);
  const analysisPreset = useLogStore((s) => s.analysisPreset);
  const customAnalysisPrompt = useLogStore((s) => s.customAnalysisPrompt);
  const setAnalysisPreset = useLogStore((s) => s.setAnalysisPreset);
  const setCustomAnalysisPrompt = useLogStore((s) => s.setCustomAnalysisPrompt);
  const analyzeLogs = useLogStore((s) => s.analyzeLogs);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const analyzeDisabled = logEvents.length === 0 || isAnalyzing;
  const disabledReason = isAnalyzing ? "Analysis in progress" : "Search logs to enable analysis";

  const mainButtonClass = isAnalyzing
    ? "btn btn-secondary btn-sm rounded-r-none"
    : analyzeDisabled
      ? "btn btn-sm rounded-r-none border-base-300 bg-base-100 text-base-content/35 shadow-none hover:bg-base-100"
      : "btn btn-secondary btn-sm rounded-r-none";

  const toggleButtonClass = isAnalyzing
    ? "btn btn-secondary btn-sm rounded-l-none border-l border-secondary-content/20 px-1.5"
    : analyzeDisabled
      ? "btn btn-sm rounded-l-none border-base-300 border-l border-l-base-300 bg-base-100 px-1.5 text-base-content/45 shadow-none hover:bg-base-200"
      : "btn btn-secondary btn-sm rounded-l-none border-l border-secondary-content/20 px-1.5";

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative flex items-center gap-0" ref={dropdownRef}>
      {/* Main analyze button */}
      <button
        type="button"
        onClick={() => analyzeLogs()}
        disabled={analyzeDisabled}
        title={analyzeDisabled ? disabledReason : "Analyze current results"}
        className={mainButtonClass}
      >
        {isAnalyzing ? (
          <span className="loading loading-spinner loading-sm" />
        ) : (
          <svg className={`h-4 w-4 ${analyzeDisabled ? "opacity-60" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )}
        <span className={analyzeDisabled ? "tracking-[0.02em]" : ""}>Analyze</span>
      </button>

      {/* Dropdown toggle */}
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        disabled={isAnalyzing}
        title={isAnalyzing ? disabledReason : "Choose analysis preset"}
        className={toggleButtonClass}
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {dropdownOpen && (
        <div className="absolute top-full right-0 z-50 mt-1 w-72 rounded-lg border border-base-300 bg-base-200 shadow-xl">
          <div className="p-2">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-base-content/30 px-2 py-1">
              Analysis Preset
            </div>
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-base-300 transition-colors ${
                  analysisPreset === p.value ? "bg-base-300 text-secondary" : "text-base-content/70"
                }`}
                onClick={() => {
                  setAnalysisPreset(p.value);
                  if (p.value !== "custom") setDropdownOpen(false);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          {analysisPreset === "custom" && (
            <div className="border-t border-base-300 p-2">
              <textarea
                className="textarea textarea-bordered textarea-sm w-full h-20 text-xs"
                placeholder="Describe what to look for..."
                value={customAnalysisPrompt}
                onChange={(e) => setCustomAnalysisPrompt(e.target.value)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
