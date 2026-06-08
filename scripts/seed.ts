import "dotenv/config";
import { db } from "../src/db";
import {
  fetchPokemonFromPokeApi,
  fetchPokemonSpeciesFromPokeApi,
  fetchAbilityFromPokeApi,
  fetchMoveFromPokeApi,
  AbilityRef,
  MoveRef,
  fetchTypeFromPokeApi,
  fetchItemFromPokeApi,
  fetchBerryFromPokeApi,
} from "../src/pokeapi";
import { pickSpeciesFields, type TypeWithName } from "../src/services/species";
import {
  fetchEvolutionChainFromUrl,
  extractEvolutionItems,
  EvolutionItem,
} from "../src/services/evolution";
import { pickAbilityDetails, AbilityStored } from "../src/services/abilities";
import { pickMoveDetails, PokemonMove } from "../src/services/moves";
import { pickTypeDetails, type TypeStored } from "../src/services/types";
import { ItemStored, pickItemDetails } from "../src/services/items";
import { BerryStored, pickBerryDetails } from "../src/services/berries";
import { fetchEncountersFromUrl } from "../src/services/encounters";
import type { ItemRaw } from "../src/types/pokeapi-raw";

/** Réponse liste PokeAPI (types, items, berries, pokemon) */
type PokeApiListResponse = {
  results?: { name: string; url: string }[];
  next?: string | null;
};

/* ------------------------------------------------------------------ */
/* LOGGING HELPERS */
/* ------------------------------------------------------------------ */

const SEP = "─".repeat(50);
function section(icon: string, title: string) {
  console.log(`\n${SEP}`);
  console.log(`  ${icon}  ${title}`);
  console.log(SEP);
}
function step(icon: string, msg: string, extra?: string) {
  const line = extra ? `  ${icon}  ${msg}  ${extra}` : `  ${icon}  ${msg}`;
  console.log(line);
}
function elapsed(ms: number) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

/* ------------------------------------------------------------------ */
/* UPSERTS (prepare once) */
/* ------------------------------------------------------------------ */

type UpsertPayload = {
  name: string;
  id: number;
  height: number | null;
  weight: number | null;
  sprite_official: string | null;
  sprite_shiny: string | null;
};

const upsertPokemonStmt = db.prepare(`
  INSERT INTO pokemon (
    name, id, height, weight,
    sprite_official, sprite_shiny,
    updated_at
  )
  VALUES (
    @name, @id, @height, @weight,
    @sprite_official, @sprite_shiny,
    @updated_at
  )
  ON CONFLICT(name) DO UPDATE SET
    id=excluded.id,
    height=excluded.height,
    weight=excluded.weight,
    sprite_official=excluded.sprite_official,
    sprite_shiny=excluded.sprite_shiny,
    updated_at=excluded.updated_at
`);

const upsertPokemonSpeciesStmt = db.prepare(`
  INSERT INTO pokemon_species (pokemon_name, species_json, updated_at)
  VALUES (@pokemon_name, @species_json, @updated_at)
  ON CONFLICT(pokemon_name) DO UPDATE SET
    species_json=excluded.species_json,
    updated_at=excluded.updated_at
`);

const upsertPokemonEvolutionStmt = db.prepare(`
  INSERT INTO pokemon_evolution (pokemon_name, evolution_json, updated_at)
  VALUES (@pokemon_name, @evolution_json, @updated_at)
  ON CONFLICT(pokemon_name) DO UPDATE SET
    evolution_json=excluded.evolution_json,
    updated_at=excluded.updated_at
`);

const upsertPokemonStatsStmt = db.prepare(`
  INSERT INTO pokemon_stats (pokemon_name, stats_json, updated_at)
  VALUES (@pokemon_name, @stats_json, @updated_at)
  ON CONFLICT(pokemon_name) DO UPDATE SET
    stats_json=excluded.stats_json,
    updated_at=excluded.updated_at
`);

function upsertPokemon(p: UpsertPayload) {
  upsertPokemonStmt.run({ ...p, updated_at: new Date().toISOString() });
}

