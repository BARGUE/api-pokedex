import type { LangEntry, Named } from "./common";

// —— Species (PokeAPI species) ——
export type SpeciesFlavorEntry = LangEntry<{ flavor_text?: string }>;
export type SpeciesRaw = {
  names?: LangEntry<{ name: string }>[];
  genera?: LangEntry<{ genus: string }>[];
  flavor_text_entries?: SpeciesFlavorEntry[];
  habitat?: Named;
  shape?: Named;
  is_legendary?: boolean;
  is_mythical?: boolean;
  generation?: Named;
  egg_groups?: Named[];
};

// —— Item / Ability / Move : effect & flavor ——
export type EffectEntry = LangEntry<{ short_effect?: string; effect?: string }>;
export type FlavorTextEntry = LangEntry<{ flavor_text?: string; text?: string }>;
export type FlavorTextWithVersion = LangEntry<{
  flavor_text?: string;
  version_group?: { name?: string };
}>;

// —— Item (PokeAPI item) ——
export type ItemRaw = {
  name?: string;
  cost?: number;
  category?: Named;
  attributes?: Named[];
  sprites?: { default?: string };
  names?: LangEntry<{ name: string }>[];
  effect_entries?: EffectEntry[];
  flavor_text_entries?: FlavorTextEntry[];
};

// —— Ability (PokeAPI ability) ——
export type AbilityRaw = {
  name?: string;
  names?: LangEntry<{ name: string }>[];
  effect_entries?: EffectEntry[];
  flavor_text_entries?: FlavorTextWithVersion[];
};

// —— Move (PokeAPI move) ——
export type MoveRaw = {
  name?: string;
  names?: LangEntry<{ name: string }>[];
  type?: Named;
  damage_class?: Named;
  power?: number;
  accuracy?: number;
  pp?: number;
  priority?: number;
  effect_entries?: EffectEntry[];
  flavor_text_entries?: LangEntry<{ flavor_text?: string }>[];
};

// —— Berry (PokeAPI berry) ——
export type BerryFlavorRaw = { flavor?: Named; potency?: number };
export type BerryRaw = {
  id?: number;
  name?: string;
  names?: LangEntry<{ name: string }>[];
  item?: { name?: string; url?: string };
  growth_time?: number;
  max_harvest?: number;
  natural_gift_power?: number;
  size?: number;
  smoothness?: number;
  soil_dryness?: number;
  firmness?: Named;
  flavors?: BerryFlavorRaw[];
};

// —— Evolution chain (PokeAPI evolution chain) ——
export type EvolutionChainNodeRaw = {
  species?: { name?: string; url?: string };
  evolves_to?: EvolutionChainNodeRaw[];
};

// —— Pokemon stats (PokeAPI pokemon.stats) ——
export type PokemonStatRaw =
  | { stat?: { name?: string }; base_stat?: number }
  | { name?: string; base_stat?: number };

export type PokemonStatsRaw = {
  stats?: PokemonStatRaw[];
};
