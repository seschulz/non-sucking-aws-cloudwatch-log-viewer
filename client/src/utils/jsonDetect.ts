export function tryParseJson(
  message: string,
): { json: any; preText: string } | null {
  const trimmed = message.trim();

  // Try parsing the whole message
  try {
    const json = JSON.parse(trimmed);
    if (typeof json === "object" && json !== null) {
      return { json, preText: "" };
    }
  } catch {
    // fall through
  }

  // Try finding first `{` and parsing from there
  const idx = trimmed.indexOf("{");
  if (idx > 0) {
    const candidate = trimmed.slice(idx);
    try {
      const json = JSON.parse(candidate);
      if (typeof json === "object" && json !== null) {
        return { json, preText: trimmed.slice(0, idx) };
      }
    } catch {
      // fall through
    }
  }

  return null;
}
