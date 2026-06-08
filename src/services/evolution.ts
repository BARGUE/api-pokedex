export type EvolutionItem = {
  id: number | null;
  name: string;
  display_name?: { en: string; fr: string };
  images: {
    official: string | null;
    shiny: string | null;
  };
};

export async function fetchEvolutionChainFromUrl(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Failed to fetch evolution chain");
  return r.json();
}

function getIdFromSpeciesUrl(url?: string): number | null {
  if (!url) return null;
  const m = url.match(/\/pokemon-species\/(\d+)\//);
  return m ? Number(m[1]) : null;
}

function buildImagesFromId(id: number | null) {
  return {
    official: id
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
      : null,
    shiny: id
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/shiny/${id}.png`
      : null
  };
}

import type { EvolutionChainNodeRaw } from "../types/pokeapi-raw";

export function extractEvolutionItems(
  chainNode: EvolutionChainNodeRaw | null | undefined,
  requestedId?: number
): EvolutionItem[] {
  const out: EvolutionItem[] = [];
  const seen = new Set<string>();

  function walk(node: EvolutionChainNodeRaw | null | undefined) {
    const name: string | undefined = node?.species?.name;
    const url: string | undefined = node?.species?.url;

    if (name && !seen.has(name)) {
      seen.add(name);
      const id = getIdFromSpeciesUrl(url);
      out.push({ id, name, images: buildImagesFromId(id) });
    }

    const next = Array.isArray(node?.evolves_to) ? node.evolves_to : [];
    for (const child of next) walk(child);
  }

  walk(chainNode);

  if (
    requestedId != null &&
    out.length === 1 &&
    out[0]?.id === requestedId
  ) {
    return [];
  }

  return out;
}
