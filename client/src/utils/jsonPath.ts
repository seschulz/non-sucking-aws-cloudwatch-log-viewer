function tokenizePath(path: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  const segmentPattern = /([^[.\]]+)|\[(\d+)\]/g;

  for (const match of path.matchAll(segmentPattern)) {
    if (match[1] !== undefined) {
      tokens.push(match[1]);
      continue;
    }

    if (match[2] !== undefined) {
      tokens.push(Number(match[2]));
    }
  }

  return tokens;
}

export function getByPath(obj: any, path: string): any {
  if (obj == null || typeof obj !== "object") return undefined;
  const keys = tokenizePath(path);
  let current: any = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[key];
  }
  return current;
}
