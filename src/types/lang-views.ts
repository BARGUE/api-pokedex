/**
 * Structures "single language" : tout le contenu dans une seule langue (en ou fr).
 * Utilisées quand le client demande ?lang=en ou ?lang=fr pour n'avoir que les données de la langue du site.
 */

import type { Lang } from "./common";

// ---------------------------------------------------------------------------
// Type (types Pokémon)
// ---------------------------------------------------------------------------

export type TypeStoredLang = {
  /** Nom du type dans la langue demandée */
  name: string;
  damage_relations: {
    double_damage_from: string[];
    double_damage_to: string[];
    half_damage_from: string[];
    half_damage_to: string[];
    no_damage_from: string[];
    no_damage_to: string[];
  };
};

// ---------------------------------------------------------------------------
// Species (infos espèce Pokémon)
// ---------------------------------------------------------------------------

export type SpeciesFieldsLang = {
  name: string | null;
  genus: string | null;
  flavor: string | null;
  habitat: string | null;
  shape: string | null;
  isLegendary: boolean;
  isMythical: boolean;
  generation: string | null;
  /** Noms des types dans la langue demandée. */
  types: string[];
};

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------

export type ItemStoredLang = {
  id: number;
  name: string;
  cost: number | null;
  category: string | null;
  attributes: string[];
  sprites: { default: string | null };
  effect_short: string | null;
  effect_long: string | null;
  flavor_text: string | null;
};

// ---------------------------------------------------------------------------
// Ability
// ---------------------------------------------------------------------------

export type AbilityStoredLang = {
  name: string;
  is_hidden: boolean;
  effect_short: string | null;
  effect_long: string | null;
  flavor_text: string | null;
};

// ---------------------------------------------------------------------------
// Move
// ---------------------------------------------------------------------------

export type PokemonMoveLang = {
  name: string;
  type: { name: string };
  damage_class: { name: string };
  power: number;
  accuracy: number;
  pp: number;
  priority: number;
  effect_short: string;
  effect_long: string;
  flavor_text: string | null;
  version?: string[];
};

// ---------------------------------------------------------------------------
// Berry
// ---------------------------------------------------------------------------

export type BerryStoredLang = {
  id: number;
  name: string;
  growth_time: number | null;
  max_harvest: number | null;
  natural_gift_power: number | null;
  size: number | null;
  smoothness: number | null;
  soil_dryness: number | null;
  firmness: string | null;
  flavors: Array<{ flavor: string; potency: number }>;
  item: {
    name: string;
    sprites: { default: string | null };
    name_display: string | null;
  } | null;
};

// ---------------------------------------------------------------------------
// Pokémon (résumé avec species en une langue)
// ---------------------------------------------------------------------------

export type PokemonListItemLang = {
  id: number;
  name: string;
  height: number | null;
  weight: number | null;
  images: { official: string | null; shiny: string | null };
  species: SpeciesFieldsLang | null;
};

export type PokemonDetailLang = {
  id: number;
  name: string;
  height: number | null;
  weight: number | null;
  images: { official: string | null; shiny: string | null };
  species: SpeciesFieldsLang | null;
};

// ---------------------------------------------------------------------------
// Evolution : pas de texte traduit (noms = identifiants API), même structure EN/FR
// ---------------------------------------------------------------------------

// EncountersGrouped : pas de traduction (versionKey / locationAreaKey), inchangé

/** Langue supportée pour les vues single-lang */
export type SupportedLang = Lang;
