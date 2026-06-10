import express from "express";
import cors from "cors";
import { db, type PokemonDb } from "./db";
import { SpeciesFields, toSpeciesFieldsLang } from "./services/species";
import { EvolutionItem } from "./services/evolution";
import { PokemonStatItem } from "./services/stats";
import { AbilityStored, toAbilityStoredLang } from "./services/abilities";
import { PokemonMove, toPokemonMoveLang } from "./services/moves";
import { EncountersGrouped } from "./services/encounters";
import { ItemStored, toItemStoredLang } from "./services/items";
import { BerryStored, toBerryStoredLang } from "./services/berries";
import { TypeStored, toTypeStoredLang } from "./services/types";
import type { MoveLangResolvers } from "./services/moves";
import type { SupportedLang } from "./types/lang-views";

type PokemonListRow = {
  name: string;
  id: number;
  height: number | null;
  weight: number | null;
  sprite_official: string | null;
  sprite_shiny: string | null;
  species_json: string | null; // joint depuis pokemon_species
};

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT ?? 4000);

/** Extrait la langue depuis query (?lang=en | ?lang=fr). Retourne undefined si invalide ou absent. */
function getLangFromQuery(req: express.Request): SupportedLang | undefined {
  const lang = (req.query.lang as string)?.toLowerCase();
  if (lang === "en" || lang === "fr") return lang;
  return undefined;
}

function safeJsonParseTypedArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function safeJsonParseObject<T = unknown>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

type TypeDbRow = { id: number; name: string; type_json: string | null };

function getTypeFromDb(idOrName: string): TypeDbRow | undefined {
  const asNumber = Number(idOrName);
  if (!Number.isNaN(asNumber)) {
    return db.prepare("SELECT id, name, type_json FROM types WHERE id = ?").get(asNumber) as TypeDbRow | undefined;
  }
  return db.prepare("SELECT id, name, type_json FROM types WHERE name = ?").get(idOrName.toLowerCase()) as TypeDbRow | undefined;
}

function getTypesListFromDb(): { name: string; type_json: string | null }[] {
  return db
    .prepare("SELECT name, type_json FROM types ORDER BY name")
    .all() as { name: string; type_json: string | null }[];
}

/** Tous les types avec type_json pour résoudre les noms par langue. */
function getAllTypesFromDb(): { name: string; type_json: string | null }[] {
  return db.prepare("SELECT name, type_json FROM types").all() as { name: string; type_json: string | null }[];
}

/** Construit une fonction qui renvoie le nom d'un type dans la langue demandée (api name -> display name). */
function buildTypeNameResolver(lang: SupportedLang): (apiName: string) => string {
  const rows = getAllTypesFromDb();
  const map = new Map<string, string>();
  for (const r of rows) {
    const typeStored = safeJsonParseObject<TypeStored>(r.type_json);
    if (typeStored?.localized) {
      const display =
        typeStored.localized[lang]?.name ??
        typeStored.localized[lang === "fr" ? "en" : "fr"]?.name ??
        r.name;
      map.set(r.name.toLowerCase(), display);
    }
  }
  return (apiName: string) => map.get(apiName.toLowerCase()) ?? apiName;
}

/** Noms des catégories de dégâts des moves (PokeAPI: physical, special, status). */
const DAMAGE_CLASS_NAMES: Record<string, { en: string; fr: string }> = {
  physical: { en: "Physical", fr: "Physique" },
  special: { en: "Special", fr: "Spécial" },
  status: { en: "Status", fr: "Statut" },
};

function buildDamageClassNameResolver(lang: SupportedLang): (apiName: string) => string {
  return (apiName: string) => {
    const key = apiName.toLowerCase();
    const entry = DAMAGE_CLASS_NAMES[key];
    if (entry) return entry[lang];
    return apiName;
  };
}

type BerryRow = { id: number; name: string; berry_json: string };

function getBerriesFromDb(): BerryRow[] {
  return db.prepare(`SELECT id, name, berry_json FROM berries ORDER BY id`).all() as BerryRow[];
}