const upsertAbilityStmt = db.prepare(`
  INSERT INTO abilities (name, ability_json, updated_at)
  VALUES (@name, @ability_json, @updated_at)
  ON CONFLICT(name) DO UPDATE SET
    ability_json=excluded.ability_json,
    updated_at=excluded.updated_at
`);

const deletePokemonAbilitiesStmt = db.prepare(
  `DELETE FROM pokemon_abilities WHERE pokemon_name = ?`
);

const insertPokemonAbilityStmt = db.prepare(`
  INSERT INTO pokemon_abilities (pokemon_name, ability_name, is_hidden)
  VALUES (@pokemon_name, @ability_name, @is_hidden)
`);

const getMoveStmt = db.prepare<[string]>(
  `SELECT move_json FROM moves WHERE name = ?`
);
const upsertMoveStmt = db.prepare(`
  INSERT INTO moves (name, move_json, updated_at)
  VALUES (@name, @move_json, @updated_at)
  ON CONFLICT(name) DO UPDATE SET
    move_json=excluded.move_json,
    updated_at=excluded.updated_at
`);

const deletePokemonMovesStmt = db.prepare(
  `DELETE FROM pokemon_moves WHERE pokemon_name = ?`
);

const insertPokemonMoveStmt = db.prepare(`
  INSERT INTO pokemon_moves (pokemon_name, move_name)
  VALUES (@pokemon_name, @move_name)
`);

const upsertPokemonEncountersStmt = db.prepare(`
  INSERT INTO pokemon_encounters (pokemon_name, encounters_json, updated_at)
  VALUES (@pokemon_name, @encounters_json, @updated_at)
  ON CONFLICT(pokemon_name) DO UPDATE SET
    encounters_json=excluded.encounters_json,
    updated_at=excluded.updated_at
`);

const upsertBerryStmt = db.prepare(`
  INSERT INTO berries (id, name, berry_json, updated_at)
  VALUES (@id, @name, @berry_json, @updated_at)
  ON CONFLICT(id) DO UPDATE SET
    name=excluded.name,
    berry_json=excluded.berry_json,
    updated_at=excluded.updated_at
`);

function upsertBerry(p: { id: number; name: string; berry_json: string }) {
  upsertBerryStmt.run({ ...p, updated_at: new Date().toISOString() });
}

const upsertTypeStmt = db.prepare(`
  INSERT INTO types (id, name, type_json, updated_at)
  VALUES (@id, @name, @type_json, @updated_at)
  ON CONFLICT(id) DO UPDATE SET
    name=excluded.name,
    type_json=excluded.type_json,
    updated_at=excluded.updated_at
`);

function upsertType(t: { id: number; name: string; type_json: string | null }) {
  upsertTypeStmt.run({ ...t, updated_at: new Date().toISOString() });
}

/* ------------------------------------------------------------------ */
/* TYPES SEED */
/* ------------------------------------------------------------------ */

const TYPES_BATCH = Number(process.env.SEED_TYPES_BATCH ?? 8);

async function seedTypes() {
  const start = Date.now();
  section("🔷", "TYPES");
  const r = await fetch("https://pokeapi.co/api/v2/type");
  if (!r.ok) throw new Error(`PokeAPI type list error: ${r.status} ${r.statusText}`);
  const data = (await r.json()) as PokeApiListResponse;
  const results = (data.results ?? []).filter((t) =>
    t.url.match(/\/type\/(\d+)\/?$/)
  );
  step("📋", `Liste récupérée: ${results.length} types`, `(batch=${TYPES_BATCH})`);

  let inserted = 0;

  for (let i = 0; i < results.length; i += TYPES_BATCH) {
    const chunk = results.slice(i, i + TYPES_BATCH);
    await Promise.all(
      chunk.map(async (t) => {
        const m = t.url.match(/\/type\/(\d+)\/?$/);
        const id = m ? Number(m[1]) : null;
        if (!id) return;
        try {
          const raw = await fetchTypeFromPokeApi(t.url);
          const picked = pickTypeDetails(raw);
          upsertType({
            id,
            name: t.name,
            type_json: JSON.stringify({ key: t.name, ...picked }),
          });
        } catch (e: unknown) {
          upsertType({
            id,
            name: t.name,
            type_json: JSON.stringify({
              key: t.name,
              damageRelations: {
                from: { double: [], half: [], none: [] },
                to: { double: [], half: [], none: [] },
              },
              localized: { en: { name: null }, fr: { name: null } },
            }),
          });
        }
        inserted++;
      })
    );
  }

  const ms = Date.now() - start;
  step("✅", `Types insérés: ${inserted}`, `(${elapsed(ms)})`);
}

