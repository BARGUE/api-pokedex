import { Router, type Response } from "express";
import type { PokemonDb } from "../db";
import { cached } from "../lib/cache";
import { getLang, normalizeQuery, notFound, precomputeJson, sendPrecomputedJson } from "../lib/http";
import { bilingualName } from "../lib/localize";
import { nonNull } from "../lib/json";
import { getTypeNameResolver } from "../lookups";
import * as repo from "../repositories/pokemon";
import { toSpeciesFieldsLang } from "../services/species";
import { toAbilityStoredLang } from "../services/abilities";
import { getDamageClassName, toPokemonMoveLang } from "../services/moves";
import type { Lang } from "../types/common";

export const pokemonRouter = Router();

/** Champs communs à la liste et au détail d'un Pokémon. */
function toPokemonBase(p: Omit<PokemonDb, "updated_at">) {
  return {
    id: p.id,
    name: p.name,
    height: p.height ?? null,
    weight: p.weight ?? null,
    images: {
      official: p.sprite_official ?? null,
      shiny: p.sprite_shiny ?? null,
    },
  };
}

/**
 * La liste complète est la réponse la plus lourde (~1,3 Mo) : elle est calculée
 * et sérialisée une seule fois par langue, puis servie telle quelle.
 */
const pokemonListJson = cached((lang: Lang | "all") => {
  const resultsStored = repo.listPokemon().map((p) => ({
    ...toPokemonBase(p),
    species: p.species,
  }));

  if (lang !== "all") {
    const results = resultsStored.map((p) => {
      const species = toSpeciesFieldsLang(p.species, lang);
      return { ...p, display_name: species?.name ?? p.name, species };
    });
    return precomputeJson({ results, lang });
  }

  const pokemon_list = resultsStored.map((p) => ({
    ...p,
    display_name: bilingualName(p.species?.localized, p.name),
  }));
  return precomputeJson({ pokemon_list });
});

pokemonRouter.get("/", (req, res) => {
  sendPrecomputedJson(req, res, pokemonListJson(getLang(req) ?? "all"));
});

// Résolution unique du Pokémon pour toutes les routes /:query/*.
pokemonRouter.param("query", (req, res, next, query: string) => {
  const pokemon = repo.findPokemon(normalizeQuery(query));
  if (!pokemon) return notFound(res, "Pokemon");
  res.locals.pokemon = pokemon;
  next();
});

const current = (res: Response) => res.locals.pokemon as PokemonDb;

pokemonRouter.get("/:query", (req, res) => {
  const pokemon = current(res);
  const lang = getLang(req);
  const speciesStored = repo.getSpecies(pokemon.name);

  if (lang) {
    const species = toSpeciesFieldsLang(speciesStored, lang);
    return res.json({
      pokemon: {
        ...toPokemonBase(pokemon),
        display_name: species?.name ?? pokemon.name,
        species,
      },
      lang,
    });
  }

  res.json({
    pokemon: {
      ...toPokemonBase(pokemon),
      display_name: bilingualName(speciesStored?.localized, pokemon.name),
      species: speciesStored,
    },
  });
});

pokemonRouter.get("/:query/evolution", (_req, res) => {
  const { id, name } = current(res);
  const evolution = repo.getEvolution(name).map((item) => ({
    ...item,
    display_name: bilingualName(repo.getSpecies(item.name)?.localized, item.name),
  }));
  res.json({ evolution: { id, name, evolution } });
});

pokemonRouter.get("/:query/stats", (_req, res) => {
  const { id, name } = current(res);
  res.json({ stats: { id, name, stats: repo.getStats(name) } });
});

pokemonRouter.get("/:query/abilities", (req, res) => {
  const { id, name } = current(res);
  const lang = getLang(req);
  const abilitiesStored = repo.getAbilities(name);

  if (lang) {
    const abilities = abilitiesStored.map((a) => toAbilityStoredLang(a, lang)).filter(nonNull);
    return res.json({ abilities: { id, name, abilities }, lang });
  }

  res.json({ abilities: { id, name, abilities: abilitiesStored } });
});

pokemonRouter.get("/:query/moves", (req, res) => {
  const { id, name } = current(res);
  const lang = getLang(req);
  const movesStored = repo.getMoves(name);

  if (lang) {
    const resolvers = {
      typeName: getTypeNameResolver(lang),
      damageClassName: (apiName: string) => getDamageClassName(apiName, lang),
    };
    const moves = movesStored.map((m) => toPokemonMoveLang(m, lang, resolvers)).filter(nonNull);
    return res.json({ moves: { id, name, moves }, lang });
  }

  res.json({ moves: { id, name, moves: movesStored } });
});

pokemonRouter.get("/:query/encounters", (_req, res) => {
  const { id, name } = current(res);
  res.json({ encounters: { id, name, encounters: repo.getEncounters(name) } });
});
