import type { FlavorTextWithVersion, AbilityRaw } from "../types/pokeapi-raw";
import type { AbilityStoredLang } from "../types/lang-views";
import type { Lang } from "../types";
import { normalizeText, otherLang, pickEffectByLang, pickNameByLang } from "../lib/localize";

/** Bloc localisé pour une langue (en ou fr). */
export type AbilityLocalized = {
  name: string | null;
  effect: { long: string | null; short: string | null };
};

export type AbilityStored = {
  key: string;
  isHidden: boolean;
  /** Premier flavor text par langue. */
  flavorText: { en: string | null; fr: string | null };
  localized: {
    en: AbilityLocalized;
    fr: AbilityLocalized;
  };
};

/** Retourne le premier flavor text pour la langue, ou null. */
function pickFirstFlavorTextByLang(raw: AbilityRaw | null | undefined, lang: "en" | "fr"): string | null {
  const entries: FlavorTextWithVersion[] = Array.isArray(raw?.flavor_text_entries)
    ? raw.flavor_text_entries
    : [];
  const first = entries.find((e) => e?.language?.name === lang && e?.version_group?.name);
  return first ? normalizeText(first.flavor_text) : null;
}

/** Construit l’objet `localized` (en + fr) à partir de la réponse PokeAPI. */
export function pickAbilityDetails(
  raw: AbilityRaw | null | undefined
): Pick<AbilityStored, "localized" | "flavorText"> {
  return {
    flavorText: {
      en: pickFirstFlavorTextByLang(raw, "en"),
      fr: pickFirstFlavorTextByLang(raw, "fr"),
    },
    localized: {
      en: {
        name: pickNameByLang(raw?.names, "en"),
        effect: pickEffectByLang(raw, "en"),
      },
      fr: {
        name: pickNameByLang(raw?.names, "fr"),
        effect: pickEffectByLang(raw, "fr"),
      },
    },
  };
}

/** Retourne la structure ability pour une seule langue (en ou fr). */
export function toAbilityStoredLang(
  ability: AbilityStored | null | undefined,
  lang: Lang
): AbilityStoredLang | null {
  if (!ability) return null;
  const loc = ability.localized[lang];
  const fallback = ability.localized[otherLang(lang)];
  const displayName = loc?.name ?? fallback?.name ?? ability.key;
  const flavorText =
    ability.flavorText[lang] ?? ability.flavorText[otherLang(lang)] ?? null;

  return {
    name: displayName,
    is_hidden: ability.isHidden,
    effect_short: loc?.effect?.short ?? fallback?.effect?.short ?? null,
    effect_long: loc?.effect?.long ?? fallback?.effect?.long ?? null,
    flavor_text: flavorText,
  };
}
