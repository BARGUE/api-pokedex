import { db, type PokemonDb } from "../db";
import { normalizeText } from "../lib/localize";
import type { SpeciesFields, TypeWithName } from "../services/species";
import { buildImagesFromId, type EvolutionItem } from "../services/evolution";
import type { PokemonStatItem } from "../services/stats";
import type { AbilityStored } from "../services/abilities";
import type { PokemonMove } from "../services/moves";
import { groupEncounters, type EncounterApi, type EncountersGrouped } from "../services/encounters";

/*
 * Lecture du schéma relationnel (voir schema.sql) et reconstruction des structures
 * `*Stored` servies par l'API. Les valeurs par défaut (0, "", repli sur l'autre langue)
 * sont appliquées ici : la base, elle, garde NULL quand la PokeAPI n'a pas de valeur.
 */

export type PokemonListRow = Omit<PokemonDb, "updated_at"> & {
  species: SpeciesFields | null;
};

type SpeciesRow = {
  pokemon_id: number;
  pokemon_name: string;
  generation: string | null;
  habitat: string | null;
  shape: string | null;
  is_legendary: number;
  is_mythical: number;
  name_en: string | null;
  name_fr: string | null;
  genus_en: string | null;
  genus_fr: string | null;
  flavor_en: string | null;
  flavor_fr: string | null;
};

type TypeNameRow = { pokemon_id: number; name: string; name_en: string | null; name_fr: string | null };

type AbilityRow = {
  name: string;
  is_hidden: number;
  name_en: string | null;
  name_fr: string | null;
  effect_short_en: string | null;
  effect_long_en: string | null;
  effect_short_fr: string | null;
  effect_long_fr: string | null;
  flavor_en: string | null;
  flavor_fr: string | null;
};

type MoveRow = Omit<AbilityRow, "is_hidden"> & {
  type_name: string | null;
  damage_class: string | null;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  priority: number | null;
  versions: string | null;
};

type EncounterRow = {
  location_area: string;
  version: string;
  min_level: number;
  max_level: number;
  chance: number;
};

const POKEMON_COLUMNS = "p.name, p.id, p.height, p.weight, p.sprite_official, p.sprite_shiny";

const SPECIES_SELECT = `
  SELECT p.id AS pokemon_id, p.name AS pokemon_name,
         s.generation, s.habitat, s.shape, s.is_legendary, s.is_mythical,
         s.name_en, s.name_fr, s.genus_en, s.genus_fr, s.flavor_en, s.flavor_fr
  FROM pokemon p
  JOIN species s ON s.id = p.species_id
`;

const TYPES_SELECT = `
  SELECT pt.pokemon_id, t.name, t.name_en, t.name_fr
  FROM pokemon_types pt
  JOIN types t ON t.id = pt.type_id
`;

