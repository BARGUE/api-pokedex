import type { Lang, LangEntry } from "../types";
import type { SpeciesFlavorEntry, SpeciesRaw } from "../types/pokeapi-raw";
import type { SpeciesFieldsLang } from "../types/lang-views";
import { normalizeText, otherLang } from "../lib/localize";

export type { Lang };

export type SpeciesTranslation = {
  name: string | null;
  genus: string | null;
  flavor: string | null;
};

/** Un type Pokémon avec clé API et noms localisés. */
export type TypeWithName = {
  key: string;
  name: { en: string; fr: string };
};

export type SpeciesFields = {
  key: string;
  classification: {
    generationKey: string | null;
    habitatKey: string | null;
    shapeKey: string | null;
  };
  types: TypeWithName[];
  flags: {
    isLegendary: boolean;
    isMythical: boolean;
  };
  localized: {
    en: SpeciesTranslation;
    fr: SpeciesTranslation;
  };
};

function pickByLang<T>(
  arr: LangEntry<T>[] | undefined,
  lang: Lang
): LangEntry<T> | null {
  if (!arr?.length) return null;
  return arr.find((x) => x?.language?.name === lang) ?? null;
}

function pickFlavorByLang(species: SpeciesRaw | null | undefined, lang: Lang): string | null {
  const entries = species?.flavor_text_entries as SpeciesFlavorEntry[] | undefined;
  if (!entries?.length) return null;
  const preferred = pickByLang<{ flavor_text: string }>(
    entries as LangEntry<{ flavor_text: string }>[],
    lang
  )?.flavor_text ?? null;
  if (preferred?.trim()) return normalizeText(preferred);
  const fallbackLang = otherLang(lang);
  const fallback =
    pickByLang<{ flavor_text: string }>(
      entries as LangEntry<{ flavor_text: string }>[],
      fallbackLang
    )?.flavor_text ?? null;
  return fallback?.trim() ? normalizeText(fallback) : null;
}

function pickTranslation(species: SpeciesRaw | null | undefined, lang: Lang): SpeciesTranslation {
  const nameEn = pickByLang<{ name: string }>(species?.names, "en")?.name ?? null;
  const nameFr = pickByLang<{ name: string }>(species?.names, "fr")?.name ?? null;
  const genusEn = pickByLang<{ genus: string }>(species?.genera, "en")?.genus ?? null;
  const genusFr = pickByLang<{ genus: string }>(species?.genera, "fr")?.genus ?? null;
  const name = lang === "fr" ? (nameFr ?? nameEn) : (nameEn ?? nameFr);
  const genus = lang === "fr" ? (genusFr ?? genusEn) : (genusEn ?? genusFr);
  const flavor = pickFlavorByLang(species, lang);
  return { name, genus, flavor };
}

/**
 * Construit les champs species.
 * @param species - Données brutes PokeAPI species
 * @param key - Identifiant du Pokémon (ex. "bulbasaur")
 * @param typesWithNames - Types du Pokémon avec clé et noms en/fr
 */
export function pickSpeciesFields(
  species: SpeciesRaw | null | undefined,
  key: string,
  typesWithNames: TypeWithName[] = []
): SpeciesFields {
  return {
    key: String(key ?? ""),
    classification: {
      generationKey: species?.generation?.name ?? null,
      habitatKey: species?.habitat?.name ?? null,
      shapeKey: species?.shape?.name ?? null,
    },
    types: Array.isArray(typesWithNames) ? [...typesWithNames] : [],
    flags: {
      isLegendary: Boolean(species?.is_legendary),
      isMythical: Boolean(species?.is_mythical),
    },
    localized: {
      en: pickTranslation(species, "en"),
      fr: pickTranslation(species, "fr"),
    },
  };
}

/** Retourne la structure species pour une seule langue (en ou fr). */
export function toSpeciesFieldsLang(
  species: SpeciesFields | null | undefined,
  lang: Lang
): SpeciesFieldsLang | null {
  if (!species) return null;
  const loc = species.localized[lang];
  return {
    name: loc?.name ?? null,
    genus: loc?.genus ?? null,
    flavor: loc?.flavor ?? null,
    habitat: species.classification.habitatKey,
    shape: species.classification.shapeKey,
    isLegendary: species.flags.isLegendary,
    isMythical: species.flags.isMythical,
    generation: species.classification.generationKey,
    types: species.types.map((t) => (lang === "fr" ? t.name.fr : t.name.en)).filter(Boolean),
  };
}
