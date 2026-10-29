import type { Lang, NameEntry } from "../types/common";
import type { EffectEntry } from "../types/pokeapi-raw";

/** L'autre langue supportée, utilisée comme fallback. */
export function otherLang(lang: Lang): Lang {
  return lang === "fr" ? "en" : "fr";
}

/** Nettoie les textes PokeAPI (sauts de page, retours à la ligne, espaces multiples). */
export function normalizeText(s: unknown): string {
  return String(s ?? "")
    .replace(/\f/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function pickNameByLang(names: NameEntry[] | undefined, lang: Lang): string | null {
  const arr = Array.isArray(names) ? names : [];
  const found = arr.find((n) => n?.language?.name === lang);
  return typeof found?.name === "string" ? found.name : null;
}

/** Effet court/long bruts (non normalisés) pour la langue. */
export function pickEffectByLang(
  raw: { effect_entries?: EffectEntry[] } | null | undefined,
  lang: Lang
): { short: string | null; long: string | null } {
  const entries = Array.isArray(raw?.effect_entries) ? raw.effect_entries : [];
  const item = entries.find((e) => e?.language?.name === lang);
  return {
    short: item?.short_effect ?? null,
    long: item?.effect ?? null,
  };
}

type LocalizedNames = Partial<Record<Lang, { name?: string | null } | undefined>>;

/** Nom d'affichage { en, fr } ; chaque langue absente retombe sur `fallback`. */
export function bilingualName(
  localized: LocalizedNames | null | undefined,
  fallback: string
): Record<Lang, string> {
  return {
    en: localized?.en?.name ?? fallback,
    fr: localized?.fr?.name ?? fallback,
  };
}
