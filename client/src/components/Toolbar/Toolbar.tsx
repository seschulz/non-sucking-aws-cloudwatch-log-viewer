import { useLogStore } from "../../stores/logStore";
import { useLiveTail } from "../../hooks/useLiveTail";
import { ProfileDropdown, RegionDropdown } from "./ProfileSelector";
import LogGroupPicker from "./LogGroupPicker";
import StreamSelector from "./StreamSelector";
import TimeRangePicker from "./TimeRangePicker";
import FilterInput from "./FilterInput";
import QueryPresets from "./QueryPresets";
import ThemeToggle from "../ThemeToggle";
import SavedFilters from "../SavedFilters";
import AnalyzeButton from "./AnalyzeButton";

export default function Toolbar() {
  const theme = useLogStore((s) => s.theme);
  const fetchLogs = useLogStore((s) => s.fetchLogs);
  const isLoading = useLogStore((s) => s.isLoading);
  const isTailing = useLogStore((s) => s.isTailing);
  const setIsTailing = useLogStore((s) => s.setIsTailing);

  const { start, stop } = useLiveTail();

  const handleTailToggle = () => {
    if (isTailing) {
      stop();
      setIsTailing(false);
    } else {
      start();
      setIsTailing(true);
    }
  };

  return (
    <div className="sticky top-0 z-40 border-b border-base-300 shadow-lg">
      {/* App header bar */}
      <div className={`flex items-center justify-between px-4 py-1.5 border-b border-base-300 ${
        theme === "dark" ? "bg-neutral text-neutral-content" : "bg-base-content/10 text-base-content"
      }`}>
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <polyline points="1,9 4,9 6,3 8,14 10,6 12,11 14,9 17,9" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.85"/>
          </svg>
          <span className="font-bold text-[12px] uppercase tracking-[1.5px]">Non-Sucking AWS CloudWatch Log Viewer</span>
        </div>
        <div className="flex items-center gap-1">
          <SavedFilters />
          <ThemeToggle />
        </div>
      </div>

      {/* Controls area */}
      <div className="bg-base-200 px-4 py-2.5">
        {/* Row 1: Grouped selectors */}
        <div className="flex flex-wrap items-end gap-4 mb-3.5">
          {/* Profile group */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-base-content/30">AWS Profile</span>
            <ProfileDropdown />
          </div>

          {/* Region group */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-base-content/30">Region</span>
            <RegionDropdown />
          </div>

          {/* Separator */}
          <div className="hidden sm:block h-7 w-px bg-base-content/20 self-end mb-0.5" />

          {/* Log Groups group */}
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-base-content/30">Log Groups</span>
            <LogGroupPicker />
          </div>

          {/* Log Streams group */}
          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-base-content/30">Log Streams</span>
            <StreamSelector />
          </div>
        </div>

        {/* Row 2: Query controls */}
        <div className="flex flex-wrap items-center gap-2">
          <QueryPresets />
          <FilterInput />
          <TimeRangePicker />

          <button
            type="button"
            onClick={() => fetchLogs()}
            disabled={isLoading}
            className="btn btn-accent btn-sm transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            {isLoading ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            Search
          </button>

          <button
            type="button"
            onClick={handleTailToggle}
            className={`btn btn-sm transition-all duration-150 ${
              isTailing
                ? "btn-success shadow-[0_0_8px_rgba(34,197,94,0.4)] border-success"
                : "btn-warning"
            }`}
          >
            {isTailing ? (
              <span className="flex items-center gap-[3px]">
                <span className="h-3 w-[3px] animate-[bar-bounce_1s_ease-in-out_infinite] rounded-full bg-current" />
                <span className="h-3 w-[3px] animate-[bar-bounce_1s_ease-in-out_0.15s_infinite] rounded-full bg-current" />
                <span className="h-3 w-[3px] animate-[bar-bounce_1s_ease-in-out_0.3s_infinite] rounded-full bg-current" />
              </span>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            Live Tail
          </button>

          {/* Separator */}
          <div className="hidden sm:block h-7 w-px bg-base-content/20" />

          <AnalyzeButton />
        </div>
      </div>
    </div>
  );
}
