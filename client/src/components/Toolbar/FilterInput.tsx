import { useState, useRef, useEffect } from "react";
import { useLogStore } from "../../stores/logStore";

export default function FilterInput() {
  const filterPattern = useLogStore((s) => s.filterPattern);
  const setFilterPattern = useLogStore((s) => s.setFilterPattern);
  const fetchLogs = useLogStore((s) => s.fetchLogs);
  const searchHistory = useLogStore((s) => s.searchHistory);
  const clearSearchHistory = useLogStore((s) => s.clearSearchHistory);

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter history by current input
  const filtered = filterPattern.trim()
    ? searchHistory.filter((h) =>
        h.toLowerCase().includes(filterPattern.toLowerCase()),
      )
    : searchHistory;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setIsOpen(false);
      fetchLogs();
    }
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    if (searchHistory.length > 0) {
      setIsOpen(true);
    }
  };

  const handleBlur = () => {
    blurTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  const handleSelect = (pattern: string) => {
    setFilterPattern(pattern);
    setIsOpen(false);
  };

  const handleClearHistory = () => {
    clearSearchHistory();
    setIsOpen(false);
  };

  // Clean up blur timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative flex-1 min-w-[240px]">
      <input
        type="text"
        value={filterPattern}
        onChange={(e) => setFilterPattern(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder='Example: $.log_processed.level = "ERROR" && ($.code = 500 || $.code = 503) or "connection timeout"'
        className="input input-sm border border-base-content/20 bg-base-100 w-full"
      />

      {isOpen && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-base-300 bg-base-100 shadow-xl">
          {filtered.map((pattern) => (
            <button
              key={pattern}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(pattern)}
              className="flex w-full items-center px-3 py-1.5 text-left text-sm text-base-content/70 hover:bg-base-200 truncate"
            >
              <svg className="h-3.5 w-3.5 shrink-0 mr-2 text-base-content/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="truncate">{pattern}</span>
            </button>
          ))}
          <div className="border-t border-base-300">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClearHistory}
              className="w-full px-3 py-1.5 text-left text-xs text-base-content/40 hover:bg-base-200 hover:text-error"
            >
              Clear history
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
