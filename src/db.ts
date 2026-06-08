import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), "pokemon.db");
export const db = new Database(dbPath);

// initialise la DB avec schema.sql
const schemaPath = path.join(process.cwd(), "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");
db.exec(schema);

export type PokemonDb = {
  name: string;
  id: number;
  height: number | null;
  weight: number | null;
  sprite_official: string | null;
  sprite_shiny: string | null;
  updated_at: string;
};