function getPokemonListFromDb(): PokemonListRow[] {
  return db
    .prepare(
      `
      SELECT 
        p.name, 
        p.id, 
        p.height,
        p.weight,
        p.sprite_official, 
        p.sprite_shiny, 
        ps.species_json
      FROM pokemon p
      LEFT JOIN pokemon_species ps ON ps.pokemon_name = p.name
      ORDER BY p.id
    `
    )
    .all() as PokemonListRow[];
}

function getPokemonSpeciesJson(pokemonName: string): string | null {
  const row = db
    .prepare("SELECT species_json FROM pokemon_species WHERE pokemon_name = ?")
    .get(pokemonName) as { species_json: string } | undefined;
  return row?.species_json ?? null;
}

function getPokemonEvolutionJson(pokemonName: string): string | null {
  const row = db
    .prepare("SELECT evolution_json FROM pokemon_evolution WHERE pokemon_name = ?")
    .get(pokemonName) as { evolution_json: string } | undefined;
  return row?.evolution_json ?? null;
}

function getPokemonStatsJson(pokemonName: string): string | null {
  const row = db
    .prepare("SELECT stats_json FROM pokemon_stats WHERE pokemon_name = ?")
    .get(pokemonName) as { stats_json: string } | undefined;
  return row?.stats_json ?? null;
}

function getPokemonFromDb(idOrName: string): PokemonDb | undefined {
  const asNumber = Number(idOrName);
  if (!Number.isNaN(asNumber)) {
    return db.prepare("SELECT * FROM pokemon WHERE id = ?").get(asNumber) as PokemonDb | undefined;
  }
  return db.prepare("SELECT * FROM pokemon WHERE name = ?").get(idOrName.toLowerCase()) as PokemonDb | undefined;
}

