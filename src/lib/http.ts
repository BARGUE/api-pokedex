import { gzipSync } from "node:zlib";
import type { ErrorRequestHandler, Request, Response } from "express";
import type { Lang } from "../types/common";

/** Extrait la langue depuis query (?lang=en | ?lang=fr). Retourne undefined si invalide ou absent. */
export function getLang(req: Request): Lang | undefined {
  const lang = typeof req.query.lang === "string" ? req.query.lang.toLowerCase() : undefined;
  return lang === "en" || lang === "fr" ? lang : undefined;
}

/** Normalise un paramètre `:query` (id ou nom). */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function notFound(res: Response, what: string) {
  return res.status(404).json({ error: `${what} not found` });
}

/** Réponse JSON sérialisée et compressée une seule fois, destinée à être mise en cache. */
export type PrecomputedJson = { body: string; gzip: Buffer };

export function precomputeJson(value: unknown): PrecomputedJson {
  const body = JSON.stringify(value);
  return { body, gzip: gzipSync(body) };
}

/**
 * Envoie une réponse précalculée : ni JSON.stringify ni gzip à chaque requête.
 * Le middleware `compression` ignore les réponses qui ont déjà un Content-Encoding.
 */
export function sendPrecomputedJson(req: Request, res: Response, payload: PrecomputedJson) {
  res.type("json").vary("Accept-Encoding");
  if (req.acceptsEncodings("gzip")) {
    return res.set("Content-Encoding", "gzip").send(payload.gzip);
  }
  return res.send(payload.body);
}

/** Express 5 transmet ici toute erreur levée dans un handler (sync ou async). */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  console.error(`${req.method} ${req.originalUrl} failed:`, err);
  res.status(500).json({
    error: err instanceof Error ? err.message : "Unknown error",
  });
};
