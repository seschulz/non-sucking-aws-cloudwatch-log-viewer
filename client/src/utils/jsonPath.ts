export function getByPath(obj: any, path: string): any {
  if (obj == null || typeof obj !== "object") return undefined;
  const keys = path.split(".");
  let current: any = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[key];
  }
  return current;
}
