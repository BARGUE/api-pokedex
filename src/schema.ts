import type Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/** À incrémenter à chaque changement incompatible de schema.sql (stocké dans PRAGMA user_version). */
export const SCHEMA_VERSION = 2;

const schemaPath = path.join(process.cwd(), "schema.sql");

/** Crée les tables manquantes et marque la base avec la version courante du schéma. */
export function applySchema(database: Database.Database) {
  database.exec(fs.readFileSync(schemaPath, "utf8"));
  database.pragma(`user_version = ${SCHEMA_VERSION}`);
}

/** Version du schéma d'une base ; 0 = base vide ou ancien format (blobs *_json). */
export function getSchemaVersion(database: Database.Database): number {
  return database.pragma("user_version", { simple: true }) as number;
}

export function isEmptyDatabase(database: Database.Database): boolean {
  return database.prepare("SELECT count(*) FROM sqlite_master WHERE type = 'table'").pluck().get() === 0;
}