/** Construit un tableau TypeWithName à partir des noms API des types (lit la table types). */
function resolveTypesWithNames(apiNames: string[]): TypeWithName[] {
  if (!apiNames?.length) return [];
  const rows = db
    .prepare("SELECT name, type_json FROM types")
    .all() as { name: string; type_json: string | null }[];
  const byName = new Map<string, TypeWithName>();
  for (const r of rows) {
    try {
      const stored = JSON.parse(r.type_json ?? "{}") as TypeStored;
      const en = stored?.localized?.en?.name ?? r.name;
      const fr = stored?.localized?.fr?.name ?? r.name;
      byName.set(r.name.toLowerCase(), {
        key: r.name,
        name: { en: String(en), fr: String(fr) },
      });
    } catch {
      byName.set(r.name.toLowerCase(), { key: r.name, name: { en: r.name, fr: r.name } });
    }
  }
  return apiNames.map(
    (name) => byName.get(name.toLowerCase()) ?? { key: name, name: { en: name, fr: name } }
  );
}

const upsertItemStmt = db.prepare(`
  INSERT INTO items (id, name, item_json, updated_at)
  VALUES (@id, @name, @item_json, @updated_at)
  ON CONFLICT(id) DO UPDATE SET
    name=excluded.name,
    item_json=excluded.item_json,
    updated_at=excluded.updated_at
`);

function upsertItem(p: { id: number; name: string; item_json: string }) {
  upsertItemStmt.run({ ...p, updated_at: new Date().toISOString() });
}

async function fetchAllItemRefs(): Promise<{ name: string; url: string }[]> {
  const r = await fetch(`https://pokeapi.co/api/v2/item?limit=100000&offset=0`);
  if (!r.ok) throw new Error(`PokeAPI item list error: ${r.status} ${r.statusText}`);
  const data = (await r.json()) as PokeApiListResponse;
  return Array.isArray(data?.results) ? data.results : [];
}

async function seedItems() {
  const start = Date.now();
  section("🧺", "ITEMS");
  const refs = await fetchAllItemRefs();
  const BATCH = Number(process.env.SEED_ITEMS_BATCH ?? 40);
  step("📋", `Références: ${refs.length}`, `(batch=${BATCH})`);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < refs.length; i += BATCH) {
    const chunk = refs.slice(i, i + BATCH);

    await Promise.all(
      chunk.map(async (it) => {
        try {
          const raw = await fetchItemFromPokeApi(it.url);
          const details = pickItemDetails(raw);
          const id = Number(raw?.id ?? 0);
          const key = String(raw?.name ?? it.name ?? "");
          const stored: ItemStored = { ...details, id, key };
          upsertItem({
            id: stored.id,
            name: stored.key,
            item_json: JSON.stringify(stored),
          });
          ok++;
          return true;
        } catch (e: unknown) {
          fail++;
          console.warn(`  ⚠️  item: ${it.name} -> ${e instanceof Error ? e.message : String(e)}`);
          return false;
        }
      })
    );

    const done = Math.min(i + BATCH, refs.length);
    if (done % (BATCH * 10) === 0 || done === refs.length) {
      step("⏳", `Items: ${done}/${refs.length}`, `ok=${ok} fail=${fail}`);
    }

    const delay = Number(process.env.SEED_DELAY_MS ?? 60);
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  }

  const ms = Date.now() - start;
  step("✅", `Items: ok=${ok} fail=${fail}`, `(${elapsed(ms)})`);
}

