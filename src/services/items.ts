import type { NameEntry } from "../types";
import type { EffectEntry, FlavorTextEntry, ItemRaw } from "../types/pokeapi-raw";
import type { ItemStoredLang } from "../types/lang-views";
import type { Lang } from "../types";

/** Bloc localisé pour une langue (en ou fr). */
export type ItemLocalized = {
  name: string | null;
  effect: { short: string | null; long: string | null };
  flavor: string | null;
};

export type ItemStored = {
  id: number;
  key: string;
  categoryKey: string | null;
  cost: number | null;
  attributes: string[];
  assets: {
    sprite: string | null;
  };
  localized: {
    en: ItemLocalized;
    fr: ItemLocalized;
  };
};

function normalizeText(s: unknown): string {
  return String(s ?? "")
    .replace(/\f/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickNameByLang(names: NameEntry[] | undefined, lang: "en" | "fr"): string | null {
  const arr = Array.isArray(names) ? names : [];
  const found = arr.find((n) => n?.language?.name === lang);
  return (found as { name?: string } | undefined)?.name ?? null;
}

function pickEffectByLang(raw: ItemRaw | null | undefined, lang: "en" | "fr") {
  const entries: EffectEntry[] = Array.isArray(raw?.effect_entries) ? raw.effect_entries : [];
  const item = entries.find((e) => e?.language?.name === lang);
  return {
    short: (item?.short_effect ?? null) as string | null,
    long: (item?.effect ?? null) as string | null,
  };
}

function pickFirstFlavorByLang(raw: ItemRaw | null | undefined, lang: "en" | "fr"): string | null {
  const entries: FlavorTextEntry[] = Array.isArray(raw?.flavor_text_entries)
    ? raw.flavor_text_entries
    : [];
  for (const e of entries) {
    if (e?.language?.name !== lang) continue;
    const text = normalizeText(e?.text ?? (e as { flavor_text?: string }).flavor_text);
    if (!text) continue;
    return text;
  }
  return null;
}

export function pickItemDetails(raw: ItemRaw | null | undefined): Omit<ItemStored, "id" | "key"> {
  const cost = typeof raw?.cost === "number" ? raw.cost : null;
  const categoryKey = raw?.category?.name ? String(raw.category.name) : null;
  const attributes = Array.isArray(raw?.attributes)
    ? raw.attributes.map((a) => a?.name).filter(Boolean).map(String)
    : [];
  const sprite = raw?.sprites?.default ? String(raw.sprites.default) : null;

  return {
    categoryKey,
    cost,
    attributes,
    assets: { sprite },
    localized: {
      en: {
        name: pickNameByLang(raw?.names, "en"),
        effect: pickEffectByLang(raw, "en"),
        flavor: pickFirstFlavorByLang(raw, "en"),
      },
      fr: {
        name: pickNameByLang(raw?.names, "fr"),
        effect: pickEffectByLang(raw, "fr"),
        flavor: pickFirstFlavorByLang(raw, "fr"),
      },
    },
  };
}

/** Retourne la structure item pour une seule langue (en ou fr), avec fallback vers l'autre langue si besoin. */
export function toItemStoredLang(
  item: ItemStored | null | undefined,
  lang: Lang
): ItemStoredLang | null {
  if (!item) return null;
  const loc = item.localized[lang];
  const fallback = item.localized[lang === "fr" ? "en" : "fr"];
  const displayName = loc?.name ?? fallback?.name ?? item.key;
  return {
    id: item.id,
    name: displayName,
    cost: item.cost,
    category: item.categoryKey,
    attributes: item.attributes,
    sprites: { default: item.assets.sprite },
    effect_short: loc?.effect?.short ?? fallback?.effect?.short ?? null,
    effect_long: loc?.effect?.long ?? fallback?.effect?.long ?? null,
    flavor_text: loc?.flavor ?? fallback?.flavor ?? null,
  };
}
