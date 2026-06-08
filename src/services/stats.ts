import type { PokemonStatsRaw, PokemonStatRaw } from "../types/pokeapi-raw";

export type PokemonStatItem = {
  name: string;
  base_stat: number;
};

export function pickPokemonStatsArray(
  pokemon: PokemonStatsRaw | null | undefined
): PokemonStatItem[] {
  if (!Array.isArray(pokemon?.stats)) return [];

  const stats = pokemon.stats;
  if (stats.length && typeof (stats[0] as { name?: string }).name === "string") {
    return stats
      .filter(
        (s): s is PokemonStatRaw & { name: string; base_stat: number } =>
          typeof (s as { name?: string }).name === "string" &&
          typeof (s as { base_stat?: number }).base_stat === "number"
      )
      .map((s) => ({ name: s.name, base_stat: s.base_stat }));
  }

  return stats
    .filter(
      (s): s is PokemonStatRaw & { stat: { name: string }; base_stat: number } =>
        typeof (s as { stat?: { name?: string } }).stat?.name === "string" &&
        typeof (s as { base_stat?: number }).base_stat === "number"
    )
    .map((s) => ({
      name: (s as { stat: { name: string }; base_stat: number }).stat.name,
      base_stat: (s as { base_stat: number }).base_stat,
    }));
}
  