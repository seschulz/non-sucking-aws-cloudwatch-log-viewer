import { useState, useEffect, useRef } from "react";
import { useLogStore, type TimeRange } from "../stores/logStore";

interface SavedFilter {
  name: string;
  profile: string | null;
  region: string | null;
  selectedLogGroups: string[];
  selectedStreams: string[];
  filterPattern: string;
  timeRange: TimeRange;
  pinnedColumns: string[];
}

const STORAGE_KEY = "aws-logs:saved-filters";

function loadFilters(): SavedFilter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveFilters(filters: SavedFilter[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // ignore
  }
}

export default function SavedFilters() {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<SavedFilter[]>(loadFilters);
  const [isNaming, setIsNaming] = useState(false);
  const [newName, setNewName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const profile = useLogStore((s) => s.profile);
  const region = useLogStore((s) => s.region);
  const selectedLogGroups = useLogStore((s) => s.selectedLogGroups);
  const filterPattern = useLogStore((s) => s.filterPattern);
  const timeRange = useLogStore((s) => s.timeRange);
  const pinnedColumns = useLogStore((s) => s.pinnedColumns);
  const selectedStreams = useLogStore((s) => s.selectedStreams);

  const setProfile = useLogStore((s) => s.setProfile);
  const setRegion = useLogStore((s) => s.setRegion);
  const addLogGroup = useLogStore((s) => s.addLogGroup);
  const setFilterPattern = useLogStore((s) => s.setFilterPattern);
  const setTimeRange = useLogStore((s) => s.setTimeRange);
  const addColumn = useLogStore((s) => s.addColumn);
  const addStream = useLogStore((s) => s.addStream);
  const fetchRegions = useLogStore((s) => s.fetchRegions);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsNaming(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSave = () => {
    if (!newName.trim()) return;
    const newFilter: SavedFilter = {
      name: newName.trim(),
      profile,
      region,
      selectedLogGroups,
      selectedStreams,
      filterPattern,
      timeRange,
      pinnedColumns,
    };
    const updated = [...filters, newFilter];
    setFilters(updated);
    saveFilters(updated);
    setNewName("");
    setIsNaming(false);
  };

  const handleUpdate = (idx: number) => {
    const updated = [...filters];
    updated[idx] = {
      ...updated[idx],
      profile,
      region,
      selectedLogGroups,
      selectedStreams,
      filterPattern,
      timeRange,
      pinnedColumns,
    };
    setFilters(updated);
    saveFilters(updated);
  };

  const handleDelete = (idx: number) => {
    const updated = filters.filter((_, i) => i !== idx);
    setFilters(updated);
    saveFilters(updated);
  };

  const handleApply = (filter: SavedFilter) => {
    if (filter.profile) {
      setProfile(filter.profile);
      fetchRegions(filter.profile);
    }
    // Delay setting region/groups to allow regions to load
    setTimeout(() => {
      if (filter.region) setRegion(filter.region);
      setTimeout(() => {
        filter.selectedLogGroups.forEach((g) => addLogGroup(g));
        (filter.selectedStreams ?? []).forEach((s) => addStream(s));
        setFilterPattern(filter.filterPattern);
        setTimeRange(filter.timeRange);
        filter.pinnedColumns.forEach((c) => addColumn(c));
      }, 50);
    }, 50);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-ghost btn-sm"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        Saved
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 w-72 rounded-lg border border-base-300 bg-base-100 shadow-xl">
          <div className="border-b border-base-300 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-base-content/40">
              Saved Filters
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {filters.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-base-content/40">
                No saved filters yet
              </div>
            )}

            {filters.map((filter, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between border-b border-base-300/50 px-3 py-2 hover:bg-base-200"
              >
                <button
                  type="button"
                  onClick={() => handleApply(filter)}
                  className="flex-1 text-left cursor-pointer"
                  title="Click to load this filter"
                >
                  <div className="text-sm font-medium text-base-content">
                    {filter.name}
                  </div>
                  <div className="text-[10px] text-base-content/50">
                    {filter.profile ?? "—"} / {filter.selectedLogGroups.length} group(s)
                    {filter.filterPattern && ` / "${filter.filterPattern.slice(0, 20)}..."`}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdate(idx)}
                  className="btn btn-ghost btn-xs text-info"
                  aria-label={`Update ${filter.name}`}
                  title="Update with current settings"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7l-4-4z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3v5h8V3M7 21v-7h10v7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(idx)}
                  className="btn btn-ghost btn-xs text-error"
                  aria-label={`Delete ${filter.name}`}
                  title="Delete this filter"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-base-300 px-3 py-2">
            {isNaming ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                    if (e.key === "Escape") setIsNaming(false);
                  }}
                  placeholder="Filter name..."
                  autoFocus
                  className="input input-bordered input-xs flex-1"
                />
                <button
                  type="button"
                  onClick={handleSave}
                  className="btn btn-primary btn-xs"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsNaming(true)}
                className="btn btn-ghost btn-sm btn-block text-primary"
              >
                + Save Current Filter
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
