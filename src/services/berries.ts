import type { BerryRaw, BerryFlavorRaw, ItemRaw } from "../types/pokeapi-raw";
import type { BerryStoredLang } from "../types/lang-views";
import type { Lang } from "../types";

export type BerryStored = {
  id: number;
  key: string;
  /** Nom d’affichage (une seule valeur, pas de localisation). */
  name: string;
  itemKey: string;

  agriculture: {
    firmness: string | null;
    growthTime: number | null;
    maxHarvest: number | null;
    soilDryness: number | null;
    size: number | null;
    smoothness: number | null;
  };

  battle: {
    naturalGiftPower: number | null;
  };

  flavors: Array<{ key: string; potency: number }>;

  assets: {
    sprite: string | null;
  };
};

function pickDisplayName(raw: ItemRaw | BerryRaw | null | undefined, keyFallback: string): string {
  const names = Array.isArray(raw?.names) ? raw.names : [];
  const en = names.find((n) => n?.language?.name === "en") as { name?: string } | undefined;
  const fr = names.find((n) => n?.language?.name === "fr") as { name?: string } | undefined;
  return (en?.name ?? fr?.name ?? keyFallback) || keyFallback;
}

function numOrNull(n: unknown): number | null {
  return n != null && Number.isFinite(Number(n)) ? Number(n) : null;
}

export function pickBerryDetails(
  berryRaw: BerryRaw | null | undefined,
  itemRaw?: ItemRaw | null
): BerryStored {
  const flavors: BerryFlavorRaw[] = Array.isArray(berryRaw?.flavors) ? berryRaw.flavors : [];
  const key = String(berryRaw?.name ?? "");
  const itemName = itemRaw?.name ? String(itemRaw.name) : "";
  const sprite = itemRaw?.sprites?.default ?? null;

  return {
    id: Number(berryRaw?.id) || 0,
    key,
    name: pickDisplayName(berryRaw, key),
    itemKey: itemName,

    agriculture: {
      firmness: berryRaw?.firmness?.name ? String(berryRaw.firmness.name) : null,
      growthTime: numOrNull(berryRaw?.growth_time),
      maxHarvest: numOrNull(berryRaw?.max_harvest),
      soilDryness: numOrNull(berryRaw?.soil_dryness),
      size: numOrNull(berryRaw?.size),
      smoothness: numOrNull(berryRaw?.smoothness),
    },

    battle: {
      naturalGiftPower: numOrNull(berryRaw?.natural_gift_power),
    },

    flavors: flavors
      .filter(
        (f): f is BerryFlavorRaw & { flavor: { name: string }; potency: number } =>
          Boolean(f?.flavor?.name && Number.isFinite(f?.potency))
      )
      .map((f) => ({
        key: String(f.flavor.name),
        potency: Number(f.potency),
      })),

    assets: {
      sprite: sprite ?? null,
    },
  };
}

/** Retourne la structure berry pour une seule langue (en ou fr). */
export function toBerryStoredLang(
  berry: BerryStored | null | undefined,
  _lang: Lang
): BerryStoredLang | null {
  if (!berry) return null;
  const ag = berry.agriculture;
  return {
    id: berry.id,
    name: berry.name,
    growth_time: ag.growthTime,
    max_harvest: ag.maxHarvest,
    natural_gift_power: berry.battle.naturalGiftPower,
    size: ag.size,
    smoothness: ag.smoothness,
    soil_dryness: ag.soilDryness,
    firmness: ag.firmness,
    flavors: berry.flavors.map((f) => ({ flavor: f.key, potency: f.potency })),
    item: berry.itemKey
      ? {
          name: berry.itemKey,
          sprites: { default: berry.assets.sprite },
          name_display: berry.name,
        }
      : null,
  };
}