// Requêtes préparées une seule fois (et non à chaque requête HTTP).
const stmt = {
  byId: db.prepare(`SELECT ${POKEMON_COLUMNS}, p.updated_at FROM pokemon p WHERE p.id = ?`),
  byName: db.prepare(`SELECT ${POKEMON_COLUMNS}, p.updated_at FROM pokemon p WHERE p.name = ?`),
  list: db.prepare(`SELECT ${POKEMON_COLUMNS} FROM pokemon p ORDER BY p.id`),
  allSpecies: db.prepare(SPECIES_SELECT),
  allTypes: db.prepare(`${TYPES_SELECT} ORDER BY pt.pokemon_id, pt.slot`),
  species: db.prepare(`${SPECIES_SELECT} WHERE p.name = ?`),
  types: db.prepare(`${TYPES_SELECT} WHERE pt.pokemon_id = ? ORDER BY pt.slot`),
  evolutionChain: db.prepare(`
    SELECT s.evolution_chain_id FROM pokemon p JOIN species s ON s.id = p.species_id WHERE p.name = ?
  `).pluck(),
  evolutionMembers: db.prepare(`
    SELECT id, name FROM species WHERE evolution_chain_id = ? ORDER BY evolution_order, id
  `),
  stats: db.prepare(`
    SELECT s.stat AS name, s.base_stat
    FROM pokemon_stats s JOIN pokemon p ON p.id = s.pokemon_id
    WHERE p.name = ?
    ORDER BY s.position
  `),
  encounters: db.prepare(`
    SELECT la.name AS location_area, v.name AS version, e.min_level, e.max_level, e.chance
    FROM pokemon_encounters e
    JOIN pokemon p ON p.id = e.pokemon_id
    JOIN location_areas la ON la.id = e.location_area_id
    JOIN versions v ON v.id = e.version_id
    WHERE p.name = ?
  `),
  abilities: db.prepare(`
    SELECT a.name, pa.is_hidden, a.name_en, a.name_fr,
           a.effect_short_en, a.effect_long_en, a.effect_short_fr, a.effect_long_fr,
           a.flavor_en, a.flavor_fr
    FROM pokemon_abilities pa
    JOIN pokemon p ON p.id = pa.pokemon_id
    JOIN abilities a ON a.id = pa.ability_id
    WHERE p.name = ?
    ORDER BY a.name
  `),
  moves: db.prepare(`
    SELECT m.name, t.name AS type_name, m.damage_class, m.power, m.accuracy, m.pp, m.priority,
           m.name_en, m.name_fr,
           m.effect_short_en, m.effect_long_en, m.effect_short_fr, m.effect_long_fr,
           m.flavor_en, m.flavor_fr,
           (SELECT group_concat(vg.name, ',')
              FROM move_version_groups mvg
              JOIN version_groups vg ON vg.id = mvg.version_group_id
             WHERE mvg.move_id = m.id) AS versions
    FROM moves m
    LEFT JOIN types t ON t.id = m.type_id
    WHERE m.id IN (
      SELECT pm.move_id FROM pokemon_moves pm JOIN pokemon p ON p.id = pm.pokemon_id WHERE p.name = ?
    )
    ORDER BY m.name
  `),
};

function toTypeWithName(t: TypeNameRow): TypeWithName {
  return { key: t.name, name: { en: t.name_en ?? t.name, fr: t.name_fr ?? t.name } };
}

function toSpeciesFields(s: SpeciesRow, types: TypeNameRow[]): SpeciesFields {
  return {
    key: s.pokemon_name,
    classification: {
      generationKey: s.generation,
      habitatKey: s.habitat,
      shapeKey: s.shape,
    },
    types: types.map(toTypeWithName),
    flags: {
      isLegendary: s.is_legendary !== 0,
      isMythical: s.is_mythical !== 0,
    },
    localized: {
      en: {
        name: s.name_en ?? s.name_fr,
        genus: s.genus_en ?? s.genus_fr,
        flavor: s.flavor_en ?? s.flavor_fr,
      },
      fr: {
        name: s.name_fr ?? s.name_en,
        genus: s.genus_fr ?? s.genus_en,
        flavor: s.flavor_fr ?? s.flavor_en,
      },
    },
  };
}

/** Recherche par id numérique ou par nom (déjà normalisé). */
export function findPokemon(idOrName: string): PokemonDb | undefined {
  const asNumber = Number(idOrName);
  const row = Number.isNaN(asNumber) ? stmt.byName.get(idOrName) : stmt.byId.get(asNumber);
  return row as PokemonDb | undefined;
}

export function listPokemon(): PokemonListRow[] {
  const typesByPokemon = new Map<number, TypeNameRow[]>();
  for (const t of stmt.allTypes.all() as TypeNameRow[]) {
    const list = typesByPokemon.get(t.pokemon_id);
    if (list) list.push(t);
    else typesByPokemon.set(t.pokemon_id, [t]);
  }
  const speciesByPokemon = new Map<number, SpeciesFields>();
  for (const s of stmt.allSpecies.all() as SpeciesRow[]) {
    speciesByPokemon.set(s.pokemon_id, toSpeciesFields(s, typesByPokemon.get(s.pokemon_id) ?? []));
  }

  const rows = stmt.list.all() as Omit<PokemonDb, "updated_at">[];
  return rows.map((p) => ({ ...p, species: speciesByPokemon.get(p.id) ?? null }));
}