async function fetchAllBerryRefs(): Promise<{ name: string; url: string }[]> {
  const r = await fetch(`https://pokeapi.co/api/v2/berry?limit=100000&offset=0`);
  if (!r.ok) throw new Error(`PokeAPI berry list error: ${r.status} ${r.statusText}`);
  const data = (await r.json()) as PokeApiListResponse;
  return Array.isArray(data?.results) ? data.results : [];
}

async function seedBerries() {
  const start = Date.now();
  section("🍒", "BERRIES");
  const refs = await fetchAllBerryRefs();
  const BATCH = Number(process.env.SEED_BERRIES_BATCH ?? 40);
  step("📋", `Références: ${refs.length}`, `(batch=${BATCH})`);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < refs.length; i += BATCH) {
    const chunk = refs.slice(i, i + BATCH);

    await Promise.all(
      chunk.map(async (b) => {
        try {
          const berryRaw = await fetchBerryFromPokeApi(b.url);
          const itemUrl: string | null = berryRaw?.item?.url ?? null;
          let itemRaw: ItemRaw | undefined = undefined;
          if (itemUrl) {
            try {
              itemRaw = await fetchItemFromPokeApi(itemUrl);
            } catch {
              itemRaw = undefined;
            }
          }
          const stored: BerryStored = pickBerryDetails(berryRaw, itemRaw);
          upsertBerry({
            id: stored.id,
            name: stored.key,
            berry_json: JSON.stringify(stored),
          });
          ok++;
        } catch (e: unknown) {
          fail++;
          console.warn(`  ⚠️  berry: ${b.name} -> ${e instanceof Error ? e.message : String(e)}`);
        }
      })
    );

    const done = Math.min(i + BATCH, refs.length);
    if (done % (BATCH * 5) === 0 || done === refs.length) {
      step("⏳", `Berries: ${done}/${refs.length}`, `ok=${ok} fail=${fail}`);
    }

    const delay = Number(process.env.SEED_DELAY_MS ?? 60);
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  }

  const ms = Date.now() - start;
  step("✅", `Berries: ok=${ok} fail=${fail}`, `(${elapsed(ms)})`);
}

/* ------------------------------------------------------------------ */
/* HELPERS */
/* ------------------------------------------------------------------ */

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractIdFromPokemonUrl(url: string): number | null {
  const m = url.match(/\/pokemon\/(\d+)\/?$/);
  return m ? Number(m[1]) : null;
}

function toNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

/* ------------------------------------------------------------------ */
/* HYDRATE */
/* ------------------------------------------------------------------ */

async function hydrateAbilities(abilityRefs: AbilityRef[]): Promise<AbilityStored[]> {
  const hydrated = await Promise.all(
    abilityRefs.map(async (a) => {
      const raw = await fetchAbilityFromPokeApi(a.url);
      const picked = pickAbilityDetails(raw);

      return {
        key: a.name,
        isHidden: a.is_hidden,
        flavorText: picked.flavorText,
        localized: picked.localized,
      };
    })
  );

  return hydrated;
}

/** Extrait pour chaque move (par nom) la liste des version_groups où il est disponible. */
function getVersionGroupsByMoveName(moveRefs: MoveRef[]): Map<string, string[]> {
  const byName = new Map<string, Set<string>>();
  for (const m of moveRefs) {
    const names = (m.version_group_details ?? [])
      .map((d) => d?.version_group?.name)
      .filter((n): n is string => typeof n === "string");
    let set = byName.get(m.name);
    if (!set) {
      set = new Set();
      byName.set(m.name, set);
    }
    for (const n of names) set.add(n);
  }
  const result = new Map<string, string[]>();
  for (const [name, set] of byName) result.set(name, [...set].sort());
  return result;
}

