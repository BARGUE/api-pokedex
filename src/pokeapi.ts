import { z } from "zod";
import { PokemonStatItem } from "./services/stats";

const MoveRefSchema = z.object({
  move: z.object({
    name: z.string(),
    url: z.string(),
  }),
  version_group_details: z.array(
    z.object({
      level_learned_at: z.number(),
      move_learn_method: z.object({
        name: z.string(),
        url: z.string(),
      }),
      order: z.number().nullable(),
      version_group: z.object({
        name: z.string(),
        url: z.string(),
      }),
    })
  ),
});

export type MoveRef = {
  name: string;
  url: string;
  version_group_details: Array<{
    level_learned_at: number;
    move_learn_method: { name: string; url: string };
    order: number | null;
    version_group: { name: string; url: string };
  }>;
};

const PokeApiPokemonSchema = z.object({
  id: z.number(),
  name: z.string(),
  height: z.number().nullable().optional(),
  weight: z.number().nullable().optional(),

  types: z.array(
    z.object({
      type: z.object({ name: z.string() }),
    })
  ),

  stats: z
    .array(
      z.object({
        base_stat: z.number(),
        effort: z.number(),
        stat: z.object({
          name: z.string(),
          url: z.string(),
        }),
      })
    )
    .transform((arr) =>
      arr.map((s) => ({
        name: s.stat.name,
        base_stat: s.base_stat,
      }))
    ),

  abilities: z
    .array(
      z.object({
        is_hidden: z.boolean(),
        slot: z.number(),
        ability: z.object({
          name: z.string(),
          url: z.string(),
        }),
      })
    )
    .transform((arr) =>
      arr
        .slice()
        .sort((a, b) => a.slot - b.slot)
        .map((a) => ({
          name: a.ability.name,
          url: a.ability.url,
          is_hidden: a.is_hidden,
          slot: a.slot,
        }))
    ),

  species: z.object({
    url: z.string(),
  }),

  sprites: z
    .object({
      front_shiny: z.string().nullable().optional(),
      other: z
        .object({
          ["official-artwork"]: z
            .object({
              front_default: z.string().nullable().optional(),
            })
            .optional(),
          home: z
            .object({
              front_shiny: z.string().nullable().optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),

    moves: z.array(MoveRefSchema).transform((arr) =>
      arr.map((m) => ({
        name: m.move.name,
        url: m.move.url,
        version_group_details: m.version_group_details,
      }))
    ),    
});

export type AbilityRef = {
  name: string;
  url: string;
  is_hidden: boolean;
  slot: number;
};

export type PokemonParsed = {
  id: number;
  name: string;
  height: number | null;
  weight: number | null;
  types: string[];
  species_url: string;
  images: {
    official: string | null;
    shiny: string | null;
  };
  stats: PokemonStatItem[];
  abilities: AbilityRef[];
  moves: MoveRef[];
};

export async function fetchPokemonSpeciesFromPokeApi(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`PokeAPI species error: ${r.status} ${r.statusText}`);
  return r.json();
}

export async function fetchAbilityFromPokeApi(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch ability: ${r.status} ${r.statusText}`);
  return r.json();
}

export async function fetchMoveFromPokeApi(name: string) {
  const r = await fetch(name);
  if (!r.ok) throw new Error(`Failed to fetch move: ${r.status} ${r.statusText}`);
  return r.json();
}

export async function fetchBerryFromPokeApi(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch berry: ${r.status} ${r.statusText}`);
  return r.json();
}

export async function fetchItemFromPokeApi(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch item: ${r.status} ${r.statusText}`);
  return r.json();
}

export async function fetchTypeFromPokeApi(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch type: ${r.status} ${r.statusText}`);
  return r.json();
}

export async function fetchPokemonFromPokeApi(query: string | number): Promise<PokemonParsed> {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${query}`);
  if (!res.ok) throw new Error(`PokeAPI error: ${res.status} ${res.statusText}`);

  const json = await res.json();
  const data = PokeApiPokemonSchema.parse(json);

  const types = data.types.map((t) => t.type.name);

  const official = data.sprites?.other?.["official-artwork"]?.front_default ?? null;

  const shiny = data.sprites?.other?.home?.front_shiny ?? data.sprites?.front_shiny ?? null;

  const speciesUrl = data.species.url;

  return {
    id: data.id,
    name: data.name,
    height: data.height ?? null,
    weight: data.weight ?? null,
    types,
    species_url: speciesUrl,
    images: { official, shiny },
    stats: data.stats,
    abilities: data.abilities,
    moves: data.moves,
  };
}
