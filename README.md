# Pokédex API

API REST bilingue (🇬🇧 / 🇫🇷) construite au-dessus de la [PokeAPI](https://pokeapi.co/). Les données sont **importées une seule fois** dans une base SQLite locale, puis servies depuis cette base — l'API ne dépend donc plus de la PokeAPI à l'exécution : réponses rapides, hors-ligne et sans quota.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Peuplement de la base (seed)](#peuplement-de-la-base-seed)
- [Démarrage](#démarrage)
- [Configuration](#configuration)
- [Référence de l'API](#référence-de-lapi)
- [Localisation (`?lang`)](#localisation-lang)
- [Structure du projet](#structure-du-projet)
- [Scripts npm](#scripts-npm)

## Fonctionnalités

- **Catalogue complet** : Pokémon, types, capacités (abilities), attaques (moves), objets (items), baies (berries), évolutions, statistiques et zones de rencontre.
- **Bilingue** : chaque ressource textuelle est stockée en anglais et en français. Un paramètre `?lang=en|fr` renvoie une vue mono-langue prête à afficher.
- **Cache local SQLite** : après le seed, aucune requête sortante — l'API sert exclusivement les données locales.
- **Validation stricte** : les réponses de la PokeAPI sont validées et normalisées avec [Zod](https://zod.dev/) avant persistance.
- **Sûreté de type** : TypeScript en mode `strict` de bout en bout.

## Stack technique

| Domaine        | Technologie |
| -------------- | ----------- |
| Runtime        | Node.js |
| Langage        | TypeScript (mode `strict`) |
| Serveur HTTP   | Express 5 |
| Base de données | SQLite via `better-sqlite3` |
| Validation     | Zod |
| Exécution TS   | `tsx` / `ts-node-dev` |

## Architecture

```
PokeAPI  ──(seed, une fois)──►  SQLite (pokemon.db)  ──►  Express API  ──►  Client
```

1. **Seed** — le script `scripts/seed.ts` récupère les données de la PokeAPI, les valide avec Zod, puis construit une nouvelle `pokemon.db`.
2. **Persistance** — schéma relationnel (voir [`schema.sql`](schema.sql)) : une table par entité PokeAPI (id PokeAPI en clé primaire), des tables de liaison (types, stats, capacités, learnset des attaques par version, rencontres…), et les textes traduits en colonnes `*_en` / `*_fr`. Une valeur absente côté PokeAPI est stockée `NULL`.
3. **Service** — les [`repositories/`](src/repositories/) relisent ces tables et reconstruisent les structures servies ; le serveur Express applique ensuite, à la volée, la vue mono-langue demandée.

## Prérequis

- **Node.js** ≥ 18 (l'API `fetch` native est utilisée)
- **npm**

## Installation

```bash
git clone <url-du-dépôt>
cd api-pokedex
npm install
```

## Peuplement de la base (seed)

La base `pokemon.db` doit être remplie avant de démarrer l'API. Le seed interroge la PokeAPI (≈ 7 700 requêtes, environ une minute).

```bash
# importe types, Pokémon (espèces, évolutions, capacités, attaques, rencontres), objets et baies
npm run seed:pokemon
```

Le seed ne modifie jamais la base en service pendant l'import :

1. il construit une base neuve dans `pokemon.db.tmp` ;
2. il la valide : intégrité SQLite, clés étrangères, chaque Pokémon a une espèce, des types et des stats, et les volumes ne baissent pas de plus de 5 % par rapport à la base actuelle ;
3. si tout est bon, il remplace `pokemon.db` et garde l'ancienne dans `pokemon.db.bak`. Sinon, `pokemon.db` reste intacte et la base générée est conservée pour inspection.

Chaque ressource n'est téléchargée qu'une fois (une attaque partagée par 500 Pokémon ne fait qu'une requête). Les erreurs réseau et les réponses 429/5xx sont réessayées avec un délai croissant.

> Sous Windows, arrêtez l'API avant le remplacement (le fichier est verrouillé), puis redémarrez-la. Une base dont le schéma ne correspond pas est refusée au démarrage avec un message explicite.

Le comportement du seed est ajustable via variables d'environnement (voir [Configuration](#configuration)). Exemples :

```bash
SEED_MAX=25 DB_PATH=./test.db npm run seed:pokemon   # import de test sur 25 Pokémon (jamais mis en service)
SEED_CACHE_DIR=.cache/pokeapi npm run seed:pokemon   # garde les réponses brutes : un 2e passage est quasi instantané
```

## Démarrage

```bash
# développement (rechargement à chaud)
npm run dev

# production
npm run build
npm start
```

Par défaut l'API écoute sur **http://localhost:4000**.

## Configuration

Toutes les variables sont optionnelles. Elles peuvent être définies dans l'environnement ou un fichier `.env`.

### Serveur

| Variable  | Défaut       | Description |
| --------- | ------------ | ----------- |
| `PORT`    | `4000`       | Port d'écoute du serveur HTTP. |
| `DB_PATH` | `./pokemon.db` | Chemin du fichier SQLite. |

### Seed

| Variable                   | Défaut | Description |
| -------------------------- | ------ | ----------- |
| `DB_PATH`                  | `./pokemon.db` | Base cible (la base temporaire est `<DB_PATH>.tmp`). |
| `SEED_CONCURRENCY`         | `10`   | Requêtes HTTP simultanées max vers la PokeAPI. |
| `SEED_POKEMON_CONCURRENCY` | `4`    | Pokémon traités en parallèle. |
| `SEED_RETRIES`             | `5`    | Nouvelles tentatives par requête en échec (erreur réseau, 429, 5xx). |
| `SEED_MAX`                 | `0`    | Nombre max de Pokémon à traiter (`0` = tous). Une base partielle n'est jamais mise en service. |
| `SEED_CACHE_DIR`           | —      | Dossier de cache disque (gzip) des réponses PokeAPI. Désactivé par défaut. |
| `SEED_FORCE`               | —      | `1` = met la base en service malgré des échecs ou des volumes en baisse. |

## Référence de l'API

Base URL : `http://localhost:4000`

| Méthode | Endpoint                       | Description | `?lang` |
| ------- | ------------------------------ | ----------- | :-----: |
| `GET`   | `/pokemon`                     | Liste de tous les Pokémon (résumé + espèce). | ✅ |
| `GET`   | `/pokemon/:query`              | Détail d'un Pokémon par `id` ou `name`. | ✅ |
| `GET`   | `/pokemon/:query/stats`        | Statistiques de base. | — |
| `GET`   | `/pokemon/:query/abilities`    | Capacités (avec indicateur `is_hidden`). | ✅ |
| `GET`   | `/pokemon/:query/moves`        | Attaques apprises. | ✅ |
| `GET`   | `/pokemon/:query/evolution`    | Chaîne d'évolution. | — |
| `GET`   | `/pokemon/:query/encounters`   | Zones de rencontre, groupées par version. | — |
| `GET`   | `/types`                       | Liste des types (nom EN/FR). | — |
| `GET`   | `/type/:query`                 | Détail d'un type par `id` ou `name` (relations de dégâts). | ✅ |
| `GET`   | `/items`                       | Liste des objets. | ✅ |
| `GET`   | `/berries`                     | Liste des baies. | ✅ |

> `:query` accepte indifféremment l'identifiant numérique (`25`) ou le nom (`pikachu`).

### Exemples

```bash
# Détail d'un Pokémon en français
curl "http://localhost:4000/pokemon/pikachu?lang=fr"

# Capacités par identifiant, en anglais
curl "http://localhost:4000/pokemon/6/abilities?lang=en"

# Chaîne d'évolution
curl "http://localhost:4000/pokemon/bulbasaur/evolution"
```

### Codes de réponse

| Code  | Signification |
| ----- | ------------- |
| `200` | Succès. |
| `404` | Ressource introuvable. |
| `500` | Erreur interne (le détail figure dans le champ `error`). |

## Localisation (`?lang`)

Les endpoints marqués `✅` acceptent le paramètre `?lang=en` ou `?lang=fr` :

- **Avec `?lang`** — les champs textuels sont renvoyés dans la langue demandée (vue mono-langue « prête à afficher »), avec repli sur l'autre langue si une traduction manque.
- **Sans `?lang`** — la réponse contient les deux langues (structure `{ en, fr }`), utile pour un client qui gère lui-même le basculement.

Une valeur `lang` invalide est ignorée (comportement identique à l'absence du paramètre).

## Structure du projet

```
api-pokedex/
├── schema.sql            # Schéma SQLite relationnel (tables + contraintes)
├── pokemon.db            # Base générée par le seed
├── scripts/
│   ├── init-db.ts        # Crée une base vide au schéma courant
│   ├── seed.ts           # Orchestration du seed (import, validation, mise en service)
│   └── seed/
│       ├── http.ts       #   client PokeAPI : concurrence, retry, déduplication, cache disque
│       ├── schemas.ts    #   schémas Zod des réponses PokeAPI
│       ├── transform.ts  #   réponse PokeAPI -> lignes SQL (fonctions pures)
│       ├── writer.ts     #   insertions
│       └── publish.ts    #   validation + remplacement de pokemon.db
└── src/
    ├── server.ts         # Point d'entrée (écoute du port)
    ├── app.ts            # App Express : middlewares, routeurs, gestion d'erreurs
    ├── db.ts             # Connexion SQLite + contrôle de version du schéma
    ├── schema.ts         # Application de schema.sql + SCHEMA_VERSION (PRAGMA user_version)
    ├── pokeapi.ts        # Client fetch générique + schémas Zod PokeAPI
    ├── lookups.ts        # Tables de traduction mises en cache (noms de types)
    ├── routes/           # Handlers HTTP (pokemon.ts, catalog.ts)
    ├── repositories/     # Accès SQLite (requêtes préparées une seule fois)
    ├── lib/              # Utilitaires : cache, HTTP, JSON, localisation
    ├── services/         # Normalisation par ressource
    │   ├── species.ts    #   (species, evolution, stats, abilities,
    │   ├── evolution.ts  #    moves, encounters, types, items, berries)
    │   └── ...
    └── types/            # Types partagés et vues mono-langue
```

Chaque module de [`src/services/`](src/services/) définit la structure bilingue servie par l'API (`*Stored`) et sa projection mono-langue `to*Lang(...)`. Les [`repositories/`](src/repositories/) construisent ces structures `*Stored` à partir des tables.

Toute modification incompatible de `schema.sql` doit incrémenter `SCHEMA_VERSION` dans [`src/schema.ts`](src/schema.ts).

### Performances

- Les listes (`/pokemon`, `/items`, `/berries`, `/types`) sont calculées, sérialisées et compressées en gzip **une seule fois par langue**, puis servies depuis la mémoire.
- Ce cache est invalidé automatiquement dès qu'une autre connexion écrit dans la base (`PRAGMA data_version`). Le seed remplaçant le fichier `pokemon.db`, il faut en revanche redémarrer l'API après un seed.
- Les autres réponses sont compressées à la volée (middleware `compression`).

## Scripts npm

| Script               | Action |
| -------------------- | ------ |
| `npm run dev`        | Démarre le serveur en développement (rechargement à chaud). |
| `npm run build`      | Compile TypeScript vers `dist/`. |
| `npm start`          | Lance le serveur compilé (`dist/server.js`). |
| `npm run init-db`    | Crée une base vide au schéma courant. |
| `npm run seed:pokemon` | Importe les données depuis la PokeAPI. |

## Crédits

Données fournies par la [PokeAPI](https://pokeapi.co/). Ce projet n'est pas affilié à Nintendo, Game Freak ni The Pokémon Company.
