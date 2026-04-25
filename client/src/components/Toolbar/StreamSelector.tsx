import { useState, useRef, useEffect, useCallback } from "react";
import { useLogStore } from "../../stores/logStore";

interface StreamInfo {
  name: string;
  lastEventTimestamp?: number;
}

export default function StreamSelector() {
  const profile = useLogStore((s) => s.profile);
  const region = useLogStore((s) => s.region);
  const selectedLogGroups = useLogStore((s) => s.selectedLogGroups);
  const availableLogGroups = useLogStore((s) => s.availableLogGroups);
  const selectedStreams = useLogStore((s) => s.selectedStreams);
  const addStream = useLogStore((s) => s.addStream);
  const removeStream = useLogStore((s) => s.removeStream);

  const [allStreams, setAllStreams] = useState<StreamInfo[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch streams whenever log groups change
  const fetchStreams = useCallback(async () => {
    const activeLogGroups = availableLogGroups.length
      ? selectedLogGroups.filter((group) => availableLogGroups.includes(group))
      : selectedLogGroups;

    if (!profile || !region || activeLogGroups.length === 0) {
      setAllStreams([]);
      return;
    }
    setLoading(true);
    try {
      // Fetch streams for each selected log group in parallel
      const fetches = activeLogGroups.map(async (logGroup) => {
        const params = new URLSearchParams({ profile, region, logGroup });
        const res = await fetch(`/api/log-streams?${params.toString()}`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.logStreams ?? []) as StreamInfo[];
      });
      const results = await Promise.all(fetches);
      const combined = results.flat();
      // Deduplicate by name
      const seen = new Set<string>();
      const unique = combined.filter((s) => {
        if (seen.has(s.name)) return false;
        seen.add(s.name);
        return true;
      });
      setAllStreams(unique);
    } catch {
      setAllStreams([]);
    } finally {
      setLoading(false);
    }
  }, [availableLogGroups, profile, region, selectedLogGroups]);

  useEffect(() => {
    fetchStreams();
  }, [fetchStreams]);

  // Filter suggestions based on input and already-selected
  const filtered = allStreams.filter(
    (s) =>
      !selectedStreams.includes(s.name) &&
      (inputValue === "" || s.name.toLowerCase().includes(inputValue.toLowerCase())),
  );

  const handleSelect = (name: string) => {
    addStream(name);
    setInputValue("");
    setHighlightIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && inputValue === "" && selectedStreams.length > 0) {
      removeStream(selectedStreams[selectedStreams.length - 1]);
      return;
    }

    if (!isOpen || filtered.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(filtered[highlightIndex].name);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const disabled = !profile || !region || selectedLogGroups.length === 0;

  return (
    <div className="relative w-full min-w-0" ref={dropdownRef}>
      <div
        className={`flex flex-wrap items-center gap-1 rounded-lg border px-2 py-1 transition-colors bg-base-100 ${
          disabled
            ? "border-base-content/20 opacity-50"
            : "border-base-content/20 focus-within:border-base-content/40"
        }`}
      >
        {/* Chips */}
        {selectedStreams.map((s) => (
          <span
            key={s}
            className="badge badge-sm badge-accent gap-1"
          >
            <span className="max-w-[150px] truncate" title={s}>
              {s.length > 30 ? `...${s.slice(-30)}` : s}
            </span>
            <button
              type="button"
              onClick={() => removeStream(s)}
              className="ml-0.5"
              aria-label={`Remove ${s}`}
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
            setHighlightIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
          placeholder={
            selectedStreams.length === 0 ? "All streams (search/select)..." : "Add more..."
          }
          className="min-w-[100px] flex-1 border-none bg-transparent py-0.5 text-sm text-base-content outline-none placeholder:text-base-content/40"
        />

        {loading && (
          <span className="loading loading-spinner loading-sm" />
        )}
      </div>

      {/* Dropdown */}
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-base-300 bg-base-100 shadow-xl">
          {filtered.map((stream, idx) => (
            <button
              key={stream.name}
              type="button"
              onClick={() => handleSelect(stream.name)}
              className={`w-full px-2 py-1 text-left text-xs transition-colors ${
                idx === highlightIndex
                  ? "bg-primary/20 text-primary"
                  : "text-base-content hover:bg-base-200"
              }`}
            >
              <span className="block truncate">{stream.name}</span>
              {stream.lastEventTimestamp && (
                <span className="block text-[10px] text-base-content/40">
                  Last event: {new Date(stream.lastEventTimestamp).toLocaleString()}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {isOpen && !loading && filtered.length === 0 && allStreams.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm text-base-content/40 shadow-xl">
          No matching streams
        </div>
      )}
    </div>
  );
}