async function hydrateMoves(
  moveRefs: MoveRef[],
  versionGroupsByMoveName?: Map<string, string[]>
): Promise<PokemonMove[]> {
  const uniqueByName = new Map<string, MoveRef>();
  for (const m of moveRefs) uniqueByName.set(m.name, m);

  let unique = [...uniqueByName.values()];

  const max = Number(process.env.MOVES_MAX ?? 0);
  if (Number.isFinite(max) && max > 0) {
    unique = unique.slice(0, max);
  }

  const vgMap = versionGroupsByMoveName ?? new Map<string, string[]>();

  const hydratedOrNull = await Promise.all(
    unique.map(async (m) => {
      try {
        const raw = await fetchMoveFromPokeApi(m.url);
        const versionGroups = vgMap.get(m.name) ?? [];
        const picked = pickMoveDetails(raw, versionGroups);
        return { key: m.name, ...picked } satisfies PokemonMove;
      } catch {
        console.warn(`move hydrate failed: ${m.name}`);
        return null;
      }
    })
  );

  const hydrated = hydratedOrNull.filter((x): x is PokemonMove => x !== null);
  hydrated.sort((a, b) => a.key.localeCompare(b.key));
  return hydrated;
}

/* ------------------------------------------------------------------ */
/* MAIN */
/* ------------------------------------------------------------------ */