export function getSpecies(pokemonName: string): SpeciesFields | null {
  const s = stmt.species.get(pokemonName) as SpeciesRow | undefined;
  return s ? toSpeciesFields(s, stmt.types.all(s.pokemon_id) as TypeNameRow[]) : null;
}

export function getEvolution(pokemonName: string): EvolutionItem[] {
  const chainId = stmt.evolutionChain.get(pokemonName) as number | null | undefined;
  if (chainId == null) return [];

  const members = stmt.evolutionMembers.all(chainId) as { id: number; name: string }[];
  // Espèce sans évolution : la chaîne ne contient que le Pokémon lui-même.
  const pokemon = stmt.byName.get(pokemonName) as PokemonDb | undefined;
  if (members.length === 1 && (members[0].id === pokemon?.id || members[0].name === pokemonName)) {
    return [];
  }
  return members.map((m) => ({ id: m.id, name: m.name, images: buildImagesFromId(m.id) }));
}

export function getStats(pokemonName: string): PokemonStatItem[] {
  return stmt.stats.all(pokemonName) as PokemonStatItem[];
}

export function getEncounters(pokemonName: string): EncountersGrouped {
  // Regroupe les lignes par (zone, version) pour réutiliser le regroupement de services/encounters.
  const byAreaVersion = new Map<string, EncounterApi>();
  for (const e of stmt.encounters.all(pokemonName) as EncounterRow[]) {
    const key = `${e.location_area}|${e.version}`;
    let group = byAreaVersion.get(key);
    if (!group) {
      group = {
        location_area: { name: e.location_area, url: "" },
        version_details: [{ version: { name: e.version, url: "" }, max_chance: 0, encounter_details: [] }],
      };
      byAreaVersion.set(key, group);
    }
    group.version_details[0].encounter_details.push({
      min_level: e.min_level,
      max_level: e.max_level,
      chance: e.chance,
    });
  }
  return groupEncounters([...byAreaVersion.values()]);
}

export function getAbilities(pokemonName: string): AbilityStored[] {
  const rows = stmt.abilities.all(pokemonName) as AbilityRow[];
  return rows.map((a) => ({
    key: a.name,
    isHidden: a.is_hidden !== 0,
    flavorText: { en: a.flavor_en, fr: a.flavor_fr },
    localized: {
      en: { name: a.name_en, effect: { short: a.effect_short_en, long: a.effect_long_en } },
      fr: { name: a.name_fr, effect: { short: a.effect_short_fr, long: a.effect_long_fr } },
    },
  }));
}

/** Les effets des attaques sont servis normalisés, "" si absents. */
const moveEffect = (short: string | null, long: string | null) => ({
  short: short != null ? normalizeText(short) : "",
  long: long != null ? normalizeText(long) : "",
});

export function getMoves(pokemonName: string): PokemonMove[] {
  const rows = stmt.moves.all(pokemonName) as MoveRow[];
  return rows.map((m) => ({
    key: m.name,
    stats: {
      type: m.type_name ?? "unknown",
      damageClass: m.damage_class ?? "unknown",
      power: m.power ?? 0,
      accuracy: m.accuracy ?? 0,
      pp: m.pp ?? 0,
      priority: m.priority ?? 0,
    },
    availability: {
      versions: m.versions ? m.versions.split(",").sort() : [],
    },
    flavorText: { en: m.flavor_en, fr: m.flavor_fr },
    localized: {
      en: {
        name: m.name_en ?? m.name,
        effect: moveEffect(m.effect_short_en, m.effect_long_en),
      },
      fr: {
        name: m.name_fr ?? m.name_en ?? m.name,
        effect: moveEffect(m.effect_short_fr, m.effect_long_fr),
      },
    },
  }));
}
