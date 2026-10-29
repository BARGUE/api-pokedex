import { db } from "../db";

// `data_version` change dès qu'une autre connexion (ex. scripts/seed.ts) commit dans la DB.
const dataVersion = db.prepare("PRAGMA data_version").pluck();

/**
 * Mémorise `compute(key)` en mémoire. Le cache est vidé automatiquement
 * quand la DB est modifiée par une autre connexion, donc pas besoin de redémarrer après un seed.
 */
export function cached<K extends string, T>(compute: (key: K) => T): (key: K) => T {
  const store = new Map<K, T>();
  let version: unknown;

  return (key) => {
    const current = dataVersion.get();
    if (current !== version) {
      store.clear();
      version = current;
    }
    if (!store.has(key)) store.set(key, compute(key));
    return store.get(key) as T;
  };
}
