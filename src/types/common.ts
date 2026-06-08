/** Langues supportées (PokeAPI) */
export type Lang = "en" | "fr";

/** Entrée avec langue (names, genera, effect_entries, flavor_text_entries, etc.) */
export type LangEntry<T = Record<string, unknown>> = {
  language: { name: string };
} & T;

/** Entrée avec uniquement un nom (pour names[], attributes[], etc.) */
export type NameEntry = LangEntry<{ name: string }>;

/** Objet avec une propriété name (type, damage_class, habitat, etc.) */
export type Named = { name?: string };

/** Liste d'objets avec name (damage_relations, egg_groups, attributes) */
export type NamedList = Named[];
