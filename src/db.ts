import Database from "better-sqlite3";
import path from "node:path";
import { SCHEMA_VERSION, applySchema, getSchemaVersion, isEmptyDatabase } from "./schema";

const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), "pokemon.db");
export const db = new Database(dbPath);

// Base neuve : on crée le schéma. Base existante : elle doit avoir été générée par le seed actuel.
if (isEmptyDatabase(db)) {
  applySchema(db);
} else if (getSchemaVersion(db) !== SCHEMA_VERSION) {
  throw new Error(
    `${dbPath} utilise le schéma v${getSchemaVersion(db)} alors que l'API attend la v${SCHEMA_VERSION}. ` +
      "Régénérez la base avec `npm run seed:pokemon`."
  );
}

export type PokemonDb = {
  name: string;
  id: number;
  height: number | null;
  weight: number | null;
  sprite_official: string | null;
  sprite_shiny: string | null;
  updated_at: string;
};
