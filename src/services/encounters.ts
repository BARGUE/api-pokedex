import { fetchJson } from "../pokeapi";

export type EncounterApi = {
  location_area: { name: string; url: string };
  version_details: Array<{
    version: { name: string; url: string };
    max_chance: number;
    encounter_details: Array<{
      min_level: number;
      max_level: number;
      chance: number;
      method?: { name: string; url: string };
      condition_values?: Array<{ name: string; url: string }>;
    }>;
  }>;
};

/** Une rencontre pour une zone et version : zone, chance max, plages de niveaux. */
export type EncounterEntry = {
  locationAreaKey: string;
  chance: number;
  levelRanges: Array<{ min: number; max: number }>;
};

/** Groupe par version : clé de version + liste de rencontres. */
export type EncountersByVersionItem = {
  versionKey: string;
  encountersByVersion: EncounterEntry[];
};

/** Résultat regroupé : liste de groupes par version. */
export type EncountersGrouped = {
  encountersByVersion: EncountersByVersionItem[];
};

export function groupEncounters(encounters: EncounterApi[]): EncountersGrouped {
  const byVersion: Record<string, EncounterEntry[]> = {};

  for (const encounter of encounters) {
    const locationAreaKey = encounter.location_area?.name ?? "";

    for (const versionDetail of encounter.version_details ?? []) {
      const versionKey = versionDetail.version?.name;
      if (!versionKey) continue;

      if (!byVersion[versionKey]) {
        byVersion[versionKey] = [];
      }

      const detailsArr = versionDetail.encounter_details ?? [];

      const levelRanges = (() => {
        const seen = new Set<string>();
        const out: Array<{ min: number; max: number }> = [];
        for (const d of detailsArr) {
          const min = d.min_level ?? 0;
          const max = d.max_level ?? 0;
          const k = `${min}-${max}`;
          if (seen.has(k)) continue;
          seen.add(k);
          out.push({ min, max });
        }
        out.sort((a, b) => a.min - b.min || a.max - b.max);
        return out;
      })();

      const chance =
        detailsArr.length > 0 ? Math.max(...detailsArr.map((d) => d.chance ?? 0)) : 0;

      byVersion[versionKey].push({
        locationAreaKey,
        chance,
        levelRanges,
      });
    }
  }

  const encountersByVersion: EncountersByVersionItem[] = [];

  for (const [versionKey, entries] of Object.entries(byVersion)) {
    const byArea = new Map<string, EncounterEntry>();

    for (const e of entries) {
      const existing = byArea.get(e.locationAreaKey);
      if (!existing) {
        byArea.set(e.locationAreaKey, { ...e });
        continue;
      }
      const mergedRanges = [...existing.levelRanges];
      for (const r of e.levelRanges) {
        if (!mergedRanges.some((x) => x.min === r.min && x.max === r.max)) {
          mergedRanges.push(r);
        }
      }
      mergedRanges.sort((a, b) => a.min - b.min || a.max - b.max);
      byArea.set(e.locationAreaKey, {
        locationAreaKey: e.locationAreaKey,
        chance: Math.max(existing.chance, e.chance),
        levelRanges: mergedRanges,
      });
    }

    const list = [...byArea.values()].sort(
      (a, b) => b.chance - a.chance || a.locationAreaKey.localeCompare(b.locationAreaKey)
    );
    encountersByVersion.push({ versionKey, encountersByVersion: list });
  }

  encountersByVersion.sort((a, b) => a.versionKey.localeCompare(b.versionKey));

  return { encountersByVersion };
}

/**
 * Récupère les rencontres depuis l’URL PokeAPI (ex: .../pokemon/1/encounters)
 * et les retourne regroupées par version.
 */
export async function fetchEncountersFromUrl(url: string): Promise<EncountersGrouped> {
  return groupEncounters(await fetchJson<EncounterApi[]>(url, "encounters"));
}
