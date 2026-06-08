-- Pokémon : clé primaire = name (identifiant métier)
CREATE TABLE IF NOT EXISTS pokemon (
  name TEXT PRIMARY KEY,
  id INTEGER NOT NULL UNIQUE,
  height INTEGER,
  weight INTEGER,
  sprite_official TEXT,
  sprite_shiny TEXT,
  updated_at TEXT NOT NULL
);

-- Species : une ligne par Pokémon (données dérivées de l’API species)
CREATE TABLE IF NOT EXISTS pokemon_species (
  pokemon_name TEXT PRIMARY KEY,
  species_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (pokemon_name) REFERENCES pokemon(name) ON DELETE CASCADE
);

-- Evolution : une ligne par Pokémon (chaîne d’évolution)
CREATE TABLE IF NOT EXISTS pokemon_evolution (
  pokemon_name TEXT PRIMARY KEY,
  evolution_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (pokemon_name) REFERENCES pokemon(name) ON DELETE CASCADE
);

-- Stats : une ligne par Pokémon
CREATE TABLE IF NOT EXISTS pokemon_stats (
  pokemon_name TEXT PRIMARY KEY,
  stats_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (pokemon_name) REFERENCES pokemon(name) ON DELETE CASCADE
);

-- Abilities : table globale (une capacité peut être partagée par plusieurs Pokémon)
CREATE TABLE IF NOT EXISTS abilities (
  name TEXT PRIMARY KEY,
  ability_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Lien Pokémon <-> Abilities (avec is_hidden)
CREATE TABLE IF NOT EXISTS pokemon_abilities (
  pokemon_name TEXT NOT NULL,
  ability_name TEXT NOT NULL,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (pokemon_name, ability_name),
  FOREIGN KEY (pokemon_name) REFERENCES pokemon(name) ON DELETE CASCADE,
  FOREIGN KEY (ability_name) REFERENCES abilities(name) ON DELETE CASCADE
);

-- Moves : table globale (une attaque peut être apprise par plusieurs Pokémon)
CREATE TABLE IF NOT EXISTS moves (
  name TEXT PRIMARY KEY,
  move_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Lien Pokémon <-> Moves
CREATE TABLE IF NOT EXISTS pokemon_moves (
  pokemon_name TEXT NOT NULL,
  move_name TEXT NOT NULL,
  PRIMARY KEY (pokemon_name, move_name),
  FOREIGN KEY (pokemon_name) REFERENCES pokemon(name) ON DELETE CASCADE,
  FOREIGN KEY (move_name) REFERENCES moves(name) ON DELETE CASCADE
);

-- Encounters : par Pokémon (une ligne par Pokémon, JSON des rencontres par version)
CREATE TABLE IF NOT EXISTS pokemon_encounters (
  pokemon_name TEXT PRIMARY KEY,
  encounters_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (pokemon_name) REFERENCES pokemon(name) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS types (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  item_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS berries (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  berry_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
