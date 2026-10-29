/** Parse un JSON stocké en DB ; null si absent ou invalide. */
export function parseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/** Parse un tableau JSON stocké en DB ; [] si absent, invalide ou pas un tableau. */
export function parseJsonArray<T>(value: string | null | undefined): T[] {
  const parsed = parseJson<unknown>(value);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

export function nonNull<T>(x: T | null): x is T {
  return x !== null;
}

/** Parse une liste de JSON et ignore les entrées invalides. */
export function parseJsonList<T>(values: Array<string | null | undefined>): T[] {
  return values.map((v) => parseJson<T>(v)).filter(nonNull);
}
