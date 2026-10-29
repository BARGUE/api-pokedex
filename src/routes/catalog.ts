import { Router } from "express";
import { cached } from "../lib/cache";
import { getLang, normalizeQuery, notFound, precomputeJson, sendPrecomputedJson } from "../lib/http";
import { nonNull } from "../lib/json";
import { getTypeNameResolver } from "../lookups";
import * as repo from "../repositories/catalog";
import { toTypeStoredLang } from "../services/types";
import { toItemStoredLang } from "../services/items";
import { toBerryStoredLang } from "../services/berries";
import type { Lang } from "../types/common";

/** Routes des données de référence : types, items, berries. */
export const catalogRouter = Router();

catalogRouter.get("/type/:query", (req, res) => {
  const found = repo.findType(normalizeQuery(req.params.query));
  if (!found) return notFound(res, "Type");

  const { id, name, type: typeStored } = found;
  const lang = getLang(req);

  if (lang && typeStored) {
    const type = toTypeStoredLang(typeStored, lang, getTypeNameResolver(lang));
    if (type) return res.json({ id, name, type, lang });
  }

  res.json({ id, name, type: typeStored });
});

const typesJson = cached((_key: "all") => {
  const types = repo.listTypes().map(({ name, type }) => {
    const en = type?.localized?.en?.name ?? type?.localized?.fr?.name ?? name;
    const fr = type?.localized?.fr?.name ?? type?.localized?.en?.name ?? name;
    return { key: name, name: { en: String(en), fr: String(fr) } };
  });
  return precomputeJson({ types });
});

catalogRouter.get("/types", (req, res) => {
  sendPrecomputedJson(req, res, typesJson("all"));
});

const itemsJson = cached((lang: Lang | "all") => {
  const items = repo.listItems();
  if (lang === "all") return precomputeJson({ items });
  return precomputeJson({
    items: items.map((item) => toItemStoredLang(item, lang)).filter(nonNull),
    lang,
  });
});

catalogRouter.get("/items", (req, res) => {
  sendPrecomputedJson(req, res, itemsJson(getLang(req) ?? "all"));
});

const berriesJson = cached((lang: Lang | "all") => {
  const stored = repo.listBerries();
  if (lang === "all") return precomputeJson({ count: stored.length, berries: stored });
  const berries = stored.map((b) => toBerryStoredLang(b, lang)).filter(nonNull);
  return precomputeJson({ count: berries.length, berries, lang });
});

catalogRouter.get("/berries", (req, res) => {
  sendPrecomputedJson(req, res, berriesJson(getLang(req) ?? "all"));
});
