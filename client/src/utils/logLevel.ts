interface LogLevelInfo {
  level: string;
  badgeClass: string;
  borderClass: string;
  rowTintClass: string;
}

const LEVELS: Record<string, LogLevelInfo> = {
  ERROR: {
    level: "ERROR",
    badgeClass: "bg-error/15 text-error",
    borderClass: "border-error",
    rowTintClass: "bg-error/[0.04]",
  },
  FATAL: {
    level: "FATAL",
    badgeClass: "bg-error/15 text-error",
    borderClass: "border-error",
    rowTintClass: "bg-error/[0.04]",
  },
  WARN: {
    level: "WARN",
    badgeClass: "bg-warning/15 text-warning",
    borderClass: "border-warning",
    rowTintClass: "",
  },
  WARNING: {
    level: "WARN",
    badgeClass: "bg-warning/15 text-warning",
    borderClass: "border-warning",
    rowTintClass: "",
  },
  INFO: {
    level: "INFO",
    badgeClass: "bg-info/15 text-info",
    borderClass: "border-info",
    rowTintClass: "",
  },
  DEBUG: {
    level: "DEBUG",
    badgeClass: "bg-base-content/10 text-base-content/75",
    borderClass: "border-base-content/25",
    rowTintClass: "",
  },
  TRACE: {
    level: "TRACE",
    badgeClass: "bg-base-content/10 text-base-content/75",
    borderClass: "border-base-content/25",
    rowTintClass: "",
  },
};

const DEFAULT_LEVEL: LogLevelInfo = {
  level: "UNKNOWN",
  badgeClass: "bg-base-content/12 text-base-content/70",
  borderClass: "border-base-content/30",
  rowTintClass: "",
};

function findLevelInObject(obj: any): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;

  const level = obj.level ?? obj.severity ?? obj.Level ?? obj.Severity;
  if (typeof level === "string") return level;

  // Check nested JSON strings (e.g. a "log" field containing stringified JSON)
  for (const val of Object.values(obj)) {
    if (typeof val === "string" && val.startsWith("{")) {
      try {
        const nested = JSON.parse(val);
        const found = findLevelInObject(nested);
        if (found) return found;
      } catch {
        // not JSON, skip
      }
    }
  }

  return undefined;
}

export function detectLogLevel(
  message: string,
  parsedJson?: any,
): LogLevelInfo {
  // Check parsed JSON fields first (including nested JSON strings)
  if (parsedJson && typeof parsedJson === "object") {
    const jsonLevel = findLevelInObject(parsedJson);
    if (typeof jsonLevel === "string") {
      const upper = jsonLevel.toUpperCase();
      if (LEVELS[upper]) return LEVELS[upper];
    }
  }

  // Scan message text
  const upper = message.toUpperCase();
  for (const key of ["FATAL", "ERROR", "WARN", "WARNING", "INFO", "DEBUG", "TRACE"]) {
    if (upper.includes(key)) {
      return LEVELS[key];
    }
  }

  return DEFAULT_LEVEL;
}
