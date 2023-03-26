export function recordToMap<T>(input: Record<string, T>) {
  const map = new Map<string, T>();

  for (const [key, value] of Object.entries(input)) {
    map.set(key, value);
  }

  return map;
}
