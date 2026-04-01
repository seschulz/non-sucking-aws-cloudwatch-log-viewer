import { create } from "zustand";
import { useToastStore } from "./toastStore";

export interface LogEvent {
  timestamp: number;
  message: string;
  logStreamName: string;
  logGroupName: string;
  eventId: string;
}

export interface HistogramBucket {
  start: number;
  end: number;
  counts: {
    ERROR: number;
    WARN: number;
    INFO: number;
    DEBUG: number;
    OTHER: number;
  };
}

export interface Anomaly {
  title: string;
  severity: "critical" | "warning" | "info";
  description: string;
  eventIds: string[];
  recommendation: string;
}

export interface AnalysisResult {
  summary: string;
  anomalies: Anomaly[];
}

export type TimeRange =
  | { type: "relative"; value: string }
  | { type: "absolute"; start: number; end: number };

export interface LogState {
  profile: string | null;
  region: string | null;
  profiles: string[];
  profileRegions: Record<string, string>;
  regions: string[];
  selectedLogGroups: string[];
  selectedStreams: string[];
  filterPattern: string;
  timeRange: TimeRange;
  logEvents: LogEvent[];
  isLoading: boolean;
  nextToken: string | null;

  isTailing: boolean;
  pinnedColumns: string[];
  theme: "dark" | "light";
  histogramData: HistogramBucket[] | null;
  histogramError: string | null;
  isHistogramLoading: boolean;
  preZoomTimeRange: TimeRange | null;
  queryTime: number | null;
  analysisResult: AnalysisResult | null;
  selectedAnomalyIndex: number | null;
  isAnalyzing: boolean;
  analysisPreset: string;
  customAnalysisPrompt: string;

  hasSearched: boolean;

  searchHistory: string[];
  addSearchHistory: (pattern: string) => void;
  clearSearchHistory: () => void;

  analyzeLogs: () => Promise<void>;
  clearAnalysis: () => void;
  setAnalysisPreset: (preset: string) => void;
  setCustomAnalysisPrompt: (prompt: string) => void;
  setSelectedAnomalyIndex: (index: number | null) => void;

  ssoSessions: { name: string; ssoStartUrl: string; ssoRegion: string }[];
  profileSessionMap: Record<string, string>;
  activeSsoSessions: string[];
  ssoLoginInProgress: boolean;
  fetchSsoSessions: () => Promise<void>;

  setProfile: (p: string) => void;
  setRegion: (r: string) => void;
  addLogGroup: (g: string) => void;
  removeLogGroup: (g: string) => void;
  addStream: (s: string) => void;
  removeStream: (s: string) => void;
  setFilterPattern: (f: string) => void;
  setTimeRange: (t: TimeRange) => void;
  fetchLogs: () => Promise<void>;
  loadMore: () => Promise<void>;
  setIsTailing: (v: boolean) => void;
  addLogEvents: (events: LogEvent[]) => void;
  addColumn: (key: string) => void;
  removeColumn: (key: string) => void;
  addFilterFromValue: (key: string, value: string | number) => void;
  toggleTheme: () => void;
  fetchProfiles: () => Promise<void>;
  fetchRegions: (profile: string) => Promise<void>;
  fetchHistogram: (containerWidth?: number) => Promise<void>;
  zoomToRange: (start: number, end: number) => void;
  resetZoom: () => void;
}

function resolveRelativeTime(value: string): number {
  const match = value.match(/^(\d+)([mhdw])$/);
  if (!match) return Date.now() - 15 * 60 * 1000;
  const num = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };
  return Date.now() - num * (multipliers[unit] || 60 * 1000);
}

function buildQueryParams(state: LogState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.profile) params.set("profile", state.profile);
  if (state.region) params.set("region", state.region);
  if (state.selectedLogGroups.length) {
    params.set("logGroups", state.selectedLogGroups.join(","));
  }

  if (state.timeRange.type === "relative") {
    params.set("startTime", String(resolveRelativeTime(state.timeRange.value)));
    params.set("endTime", String(Date.now()));
  } else {
    params.set("startTime", String(state.timeRange.start));
    params.set("endTime", String(state.timeRange.end));
  }

  if (state.selectedStreams.length) {
    params.set("logStreams", state.selectedStreams.join(","));
  }
  if (state.filterPattern) {
    let pattern = state.filterPattern.trim();
    // Auto-wrap in { } if it looks like a JSON filter but isn't wrapped
    if (pattern.includes("$.") && !pattern.startsWith("{")) {
      pattern = `{ ${pattern} }`;
    }
    // Auto-quote simple text searches that aren't already quoted or JSON filters
    // CloudWatch FilterLogEvents requires quotes around terms with special chars
    if (!pattern.startsWith("{") && !pattern.startsWith('"') && !/^[a-zA-Z0-9_]+$/.test(pattern)) {
      pattern = `"${pattern}"`;
    }
    params.set("filterPattern", pattern);
  }
  return params;
}