app.get("/pokemon/:query", (req, res) => {
  try {
    const query = req.params.query.trim().toLowerCase();
    const cached = getPokemonFromDb(query);
    const lang = getLangFromQuery(req);

    if (!cached) return res.status(404).json({ error: "Pokemon not found" });

    const speciesJson = getPokemonSpeciesJson(cached.name);
    const speciesStored = safeJsonParseObject<SpeciesFields>(speciesJson);

    if (lang) {
      const species = toSpeciesFieldsLang(speciesStored, lang);
      const displayName = species?.name ?? cached.name;
      return res.json({
        pokemon: {
          id: cached.id,
          name: cached.name,
          display_name: displayName,
          height: cached.height ?? null,
          weight: cached.weight ?? null,
          images: {
            official: cached.sprite_official ?? null,
            shiny: cached.sprite_shiny ?? null,
          },
          species,
        },
        lang,
      });
    }

    return res.json({
      pokemon: {
        id: cached.id,
        name: cached.name,
        display_name: {
          en: speciesStored?.localized?.en?.name ?? cached.name,
          fr: speciesStored?.localized?.fr?.name ?? cached.name,
        },
        height: cached.height ?? null,
        weight: cached.weight ?? null,
        images: {
          official: cached.sprite_official ?? null,
          shiny: cached.sprite_shiny ?? null,
        },
        species: speciesStored,
      },
    });
  } catch (err: unknown) {
    console.error("GET /pokemon/:query failed:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

app.get("/pokemon/:query/evolution", (req, res) => {
  try {
    const query = req.params.query.trim().toLowerCase();
    const cached = getPokemonFromDb(query);

    if (!cached) return res.status(404).json({ error: "Pokemon not found" });

    const evolutionJson = getPokemonEvolutionJson(cached.name);
    const evolutionRaw = safeJsonParseTypedArray<EvolutionItem>(evolutionJson);

    const evolution = evolutionRaw.map((item) => {
      const speciesJson = getPokemonSpeciesJson(item.name);
      const species = safeJsonParseObject<SpeciesFields>(speciesJson);
      return {
        ...item,
        display_name: {
          en: species?.localized?.en?.name ?? item.name,
          fr: species?.localized?.fr?.name ?? item.name,
        },
      };
    });

    return res.json({
      evolution: { id: cached.id, name: cached.name, evolution },
    });
  } catch (err: unknown) {
    console.error("GET /pokemon/:query/evolution failed:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

app.get("/pokemon/:query/stats", (req, res) => {
  try {
    const query = req.params.query.trim().toLowerCase();
    const cached = getPokemonFromDb(query);

    if (!cached) return res.status(404).json({ error: "Pokemon not found" });

    const statsJson = getPokemonStatsJson(cached.name);
    const stats = safeJsonParseTypedArray<PokemonStatItem>(statsJson);

    return res.json({
      stats: { id: cached.id, name: cached.name, stats },
    });
  } catch (err: unknown) {
    console.error("GET /pokemon/:query/stats failed:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

app.get("/pokemon/:query/abilities", (req, res) => {
  try {
    const query = req.params.query.trim().toLowerCase();
    const cached = getPokemonFromDb(query);
    const lang = getLangFromQuery(req);

    if (!cached) return res.status(404).json({ error: "Pokemon not found" });

    const rows = db
      .prepare(
        `SELECT a.ability_json, pa.is_hidden
         FROM pokemon_abilities pa
         JOIN abilities a ON a.name = pa.ability_name
         WHERE pa.pokemon_name = ?
         ORDER BY pa.ability_name`
      )
      .all(cached.name) as { ability_json: string; is_hidden: number }[];

    const abilitiesStored: AbilityStored[] = rows.map((r) => {
      const a = safeJsonParseObject<AbilityStored>(r.ability_json);
      if (!a) return null;
      return { ...a, isHidden: r.is_hidden !== 0 };
    }).filter((x): x is AbilityStored => x !== null);

    if (lang) {
      const abilities = abilitiesStored
        .map((a) => toAbilityStoredLang(a, lang))
        .filter((x): x is NonNullable<typeof x> => x !== null);
      return res.json({
        abilities: { id: cached.id, name: cached.name, abilities },
        lang,
      });
    }

    return res.json({
      abilities: { id: cached.id, name: cached.name, abilities: abilitiesStored },
    });
  } catch (err: unknown) {
    console.error("GET /pokemon/:query/abilities failed:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

app.get("/pokemon/:query/moves", (req, res) => {
  try {
    const query = req.params.query.trim().toLowerCase();
    const cached = getPokemonFromDb(query);
    const lang = getLangFromQuery(req);

    if (!cached) return res.status(404).json({ error: "Pokemon not found" });

    const rows = db
      .prepare(
        `SELECT m.move_json
         FROM pokemon_moves pm
         JOIN moves m ON m.name = pm.move_name
         WHERE pm.pokemon_name = ?
         ORDER BY pm.move_name`
      )
      .all(cached.name) as { move_json: string }[];

    const movesStored: PokemonMove[] = rows
      .map((r) => safeJsonParseObject<PokemonMove>(r.move_json))
      .filter((x): x is PokemonMove => x !== null);

    if (lang) {
      const resolvers: MoveLangResolvers = {
        typeName: buildTypeNameResolver(lang),
        damageClassName: buildDamageClassNameResolver(lang),
      };
      const moves = movesStored
        .map((m) => toPokemonMoveLang(m, lang, resolvers))
        .filter((x): x is NonNullable<typeof x> => x !== null);
      return res.json({
        moves: { id: cached.id, name: cached.name, moves },
        lang,
      });
    }

    return res.json({
      moves: { id: cached.id, name: cached.name, moves: movesStored },
    });
  } catch (err: unknown) {
    console.error("GET /pokemon/:query/moves failed:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

app.get("/pokemon/:query/encounters", (req, res) => {
  try {
    const query = req.params.query.trim().toLowerCase();

    const cached = getPokemonFromDb(query);
    if (!cached) return res.status(404).json({ error: "Pokemon not found" });

    const row = db
      .prepare(
        `SELECT encounters_json FROM pokemon_encounters WHERE pokemon_name = ?`
      )
      .get(cached.name) as { encounters_json: string } | undefined;

    const encounters: EncountersGrouped = row
      ? safeJsonParseObject<EncountersGrouped>(row.encounters_json) ?? { encountersByVersion: [] }
      : { encountersByVersion: [] };

    return res.json({
      encounters: { id: cached.id, name: cached.name, encounters },
    });
  } catch (e: unknown) {
    console.error("GET /pokemon/:query/encounters failed:", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }
});

app.get("/type/:query", (req, res) => {
  try {
    const query = req.params.query.trim().toLowerCase();
    const cached = getTypeFromDb(query);
    const lang = getLangFromQuery(req);

    if (!cached) return res.status(404).json({ error: "Type not found" });

    const typeStored = safeJsonParseObject<TypeStored>(cached.type_json);

    if (lang && typeStored) {
      const resolveTypeName = buildTypeNameResolver(lang);
      const type = toTypeStoredLang(typeStored, lang, resolveTypeName);
      if (type) {
        return res.json({
          id: cached.id,
          name: cached.name,
          type,
          lang,
        });
      }
    }

    return res.json({
      id: cached.id,
      name: cached.name,
      type: typeStored,
    });
  } catch (e: unknown) {
    console.error("GET /type/:query failed:", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }
});

app.get("/items", (req, res) => {
  try {
    const lang = getLangFromQuery(req);
    const rows = db
      .prepare(`SELECT item_json FROM items ORDER BY id`)
      .all() as { item_json: string }[];

    const resultsStored = rows
      .map((r) => safeJsonParseObject<ItemStored>(r.item_json))
      .filter((x): x is ItemStored => x !== null);

    if (lang) {
      const items = resultsStored
        .map((item) => toItemStoredLang(item, lang))
        .filter((x): x is NonNullable<typeof x> => x !== null);
      return res.json({ items, lang });
    }

    return res.json({ items: resultsStored });
  } catch (e: unknown) {
    console.error("GET /items failed:", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }
});

app.get("/berries", (req, res) => {
  try {
    const lang = getLangFromQuery(req);
    const rows = getBerriesFromDb();
    const resultsStored = rows
      .map((r) => safeJsonParseObject<BerryStored>(r.berry_json))
      .filter((x): x is BerryStored => x !== null);

    if (lang) {
      const berries = resultsStored
        .map((b) => toBerryStoredLang(b, lang))
        .filter((x): x is NonNullable<typeof x> => x !== null);
      return res.json({
        count: berries.length,
        berries,
        lang,
      });
    }

    return res.json({
      count: resultsStored.length,
      berries: resultsStored,
    });
  } catch (e: unknown) {
    console.error("GET /berries failed:", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }
});

app.get("/types", (_req, res) => {
  try {
    const rows = getTypesListFromDb();
    const types = rows.map((r) => {
      const stored = safeJsonParseObject<TypeStored>(r.type_json);
      const en = stored?.localized?.en?.name ?? stored?.localized?.fr?.name ?? r.name;
      const fr = stored?.localized?.fr?.name ?? stored?.localized?.en?.name ?? r.name;
      return {
        key: r.name,
        name: { en: String(en), fr: String(fr) },
      };
    });
    res.json({ types });
  } catch (e: unknown) {
    console.error("GET /types failed:", e);
    res.status(500).json({
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }
});

app.get("/pokemon", (req, res) => {
  try {
    const lang = getLangFromQuery(req);
    const rows = getPokemonListFromDb();

    const resultsStored = rows.map((p) => ({
      id: p.id,
      name: p.name,
      height: p.height ?? null,
      weight: p.weight ?? null,
      images: {
        official: p.sprite_official ?? null,
        shiny: p.sprite_shiny ?? null,
      },
      species: safeJsonParseObject<SpeciesFields>(p.species_json),
    }));

    if (lang) {
      const results = resultsStored.map((p) => {
        const speciesLang = toSpeciesFieldsLang(p.species, lang);
        const display_name = speciesLang?.name ?? p.name;
        return {
          ...p,
          display_name,
          species: speciesLang,
        };
      });
      return res.json({ results, lang });
    }

    const resultsWithDisplayNames = resultsStored.map((p) => ({
      ...p,
      display_name: {
        en: p.species?.localized?.en?.name ?? p.name,
        fr: p.species?.localized?.fr?.name ?? p.name,
      },
    }));
    return res.json({ pokemon_list: resultsWithDisplayNames });
  } catch (e: unknown) {
    console.error("GET /pokemon failed:", e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
