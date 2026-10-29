import { db } from "../db";
import type { TypeStored } from "../services/types";
import type { ItemStored } from "../services/items";
import type { BerryStored } from "../services/berries";

export type TypeRow = { id: number; name: string; type: TypeStored | null };

type TypeDbRow = { id: number; name: string; name_en: string | null; name_fr: string | null };
type EfficacyRow = { attacking: number; defending: number; damage_factor: number };

type ItemDbRow = {
  id: number;
  name: string;
  category: string | null;
  cost: number | null;
  sprite: string | null;
  name_en: string | null;
  name_fr: string | null;
  effect_short_en: string | null;
  effect_long_en: string | null;
  effect_short_fr: string | null;
  effect_long_fr: string | null;
  flavor_en: string | null;
  flavor_fr: string | null;
};

type BerryDbRow = {
  id: number;
  name: string;
  item_name: string | null;
  item_sprite: string | null;
  firmness: string | null;
  growth_time: number | null;
  max_harvest: number | null;
  natural_gift_power: number | null;
  size: number | null;
  smoothness: number | null;
  soil_dryness: number | null;
};

const stmt = {
  typeById: db.prepare("SELECT id, name, name_en, name_fr FROM types WHERE id = ?"),
  typeByName: db.prepare("SELECT id, name, name_en, name_fr FROM types WHERE name = ?"),
  types: db.prepare("SELECT id, name, name_en, name_fr FROM types ORDER BY name"),
  typeNames: db.prepare("SELECT id, name FROM types"),
  // Trié par id de type : c'est l'ordre des listes damage_relations de la PokeAPI.
  efficacy: db.prepare(`
    SELECT e.attacking_type_id AS attacking, e.defending_type_id AS defending, e.damage_factor
    FROM type_efficacy e
    ORDER BY e.attacking_type_id, e.defending_type_id
  `),
  items: db.prepare(`
    SELECT id, name, category, cost, sprite, name_en, name_fr,
           effect_short_en, effect_long_en, effect_short_fr, effect_long_fr, flavor_en, flavor_fr
    FROM items ORDER BY id
  `),
  itemAttributes: db.prepare("SELECT item_id, attribute FROM item_attributes ORDER BY item_id, position"),
  berries: db.prepare(`
    SELECT b.id, b.name, i.name AS item_name, i.sprite AS item_sprite,
           b.firmness, b.growth_time, b.max_harvest, b.natural_gift_power,
           b.size, b.smoothness, b.soil_dryness
    FROM berries b
    LEFT JOIN items i ON i.id = b.item_id
    ORDER BY b.id
  `),
  berryFlavors: db.prepare("SELECT berry_id, flavor, potency FROM berry_flavors ORDER BY berry_id, position"),
};

function groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const r of rows) {
    const list = map.get(key(r));
    if (list) list.push(r);
    else map.set(key(r), [r]);
  }
  return map;
}

/** Reconstruit les damage_relations de chaque type à partir de la table d'efficacité. */
function buildTypes(rows: TypeDbRow[]): TypeStored[] {
  const nameById = new Map(
    (stmt.typeNames.all() as { id: number; name: string }[]).map((t) => [t.id, t.name])
  );
  const efficacy = stmt.efficacy.all() as EfficacyRow[];
  const bucket = (factor: number) => (factor === 200 ? "double" : factor === 50 ? "half" : "none");

  return rows.map((t) => {
    const relations: TypeStored["damageRelations"] = {
      from: { double: [], half: [], none: [] },
      to: { double: [], half: [], none: [] },
    };
    for (const e of efficacy) {
      if (e.attacking === t.id) relations.to[bucket(e.damage_factor)].push(nameById.get(e.defending) ?? "");
    }
    // `from` : trié par id du type attaquant (efficacy est déjà trié ainsi).
    for (const e of efficacy) {
      if (e.defending === t.id) relations.from[bucket(e.damage_factor)].push(nameById.get(e.attacking) ?? "");
    }
    return {
      key: t.name,
      damageRelations: relations,
      localized: { en: { name: t.name_en }, fr: { name: t.name_fr } },
    };
  });
}

/** Recherche par id numérique ou par nom (déjà normalisé). */
export function findType(idOrName: string): TypeRow | undefined {
  const asNumber = Number(idOrName);
  const row = (
    Number.isNaN(asNumber) ? stmt.typeByName.get(idOrName) : stmt.typeById.get(asNumber)
  ) as TypeDbRow | undefined;
  return row && { id: row.id, name: row.name, type: buildTypes([row])[0] };
}

export function listTypes(): Array<{ name: string; type: TypeStored | null }> {
  const rows = stmt.types.all() as TypeDbRow[];
  const types = buildTypes(rows);
  return rows.map((r, i) => ({ name: r.name, type: types[i] }));
}

export function listItems(): ItemStored[] {
  const attributes = groupBy(
    stmt.itemAttributes.all() as { item_id: number; attribute: string }[],
    (a) => a.item_id
  );
  // Ordre des clés identique à l'ancien format stocké (la réponse /items le renvoie tel quel).
  return (stmt.items.all() as ItemDbRow[]).map((i) => ({
    categoryKey: i.category,
    cost: i.cost,
    attributes: (attributes.get(i.id) ?? []).map((a) => a.attribute),
    assets: { sprite: i.sprite },
    localized: {
      en: {
        name: i.name_en,
        effect: { short: i.effect_short_en, long: i.effect_long_en },
        flavor: i.flavor_en,
      },
      fr: {
        name: i.name_fr,
        effect: { short: i.effect_short_fr, long: i.effect_long_fr },
        flavor: i.flavor_fr,
      },
    },
    id: i.id,
    key: i.name,
  }));
}

export function listBerries(): BerryStored[] {
  const flavors = groupBy(
    stmt.berryFlavors.all() as { berry_id: number; flavor: string; potency: number }[],
    (f) => f.berry_id
  );
  return (stmt.berries.all() as BerryDbRow[]).map((b) => ({
    id: b.id,
    key: b.name,
    // La PokeAPI ne fournit pas de nom traduit pour les baies.
    name: b.name,
    itemKey: b.item_name ?? "",
    agriculture: {
      firmness: b.firmness,
      growthTime: b.growth_time,
      maxHarvest: b.max_harvest,
      soilDryness: b.soil_dryness,
      size: b.size,
      smoothness: b.smoothness,
    },
    battle: { naturalGiftPower: b.natural_gift_power },
    flavors: (flavors.get(b.id) ?? []).map((f) => ({ key: f.flavor, potency: f.potency })),
    assets: { sprite: b.item_sprite },
  }));
}
