import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useLogStore } from "../../stores/logStore";
import { useToastStore } from "../../stores/toastStore";

const STARRED_KEY = "aws-logs:starred-groups";

function readStarred(): Set<string> {
  try {
    const raw = localStorage.getItem(STARRED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {}
  return new Set();
}

function getGroupSuffix(group: string): string {
  const parts = group.split("/");
  return parts[parts.length - 1] || group;
}

function reconcileSelectedGroups(selectedGroups: string[], availableGroups: string[]): string[] {
  const availableSet = new Set(availableGroups);
  const nextGroups: string[] = [];

  for (const group of selectedGroups) {
    if (availableSet.has(group)) {
      nextGroups.push(group);
      continue;
    }

    const suffix = getGroupSuffix(group);
    const matches = availableGroups.filter((candidate) => getGroupSuffix(candidate) === suffix);

    if (matches.length === 1) {
      nextGroups.push(matches[0]);
      continue;
    }

    nextGroups.push(group);
  }

  return [...new Set(nextGroups)];
}

export default function LogGroupPicker() {
  const profile = useLogStore((s) => s.profile);
  const region = useLogStore((s) => s.region);
  const selectedLogGroups = useLogStore((s) => s.selectedLogGroups);
  const addLogGroup = useLogStore((s) => s.addLogGroup);
  const removeLogGroup = useLogStore((s) => s.removeLogGroup);
  const setAvailableLogGroups = useLogStore((s) => s.setAvailableLogGroups);

  const [inputValue, setInputValue] = useState("");
  const [allGroups, setAllGroups] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [starred, setStarred] = useState<Set<string>>(readStarred);
  const addToast = useToastStore((s) => s.addToast);

  const toggleStar = useCallback((group: string) => {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      try {
        localStorage.setItem(STARRED_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch all log groups (paginating through all pages) when profile/region changes
  const fetchAllGroups = useCallback(async () => {
    if (!profile || !region) {
      setAllGroups([]);
      setAvailableLogGroups([]);
      return;
    }
    setIsLoading(true);
    try {
      const groups: string[] = [];
      let nextToken: string | undefined;
      do {
        const params = new URLSearchParams({ profile, region });
        if (nextToken) params.set("nextToken", nextToken);
        const res = await fetch(`/api/log-groups?${params.toString()}`);
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `HTTP ${res.status}`);
        }
        const data = await res.json();
        groups.push(...(data.logGroups ?? []));
        nextToken = data.nextToken;
      } while (nextToken);
      setAllGroups(groups);
      setAvailableLogGroups(groups);
      const current = useLogStore.getState().selectedLogGroups;
      const reconciled = reconcileSelectedGroups(current, groups);
      if (reconciled.length !== current.length || reconciled.some((group, index) => group !== current[index])) {
        useLogStore.setState({ selectedLogGroups: reconciled });
      }
    } catch (err: any) {
      setAllGroups([]);
      setAvailableLogGroups([]);
      addToast(err.message || "Failed to load log groups");
    } finally {
      setIsLoading(false);
    }
  }, [addToast, profile, region, setAvailableLogGroups]);

  useEffect(() => {
    fetchAllGroups();
  }, [fetchAllGroups]);

  // Client-side substring filtering
  const filtered = useMemo(() => {
    const term = inputValue.toLowerCase();
    const matching = allGroups.filter(
      (g) =>
        !selectedLogGroups.includes(g) &&
        (term === "" || g.toLowerCase().includes(term)),
    );
    const starredGroups = matching.filter((g) => starred.has(g)).sort();
    const unstarredGroups = matching.filter((g) => !starred.has(g)).sort();
    return { starred: starredGroups, unstarred: unstarredGroups };
  }, [allGroups, inputValue, selectedLogGroups, starred]);

  const allFiltered = useMemo(
    () => [...filtered.starred, ...filtered.unstarred],
    [filtered],
  );

  const handleSelect = (group: string) => {
    addLogGroup(group);
    setInputValue("");
    setHighlightIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && inputValue === "" && selectedLogGroups.length > 0) {
      removeLogGroup(selectedLogGroups[selectedLogGroups.length - 1]);
      return;
    }

    if (!isOpen || allFiltered.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, allFiltered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(allFiltered[highlightIndex]);
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

  const disabled = !profile || !region;

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
        {selectedLogGroups.map((g) => (
          <span
            key={g}
            className="badge badge-sm badge-accent gap-1"
          >
            <span className="max-w-[200px] truncate" title={g}>
              {g.split("/").pop() || g}
            </span>
            <button
              type="button"
              onClick={() => removeLogGroup(g)}
              className="ml-0.5"
              aria-label={`Remove ${g}`}
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
            selectedLogGroups.length === 0 ? "Search log groups..." : "Add more..."
          }
          className="min-w-[120px] flex-1 border-none bg-transparent py-0.5 text-sm text-base-content outline-none placeholder:text-base-content/40"
        />

        {isLoading && (
          <span className="loading loading-spinner loading-sm" />
        )}

        {selectedLogGroups.length > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); useLogStore.setState({ selectedLogGroups: [], selectedStreams: [] }); }}
            className="shrink-0 ml-1 p-0.5 rounded text-base-content/50 hover:text-error hover:bg-error/10 transition-colors"
            title="Clear all log groups"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Loading dropdown */}
      {isOpen && isLoading && allFiltered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-base-300 bg-base-100 px-3 py-3 shadow-xl">
          <div className="flex items-center gap-2 text-sm text-base-content/40">
            <span className="loading loading-spinner loading-sm" />
            Loading log groups...
          </div>
        </div>
      )}

      {/* Dropdown */}
      {isOpen && allFiltered.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-base-300 bg-base-100 shadow-xl">
          {filtered.starred.map((group, idx) => (
            <button
              key={group}
              type="button"
              onClick={() => handleSelect(group)}
              className={`group flex w-full items-center px-2 py-1 text-left text-xs transition-colors ${
                idx === highlightIndex
                  ? "bg-primary/20 text-primary"
                  : "text-base-content hover:bg-base-200"
              }`}
            >
              <span className="flex-1 truncate">{group}</span>
              <span
                onClick={(e) => { e.stopPropagation(); toggleStar(group); }}
                className="ml-1 cursor-pointer text-warning text-xl leading-none"
                title="Unstar"
              >
                &#9733;
              </span>
            </button>
          ))}
          {filtered.starred.length > 0 && filtered.unstarred.length > 0 && (
            <div className="border-t border-base-300" />
          )}
          {filtered.unstarred.map((group, idx) => {
            const globalIdx = filtered.starred.length + idx;
            return (
              <button
                key={group}
                type="button"
                onClick={() => handleSelect(group)}
                className={`group flex w-full items-center px-2 py-1 text-left text-xs transition-colors ${
                  globalIdx === highlightIndex
                    ? "bg-primary/20 text-primary"
                    : "text-base-content hover:bg-base-200"
                }`}
              >
                <span className="flex-1 truncate">{group}</span>
                <span
                  onClick={(e) => { e.stopPropagation(); toggleStar(group); }}
                  className="ml-1 cursor-pointer text-base-content/0 group-hover:text-base-content/30 text-xl leading-none"
                  title="Star"
                >
                  &#9734;
                </span>
              </button>
            );
          })}
        </div>
      )}

      {isOpen && !isLoading && allFiltered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm text-base-content/40 shadow-xl">
          {allGroups.length === 0
            ? "No log groups found for this profile/region"
            : `No log groups matching "${inputValue}"`}
        </div>
      )}
    </div>
  );
}