async function main() {
  const totalStart = Date.now();
  console.log("\n  🌱  SEED POKÉAPI — Démarrage\n");

  await seedTypes();
  await seedItems();
  await seedBerries();

  const pageLimit = clamp(toNumber(process.env.SEED_PAGE_LIMIT, 200), 1, 2000);
  const delayMs = clamp(toNumber(process.env.SEED_DELAY_MS, 60), 0, 10_000);
  const startOffset = Math.max(toNumber(process.env.SEED_OFFSET, 0), 0);
  const maxToProcess = Math.max(toNumber(process.env.SEED_MAX, 0), 0);

  section("⚡", "POKÉMON");
  step(
    "📋",
    "Config",
    `page=${pageLimit} offset=${startOffset} delay=${delayMs}ms max=${maxToProcess || "ALL"} (version_groups par move)`
  );

  let nextUrl: string | null = `https://pokeapi.co/api/v2/pokemon?limit=${pageLimit}&offset=${startOffset}`;
  const pokemonStart = Date.now();
  let processed = 0;
  let ok = 0;
  let fail = 0;

  while (nextUrl) {
    const r = await fetch(nextUrl, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`List fetch failed: ${r.status} ${r.statusText}`);

    const data = (await r.json()) as PokeApiListResponse;
    const results = data.results ?? [];

    for (const p of results) {
      if (maxToProcess && processed >= maxToProcess) {
        nextUrl = null;
        break;
      }

      const id = extractIdFromPokemonUrl(p.url);

      try {
        const fresh = await fetchPokemonFromPokeApi(id ? String(id) : p.name);
        const types: string[] = Array.isArray(fresh.types) ? fresh.types : [];
        const speciesUrl: string | null = fresh.species_url ?? null;
        const abilityRefs: AbilityRef[] = Array.isArray(fresh.abilities) ? fresh.abilities : [];
        const allMoveRefs: MoveRef[] = Array.isArray(fresh.moves) ? fresh.moves : [];
        const versionGroupsByMove = getVersionGroupsByMoveName(allMoveRefs);
        const encountersUrl = `https://pokeapi.co/api/v2/pokemon/${fresh.id}/encounters`;

        // Parallélisation: species, abilities, moves, encounters en même temps
        const [speciesRaw, abilitiesHydrated, movesHydrated, encountersGrouped] = await Promise.all([
          speciesUrl ? fetchPokemonSpeciesFromPokeApi(speciesUrl) : Promise.resolve(null),
          hydrateAbilities(abilityRefs),
          hydrateMoves(allMoveRefs, versionGroupsByMove),
          fetchEncountersFromUrl(encountersUrl).catch(() => ({ encountersByVersion: [] })),
        ]);

        let speciesJson: string | null = null;
        let evolutionJson: string | null = null;

        if (speciesRaw) {
          const pokemonKey = String(fresh.name ?? "").toLowerCase();
          const typesWithNames = resolveTypesWithNames(types);
          const speciesFields = pickSpeciesFields(speciesRaw, pokemonKey, typesWithNames);
          speciesJson = JSON.stringify(speciesFields);
          const evolutionChainUrl: string | null = speciesRaw?.evolution_chain?.url ?? null;
          if (evolutionChainUrl) {
            const evoChain = await fetchEvolutionChainFromUrl(evolutionChainUrl);
            let evolution: EvolutionItem[] = extractEvolutionItems(evoChain.chain);
            if (
              evolution.length === 1 &&
              (evolution[0]?.id === fresh.id || evolution[0]?.name === fresh.name)
            ) {
              evolution = [];
            }
            evolutionJson = JSON.stringify(evolution);
          } else {
            evolutionJson = JSON.stringify([]);
          }
        }

        const statsJson = JSON.stringify(fresh.stats ?? []);
        const encountersJson = JSON.stringify(encountersGrouped);

        const pokemonName = String(fresh.name).toLowerCase();

        upsertPokemon({
          name: pokemonName,
          id: Number(fresh.id),
          height: fresh.height ?? null,
          weight: fresh.weight ?? null,
          sprite_official: fresh.images.official ?? null,
          sprite_shiny: fresh.images.shiny ?? null,
        });

        const updatedAt = new Date().toISOString();

        if (speciesJson !== null) {
          upsertPokemonSpeciesStmt.run({
            pokemon_name: pokemonName,
            species_json: speciesJson,
            updated_at: updatedAt,
          });
        }
        upsertPokemonEvolutionStmt.run({
          pokemon_name: pokemonName,
          evolution_json: evolutionJson ?? "[]",
          updated_at: updatedAt,
        });
        upsertPokemonStatsStmt.run({
          pokemon_name: pokemonName,
          stats_json: statsJson,
          updated_at: updatedAt,
        });

        for (const a of abilitiesHydrated) {
          upsertAbilityStmt.run({
            name: a.key,
            ability_json: JSON.stringify(a),
            updated_at: updatedAt,
          });
        }
        deletePokemonAbilitiesStmt.run(pokemonName);
        for (const a of abilitiesHydrated) {
          insertPokemonAbilityStmt.run({
            pokemon_name: pokemonName,
            ability_name: a.key,
            is_hidden: a.isHidden ? 1 : 0,
          });
        }

        for (const m of movesHydrated) {
          const existing = getMoveStmt.get(m.key) as { move_json: string } | undefined;
          let moveToStore = m;
          if (existing?.move_json) {
            try {
              const existingMove = JSON.parse(existing.move_json) as PokemonMove;
              const mergedVersions = [
                ...new Set([
                  ...(existingMove.availability?.versions ?? []),
                  ...(m.availability?.versions ?? []),
                ]),
              ].sort();
              moveToStore = { ...m, availability: { versions: mergedVersions } };
            } catch {
              // garder m tel quel si le JSON existant est invalide
            }
          }
          upsertMoveStmt.run({
            name: moveToStore.key,
            move_json: JSON.stringify(moveToStore),
            updated_at: updatedAt,
          });
        }
        deletePokemonMovesStmt.run(pokemonName);
        for (const m of movesHydrated) {
          insertPokemonMoveStmt.run({
            pokemon_name: pokemonName,
            move_name: m.key,
          });
        }

        upsertPokemonEncountersStmt.run({
          pokemon_name: pokemonName,
          encounters_json: encountersJson ?? JSON.stringify({ encountersByVersion: [] }),
          updated_at: updatedAt,
        });

        ok++;
      } catch (e: unknown) {
        fail++;
        console.warn(`  ⚠️  Pokémon: ${p.name} (${id ?? "?"}) — ${e instanceof Error ? e.message : String(e)}`);
      }

      processed++;
      if (processed % 25 === 0) {
        step("⏳", `Pokémon: ${processed} traités`, `ok=${ok} fail=${fail}`);
      }

      if (delayMs > 0) await sleep(delayMs);
    }

    nextUrl = data.next ?? null;
  }

  const pokemonMs = Date.now() - pokemonStart;
  const totalMs = Date.now() - totalStart;
  console.log("");
  section("🏁", "RÉSUMÉ");
  step("⚡", "Pokémon", `traités=${processed} ok=${ok} fail=${fail} (${elapsed(pokemonMs)})`);
  step("⏱️", "Temps total", elapsed(totalMs));
  console.log("");
  db.close?.();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});