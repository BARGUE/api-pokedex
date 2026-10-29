-- Schéma relationnel de pokemon.db (généré par scripts/seed.ts).
-- Version suivie par `PRAGMA user_version` (voir SCHEMA_VERSION dans src/db.ts).
--
-- Conventions :
--   - les entités PokeAPI gardent leur id PokeAPI comme clé primaire ;
--   - `name` = identifiant API (ex. "bulbasaur"), les libellés traduits sont en colonnes *_en / *_fr ;
--   - une valeur absente côté PokeAPI est stockée NULL (les valeurs par défaut sont appliquées par l'API).

/* ------------------------------------------------------------------ */
/* Référentiels (déduits des URLs PokeAPI, sans requête dédiée)        */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS version_groups (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS versions (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS move_learn_methods (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS location_areas (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS types (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  generation TEXT,
  name_en    TEXT,
  name_fr    TEXT
);

-- Table d'efficacité : facteur de dégâts (en %) d'un type attaquant sur un type défenseur.
-- Seules les relations non neutres sont stockées (200 = super efficace, 50 = peu efficace, 0 = aucun effet).
CREATE TABLE IF NOT EXISTS type_efficacy (
  attacking_type_id INTEGER NOT NULL REFERENCES types(id),
  defending_type_id INTEGER NOT NULL REFERENCES types(id),
  damage_factor     INTEGER NOT NULL CHECK (damage_factor IN (0, 50, 200)),
  PRIMARY KEY (attacking_type_id, defending_type_id)
) WITHOUT ROWID;

/* ------------------------------------------------------------------ */
/* Espèces & évolutions                                                */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS evolution_chains (
  id                INTEGER PRIMARY KEY,
  baby_trigger_item TEXT
);

CREATE TABLE IF NOT EXISTS species (
  id                      INTEGER PRIMARY KEY,
  name                    TEXT NOT NULL UNIQUE,
  generation              TEXT,
  habitat                 TEXT,
  shape                   TEXT,
  color                   TEXT,
  growth_rate             TEXT,
  is_baby                 INTEGER NOT NULL DEFAULT 0,
  is_legendary            INTEGER NOT NULL DEFAULT 0,
  is_mythical             INTEGER NOT NULL DEFAULT 0,
  capture_rate            INTEGER,
  base_happiness          INTEGER,
  -- Chance d'être femelle en huitièmes ; -1 = asexué.
  gender_rate             INTEGER,
  hatch_counter           INTEGER,
  evolves_from_species_id INTEGER,
  evolution_chain_id      INTEGER REFERENCES evolution_chains(id),
  -- Position de l'espèce dans un parcours en profondeur de sa chaîne d'évolution.
  evolution_order         INTEGER,
  name_en                 TEXT,
  name_fr                 TEXT,
  genus_en                TEXT,
  genus_fr                TEXT,
  flavor_en               TEXT,
  flavor_fr               TEXT
);
CREATE INDEX IF NOT EXISTS idx_species_chain ON species(evolution_chain_id, evolution_order);

CREATE TABLE IF NOT EXISTS species_egg_groups (
  species_id INTEGER NOT NULL REFERENCES species(id) ON DELETE CASCADE,
  egg_group  TEXT NOT NULL,
  PRIMARY KEY (species_id, egg_group)
) WITHOUT ROWID;

-- Conditions pour évoluer VERS `species_id` (plusieurs lignes possibles selon les jeux).
CREATE TABLE IF NOT EXISTS evolution_details (
  species_id              INTEGER NOT NULL REFERENCES species(id) ON DELETE CASCADE,
  position                INTEGER NOT NULL,
  trigger                 TEXT,
  min_level               INTEGER,
  item                    TEXT,
  held_item               TEXT,
  known_move              TEXT,
  known_move_type         TEXT,
  location                TEXT,
  min_happiness           INTEGER,
  min_beauty              INTEGER,
  min_affection           INTEGER,
  time_of_day             TEXT,
  gender                  INTEGER,
  relative_physical_stats INTEGER,
  party_species           TEXT,
  party_type              TEXT,
  trade_species           TEXT,
  needs_overworld_rain    INTEGER NOT NULL DEFAULT 0,
  turn_upside_down        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (species_id, position)
) WITHOUT ROWID;

/* ------------------------------------------------------------------ */
/* Capacités spéciales (abilities) & attaques (moves)                  */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS abilities (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  generation      TEXT,
  is_main_series  INTEGER NOT NULL DEFAULT 1,
  name_en         TEXT,
  name_fr         TEXT,
  effect_short_en TEXT,
  effect_long_en  TEXT,
  effect_short_fr TEXT,
  effect_long_fr  TEXT,
  flavor_en       TEXT,
  flavor_fr       TEXT
);

CREATE TABLE IF NOT EXISTS moves (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  type_id         INTEGER REFERENCES types(id),
  damage_class    TEXT,
  power           INTEGER,
  accuracy        INTEGER,
  pp              INTEGER,
  priority        INTEGER,
  effect_chance   INTEGER,
  target          TEXT,
  generation      TEXT,
  name_en         TEXT,
  name_fr         TEXT,
  effect_short_en TEXT,
  effect_long_en  TEXT,
  effect_short_fr TEXT,
  effect_long_fr  TEXT,
  flavor_en       TEXT,
  flavor_fr       TEXT
);

/* ------------------------------------------------------------------ */
/* Pokémon                                                             */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS pokemon (
  id               INTEGER PRIMARY KEY,
  name             TEXT NOT NULL UNIQUE,
  species_id       INTEGER NOT NULL REFERENCES species(id),
  is_default       INTEGER NOT NULL DEFAULT 1,
  sort_order       INTEGER,
  height           INTEGER,
  weight           INTEGER,
  base_experience  INTEGER,
  sprite_official  TEXT,
  sprite_shiny     TEXT,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pokemon_species ON pokemon(species_id);

CREATE TABLE IF NOT EXISTS pokemon_types (
  pokemon_id INTEGER NOT NULL REFERENCES pokemon(id) ON DELETE CASCADE,
  slot       INTEGER NOT NULL,
  type_id    INTEGER NOT NULL REFERENCES types(id),
  PRIMARY KEY (pokemon_id, slot)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_pokemon_types_type ON pokemon_types(type_id);

CREATE TABLE IF NOT EXISTS pokemon_stats (
  pokemon_id INTEGER NOT NULL REFERENCES pokemon(id) ON DELETE CASCADE,
  stat       TEXT NOT NULL,
  position   INTEGER NOT NULL,
  base_stat  INTEGER NOT NULL,
  effort     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (pokemon_id, stat)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS pokemon_abilities (
  pokemon_id INTEGER NOT NULL REFERENCES pokemon(id) ON DELETE CASCADE,
  ability_id INTEGER NOT NULL REFERENCES abilities(id),
  slot       INTEGER NOT NULL,
  is_hidden  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (pokemon_id, ability_id)
) WITHOUT ROWID;

-- Learnset : une ligne par (Pokémon, attaque, groupe de versions, méthode, niveau).
CREATE TABLE IF NOT EXISTS pokemon_moves (
  pokemon_id       INTEGER NOT NULL REFERENCES pokemon(id) ON DELETE CASCADE,
  move_id          INTEGER NOT NULL REFERENCES moves(id),
  version_group_id INTEGER NOT NULL REFERENCES version_groups(id),
  learn_method_id  INTEGER NOT NULL REFERENCES move_learn_methods(id),
  level            INTEGER NOT NULL DEFAULT 0,
  sort_order       INTEGER,
  PRIMARY KEY (pokemon_id, move_id, version_group_id, learn_method_id, level)
) WITHOUT ROWID;

-- Dérivé de pokemon_moves en fin de seed : groupes de versions où une attaque est apprenable.
CREATE TABLE IF NOT EXISTS move_version_groups (
  move_id          INTEGER NOT NULL REFERENCES moves(id) ON DELETE CASCADE,
  version_group_id INTEGER NOT NULL REFERENCES version_groups(id),
  PRIMARY KEY (move_id, version_group_id)
) WITHOUT ROWID;

-- Une ligne par condition de rencontre (zone, version, méthode, plage de niveaux).
CREATE TABLE IF NOT EXISTS pokemon_encounters (
  pokemon_id       INTEGER NOT NULL REFERENCES pokemon(id) ON DELETE CASCADE,
  location_area_id INTEGER NOT NULL REFERENCES location_areas(id),
  version_id       INTEGER NOT NULL REFERENCES versions(id),
  method           TEXT,
  min_level        INTEGER NOT NULL,
  max_level        INTEGER NOT NULL,
  chance           INTEGER NOT NULL,
  -- Conditions éventuelles (ex. "time-morning,season-spring"), séparées par des virgules.
  conditions       TEXT
);
CREATE INDEX IF NOT EXISTS idx_pokemon_encounters_pokemon ON pokemon_encounters(pokemon_id);

/* ------------------------------------------------------------------ */
/* Objets & baies                                                      */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS items (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  category        TEXT,
  cost            INTEGER,
  fling_power     INTEGER,
  fling_effect    TEXT,
  sprite          TEXT,
  name_en         TEXT,
  name_fr         TEXT,
  effect_short_en TEXT,
  effect_long_en  TEXT,
  effect_short_fr TEXT,
  effect_long_fr  TEXT,
  flavor_en       TEXT,
  flavor_fr       TEXT
);

CREATE TABLE IF NOT EXISTS item_attributes (
  item_id   INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL,
  attribute TEXT NOT NULL,
  PRIMARY KEY (item_id, position)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS berries (
  id                 INTEGER PRIMARY KEY,
  name               TEXT NOT NULL UNIQUE,
  item_id            INTEGER REFERENCES items(id),
  firmness           TEXT,
  growth_time        INTEGER,
  max_harvest        INTEGER,
  natural_gift_power INTEGER,
  natural_gift_type  TEXT,
  size               INTEGER,
  smoothness         INTEGER,
  soil_dryness       INTEGER
);

CREATE TABLE IF NOT EXISTS berry_flavors (
  berry_id INTEGER NOT NULL REFERENCES berries(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  flavor   TEXT NOT NULL,
  potency  INTEGER NOT NULL,
  PRIMARY KEY (berry_id, position)
) WITHOUT ROWID;
