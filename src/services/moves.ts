import type { MoveRaw } from "../types/pokeapi-raw";
import type { PokemonMoveLang } from "../types/lang-views";
import type { Lang } from "../types";
import { normalizeText, otherLang, pickEffectByLang, pickNameByLang } from "../lib/localize";

/** Bloc localisé pour une langue (en ou fr). */
export type MoveLocalized = {
  name: string | null;
  effect: { short: string; long: string };
};

export type PokemonMove = {
  key: string;
  stats: {
    type: string;
    damageClass: string;
    power: number;
    accuracy: number;
    pp: number;
    priority: number;
  };
  availability: {
    versions: string[];
  };
  /** Premier flavor text par langue. */
  flavorText: { en: string | null; fr: string | null };
  localized: {
    en: MoveLocalized;
    fr: MoveLocalized;
  };
};

/** Les moves stockent des effets normalisés, "" si absents. */
function pickMoveEffectByLang(raw: MoveRaw | null | undefined, lang: Lang) {
  const { short, long } = pickEffectByLang(raw, lang);
  return {
    short: short != null ? normalizeText(short) : "",
    long: long != null ? normalizeText(long) : "",
  };
}

/** Retourne le premier flavor text pour la langue, ou null. */
function pickFirstFlavorTextByLang(
  raw: MoveRaw | null | undefined,
  lang: "en" | "fr"
): string | null {
  const entries = Array.isArray(raw?.flavor_text_entries) ? raw.flavor_text_entries : [];
  const first = entries.find((e) => e?.language?.name === lang);
  const flavorText = first && (first as { flavor_text?: string }).flavor_text;
  return typeof flavorText === "string" ? normalizeText(flavorText) : null;
}

function pickString(x: { name?: string } | null | undefined, fallback: string): string {
  return typeof x?.name === "string" ? x.name : fallback;
}

function pickNumber(x: number | null | undefined): number {
  return typeof x === "number" ? x : 0;
}

export function pickMoveDetails(
  raw: MoveRaw | null | undefined,
  version_groups: string[] = []
): Omit<PokemonMove, "key"> {
  const fallbackName = typeof raw?.name === "string" ? raw.name : "unknown";
  const enName = pickNameByLang(raw?.names, "en");
  const frName = pickNameByLang(raw?.names, "fr");

  return {
    stats: {
      type: pickString(raw?.type, "unknown"),
      damageClass: pickString(raw?.damage_class, "unknown"),
      power: pickNumber(raw?.power),
      accuracy: pickNumber(raw?.accuracy),
      pp: pickNumber(raw?.pp),
      priority: pickNumber(raw?.priority),
    },
    availability: {
      versions: Array.isArray(version_groups) ? [...version_groups].sort() : [],
    },
    flavorText: {
      en: pickFirstFlavorTextByLang(raw, "en"),
      fr: pickFirstFlavorTextByLang(raw, "fr"),
    },
    localized: {
      en: {
        name: enName ?? fallbackName,
        effect: pickMoveEffectByLang(raw, "en"),
      },
      fr: {
        name: frName ?? enName ?? fallbackName,
        effect: pickMoveEffectByLang(raw, "fr"),
      },
    },
  };
}

/** Noms des catégories de dégâts des moves (PokeAPI: physical, special, status). */
const DAMAGE_CLASS_NAMES: Record<string, Record<Lang, string>> = {
  physical: { en: "Physical", fr: "Physique" },
  special: { en: "Special", fr: "Spécial" },
  status: { en: "Status", fr: "Statut" },
};

export function getDamageClassName(apiName: string, lang: Lang): string {
  return DAMAGE_CLASS_NAMES[apiName.toLowerCase()]?.[lang] ?? apiName;
}

export type MoveLangResolvers = {
  typeName?: (apiName: string) => string;
  damageClassName?: (apiName: string) => string;
};

/** Retourne la structure move pour une seule langue (en ou fr), avec fallback et résolution type/damage_class. */
export function toPokemonMoveLang(
  move: PokemonMove | null | undefined,
  lang: Lang,
  resolvers?: MoveLangResolvers
): PokemonMoveLang | null {
  if (!move) return null;
  const loc = move.localized[lang];
  const fallback = move.localized[otherLang(lang)];
  const displayName = loc?.name ?? fallback?.name ?? move.key;
  const typeName =
    resolvers?.typeName?.(move.stats.type) ?? move.stats.type ?? "unknown";
  const damageClassName =
    resolvers?.damageClassName?.(move.stats.damageClass) ?? move.stats.damageClass ?? "unknown";

  const flavorText =
    move.flavorText[lang] ?? move.flavorText[otherLang(lang)] ?? null;

  return {
    name: displayName,
    type: { name: typeName },
    damage_class: { name: damageClassName },
    power: move.stats.power,
    accuracy: move.stats.accuracy,
    pp: move.stats.pp,
    priority: move.stats.priority,
    effect_short: loc?.effect?.short ?? fallback?.effect?.short ?? "",
    effect_long: loc?.effect?.long ?? fallback?.effect?.long ?? "",
    flavor_text: flavorText,
    version: move.availability.versions.length > 0 ? move.availability.versions : undefined,
  };
}