function getInitialTheme(): "dark" | "light" {
  try {
    const stored = localStorage.getItem("aws-logs:theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // ignore
  }
  return "dark";
}

const SEARCH_HISTORY_KEY = "aws-logs:search-history";
const MAX_SEARCH_HISTORY = 20;

function getInitialSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.slice(0, MAX_SEARCH_HISTORY);
    }
  } catch {
    // ignore
  }
  return [];
}

export const useLogStore = create<LogState>((set, get) => ({
  profile: "default",
  region: "eu-central-1",
  profiles: [],
  profileRegions: {},
  regions: [],
  selectedLogGroups: [],
  selectedStreams: [],
  filterPattern: "",
  timeRange: { type: "relative", value: "15m" },
  logEvents: [],
  isLoading: false,
  nextToken: null,
  isTailing: false,
  pinnedColumns: [],
  theme: getInitialTheme(),
  histogramData: null,
  histogramError: null,
  isHistogramLoading: false,
  preZoomTimeRange: null,
  queryTime: null,
  analysisResult: null,
  selectedAnomalyIndex: null,
  isAnalyzing: false,
  analysisPreset: "general",
  customAnalysisPrompt: "",

  hasSearched: false,
  searchHistory: getInitialSearchHistory(),

  ssoSessions: [],
  profileSessionMap: {},
  activeSsoSessions: [],
  ssoLoginInProgress: false,

  fetchSsoSessions: async () => {
    try {
      const res = await fetch("/api/sso-sessions");
      if (!res.ok) return;
      const data = await res.json();
      set({
        ssoSessions: data.sessions ?? [],
        profileSessionMap: data.profileSessionMap ?? {},
        activeSsoSessions: data.activeSessions ?? [],
      });
    } catch {
      // SSO is optional — silently ignore errors
    }
  },

  setProfile: (p) => {
    const defaultRegion = get().profileRegions[p] || "eu-central-1";
    set({
      profile: p,
      region: defaultRegion,
      regions: [],
      selectedStreams: [],
      logEvents: [],
      nextToken: null,
      analysisResult: null,
      selectedAnomalyIndex: null,
      hasSearched: false,
    });
  },

  setRegion: (r) => {
    set({
      region: r,
      selectedStreams: [],
      logEvents: [],
      nextToken: null,
      analysisResult: null,
      selectedAnomalyIndex: null,
      hasSearched: false,
    });
  },

  addLogGroup: (g) => {
    const { selectedLogGroups } = get();
    if (!selectedLogGroups.includes(g)) {
      set({ selectedLogGroups: [...selectedLogGroups, g], selectedStreams: [] });
    }
  },

  removeLogGroup: (g) => {
    const { selectedLogGroups } = get();
    set({
      selectedLogGroups: selectedLogGroups.filter((x) => x !== g),
      selectedStreams: [],
    });
  },

  addStream: (s) => {
    const { selectedStreams } = get();
    if (!selectedStreams.includes(s)) {
      set({ selectedStreams: [...selectedStreams, s] });
    }
  },

  removeStream: (s) => {
    const { selectedStreams } = get();
    set({ selectedStreams: selectedStreams.filter((x) => x !== s) });
  },

  setFilterPattern: (f) => set({ filterPattern: f }),

  setTimeRange: (t) => set({ timeRange: t, preZoomTimeRange: null }),

  fetchLogs: async () => {
    const state = get();
    if (!state.profile || !state.region || !state.selectedLogGroups.length) {
      useToastStore.getState().addToast("Select a profile, region, and at least one log group.");
      return;
    }

    set({ isLoading: true, logEvents: [], nextToken: null, queryTime: null, analysisResult: null, selectedAnomalyIndex: null, hasSearched: true });
    if (state.filterPattern.trim()) {
      get().addSearchHistory(state.filterPattern.trim());
    }
    // Fetch histogram in parallel (fire-and-forget, has its own loading/error state)
    get().fetchHistogram();
    try {
      const startMs = performance.now();
      const params = buildQueryParams(state);
      const res = await fetch(`/api/logs?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const elapsed = (performance.now() - startMs) / 1000;
      const events = (data.events ?? []).sort(
        (a: LogEvent, b: LogEvent) => b.timestamp - a.timestamp,
      );
      set({
        logEvents: events,
        nextToken: data.nextToken ?? null,
        isLoading: false,
        queryTime: Math.round(elapsed * 10) / 10,
      });
    } catch (err: any) {
      useToastStore.getState().addToast(err.message);
      set({ isLoading: false });
    }
  },

  loadMore: async () => {
    const state = get();
    if (!state.nextToken || state.isLoading) return;

    set({ isLoading: true });
    try {
      const params = buildQueryParams(state);
      params.set("nextToken", state.nextToken!);
      const res = await fetch(`/api/logs?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const combined = [...state.logEvents, ...(data.events ?? [])];
      combined.sort((a, b) => b.timestamp - a.timestamp);
      set({
        logEvents: combined,
        nextToken: data.nextToken ?? null,
        isLoading: false,
      });
    } catch (err: any) {
      useToastStore.getState().addToast(err.message);
      set({ isLoading: false });
    }
  },

  setIsTailing: (v) => set({ isTailing: v }),

  addLogEvents: (events) => {
    const { logEvents } = get();
    // Deduplicate by eventId
    const existingIds = new Set(logEvents.map((e) => e.eventId));
    const newEvents = events.filter((e) => !existingIds.has(e.eventId));
    if (newEvents.length) {
      const combined = [...newEvents, ...logEvents];
      combined.sort((a, b) => b.timestamp - a.timestamp);
      set({ logEvents: combined });
    }
  },

  addColumn: (key) => {
    const { pinnedColumns } = get();
    if (!pinnedColumns.includes(key)) {
      set({ pinnedColumns: [...pinnedColumns, key] });
    }
  },

  removeColumn: (key) => {
    const { pinnedColumns } = get();
    set({ pinnedColumns: pinnedColumns.filter((c) => c !== key) });
  },

  addFilterFromValue: (key, value) => {
    const { filterPattern } = get();
    const valueStr =
      typeof value === "number" ? String(value) : `"${value}"`;
    const condition = `$.${key} = ${valueStr}`;

    // Strip existing { } wrapper if present, then append with &&
    const stripped = filterPattern.trim().replace(/^\{\s*(.*?)\s*\}$/, "$1").trim();
    if (stripped) {
      set({ filterPattern: `${stripped} && ${condition}` });
    } else {
      set({ filterPattern: condition });
    }
  },

  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("aws-logs:theme", next);
    } catch {
      // ignore
    }
    set({ theme: next });
  },

  fetchProfiles: async () => {
    try {
      const res = await fetch("/api/profiles");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      set({ profiles: data.profiles ?? [], profileRegions: data.profileRegions ?? {} });
    } catch (err: any) {
      useToastStore.getState().addToast(`Failed to fetch profiles: ${err.message}`);
    }
  },

  fetchRegions: async (profile: string) => {
    try {
      const res = await fetch(`/api/regions?profile=${encodeURIComponent(profile)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      set({ regions: data.regions ?? [] });
    } catch (err: any) {
      useToastStore.getState().addToast(`Failed to fetch regions: ${err.message}`);
    }
  },

  fetchHistogram: async (containerWidth = 600) => {
    const state = get();
    if (!state.profile || !state.region || !state.selectedLogGroups.length) return;

    const numBuckets = Math.max(10, Math.min(200, Math.round(containerWidth / 12)));
    set({ isHistogramLoading: true, histogramError: null });
    try {
      const params = buildQueryParams(state);
      params.set("buckets", String(numBuckets));
      const res = await fetch(`/api/histogram?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.error) {
        set({ histogramData: data.buckets.length ? data.buckets : null, histogramError: data.error, isHistogramLoading: false });
      } else {
        set({ histogramData: data.buckets, histogramError: null, isHistogramLoading: false });
      }
    } catch (err: any) {
      set({ histogramError: err.message, isHistogramLoading: false });
    }
  },

  zoomToRange: (start, end) => {
    const state = get();
    set({
      preZoomTimeRange: state.preZoomTimeRange ?? state.timeRange,
      timeRange: { type: "absolute", start, end },
    });
    // Re-fetch both (fetchLogs triggers fetchHistogram as side effect)
    get().fetchLogs();
  },

  resetZoom: () => {
    const { preZoomTimeRange } = get();
    if (!preZoomTimeRange) return;
    set({ timeRange: preZoomTimeRange, preZoomTimeRange: null });
    get().fetchLogs();
  },

  analyzeLogs: async () => {
    const state = get();
    if (!state.profile || !state.region || state.logEvents.length === 0 || state.isAnalyzing) return;

    set({ isAnalyzing: true, analysisResult: null, selectedAnomalyIndex: null });
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: state.profile,
          region: state.region,
          logs: state.logEvents,
          preset: state.analysisPreset,
          customPrompt: state.analysisPreset === "custom" ? state.customAnalysisPrompt : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      set({
        analysisResult: result,
        selectedAnomalyIndex: result.anomalies.length > 0 ? 0 : null,
        isAnalyzing: false,
      });
    } catch (err: any) {
      useToastStore.getState().addToast(err.message);
      set({ isAnalyzing: false });
    }
  },

  clearAnalysis: () => set({ analysisResult: null, selectedAnomalyIndex: null }),

  setAnalysisPreset: (preset) => set({ analysisPreset: preset }),

  setCustomAnalysisPrompt: (prompt) => set({ customAnalysisPrompt: prompt }),

  setSelectedAnomalyIndex: (index) => set({ selectedAnomalyIndex: index }),

  addSearchHistory: (pattern: string) => {
    const { searchHistory } = get();
    const filtered = searchHistory.filter((p) => p !== pattern);
    const updated = [pattern, ...filtered].slice(0, MAX_SEARCH_HISTORY);
    set({ searchHistory: updated });
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  },

  clearSearchHistory: () => {
    set({ searchHistory: [] });
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch {
      // ignore
    }
  },
}));
