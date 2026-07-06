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

1. **Seed** — le script `scripts/seed.ts` récupère et normalise les données de la PokeAPI, puis les écrit dans `pokemon.db`.
2. **Persistance** — chaque ressource est stockée sous forme de colonnes indexables + un blob `*_json` contenant le détail normalisé (voir [`schema.sql`](schema.sql)).
3. **Service** — le serveur Express lit uniquement la base locale et applique, à la volée, la vue mono-langue demandée.

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

La base `pokemon.db` doit être remplie avant de démarrer l'API. Le seed interroge la PokeAPI et peut prendre plusieurs minutes.

```bash
# (optionnel) initialise le schéma sans importer de données
npm run init-db

# importe types, items, baies puis l'ensemble des Pokémon
npm run seed:pokemon
```

Le comportement du seed est ajustable via variables d'environnement (voir [Configuration](#configuration)). Pour un import rapide de test :

```bash
SEED_MAX=25 npm run seed:pokemon   # ne traite que 25 Pokémon
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

| Variable             | Défaut | Description |
| -------------------- | ------ | ----------- |
| `SEED_PAGE_LIMIT`    | `200`  | Taille de page lors du parcours de la liste des Pokémon. |
| `SEED_OFFSET`        | `0`    | Décalage de départ dans la liste. |
| `SEED_MAX`           | `0`    | Nombre max de Pokémon à traiter (`0` = tous). |
| `SEED_DELAY_MS`      | `60`   | Délai (ms) entre chaque requête, pour ménager la PokeAPI. |
| `SEED_TYPES_BATCH`   | `8`    | Taille des lots parallèles pour les types. |
| `SEED_ITEMS_BATCH`   | `40`   | Taille des lots parallèles pour les objets. |
| `SEED_BERRIES_BATCH` | `40`   | Taille des lots parallèles pour les baies. |
| `MOVES_MAX`          | `0`    | Limite d'attaques hydratées par Pokémon (`0` = toutes). |

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
├── schema.sql            # Schéma SQLite (tables + contraintes)
├── pokemon.db            # Base générée par le seed
├── scripts/
│   ├── init-db.ts        # Crée le schéma
│   └── seed.ts           # Importe les données depuis la PokeAPI
└── src/
    ├── server.ts         # Serveur Express et routes
    ├── db.ts             # Connexion SQLite + initialisation du schéma
    ├── pokeapi.ts        # Clients fetch + schémas Zod PokeAPI
    ├── services/         # Normalisation par ressource
    │   ├── species.ts    #   (species, evolution, stats, abilities,
    │   ├── evolution.ts  #    moves, encounters, types, items, berries)
    │   └── ...
    └── types/            # Types partagés et vues mono-langue
```

Chaque module de [`src/services/`](src/services/) expose deux responsabilités :
- `pick*Details(...)` — extrait et normalise la donnée brute de la PokeAPI (utilisé au seed) ;
- `to*Lang(...)` — projette la donnée stockée bilingue vers une vue mono-langue (utilisé au service).

## Scripts npm

| Script               | Action |
| -------------------- | ------ |
| `npm run dev`        | Démarre le serveur en développement (rechargement à chaud). |
| `npm run build`      | Compile TypeScript vers `dist/`. |
| `npm start`          | Lance le serveur compilé (`dist/server.js`). |
| `npm run init-db`    | Crée le schéma SQLite. |
| `npm run seed:pokemon` | Importe les données depuis la PokeAPI. |

## Crédits

Données fournies par la [PokeAPI](https://pokeapi.co/). Ce projet n'est pas affilié à Nintendo, Game Freak ni The Pokémon Company.
