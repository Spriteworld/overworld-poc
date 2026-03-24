## Intro

A POC recreation of Gen3 Pokemon overworld and battle mechanics using Phaser 3. Things change frequently — it's a POC. Maps cover the Kanto region plus various test maps.

> For fun. PRs and contributions welcome. Discord: tZeFkKK3bA

## Getting Started

```bash
npm install        # installs deps — requires ../data and ../battle-claude sibling dirs
npm run dev        # dev server at http://localhost:8085
npm run build      # production build → dist/
npx jest           # run tests
```

## Directory Structure

```
src/
├── data/          # Game config, debug flags, game state, default party
├── maps/          # Tiled JSON maps (kanto/ and random/)
├── objects/       # Game objects — characters, items, interactable plugins, GameMap
├── scenes/        # Phaser scenes — maps, misc (Preload, OverworldUI, TimeOverlay)
├── tileset/       # Spritesheets and tilesets (32×32 px world grid)
└── utilities/     # EventBus, textbox, tile helpers
```

Two sibling packages are required:
- `../data` (`@spriteworld/pokemon-data`) — Pokédex, moves, natures, stats
- `../battle-claude` (`@spriteworld/battle`) — battle engine (BattleScene2)

## Building a Map

Maps are Tiled JSON files. Required layers (bottom to top):

| Layer | Purpose |
|-------|---------|
| `floor` | Walkable base layer |
| `ground` | Furniture, buildings, signs |
| `top` | Renders in front of characters (tree tops, roofs) |
| `sky` | Background sky layer |

Additional layers can be inserted between these as needed.

### Interactions Object Layer

Every dynamic object goes on an object layer named `interactions`. Object type definitions (used by both Phaser and Tiled) are in `src/tileset/objecttypes.json`.

| Type | Description |
|------|-------------|
| `playerSpawn` | Player starting position |
| `npc` | NPC/trainer — facing direction, movement config |
| `pkmn` | Overworld Pokémon sprite |
| `sign` | Readable sign — `text` property |
| `warp` | Teleport to another map or position |
| `layerTransition` | Move player between render layers |
| `encounters` | Wild Pokémon zone (rectangle or polygon) |
| `slidetile` | Ice slide tile |
| `spintile` | Spin tile |
| `ledge` | Jumpable ledge |
| `cuttree` | Requires Cut HM |
| `strengthboulder` | Requires Strength HM |
| `item` | Collectible item |
| `light` | Lighting overlay zone |

See `src/tileset/objecttypes.json` for the full property list for each type.

## Architecture

See [docs/Architecture.md](docs/Architecture.md) for a full breakdown of the two-layer Vue/Phaser system, scene hierarchy, interactable plugin system, and battle integration.

## Events

See [docs/Events.md](docs/Events.md) for all EventBus and game.events signals.
