# Events

Two event channels are used in this project:

- **`EventBus`** (`src/utilities/EventBus.js`) — cross-boundary Vue↔Phaser communication
- **`game.events`** — cross-scene Phaser communication (global Phaser EventEmitter)

## EventBus Events

### General

| Event | Direction | Description |
|-------|-----------|-------------|
| `current-scene-ready` | Phaser → Vue | Fired by a scene when it finishes `create()`. Passes the scene instance. |
| `toast` | any → Phaser | Display a toast notification. Payload: `string`. |

### Player

| Event | Direction | Description |
|-------|-----------|-------------|
| `player-move-complete` | Phaser → Vue | Player finished a grid step. Payload: `{ x, y }`. |
| `player-move-enable` | any → Phaser | Re-enable player movement (e.g. after textbox closes). |
| `player-move-disable` | any → Phaser | Disable player movement (e.g. when textbox opens). |
| `interact-with-obj` | Phaser → any | Player pressed interact (Z) on an object. Payload: object data. |
| `item-pickup` | Phaser → any | Item picked up after dialog closes. Payload: `string` (item name) or `{ name, qty }` (NPC gift). `OverworldUI` commits the bag mutation on receipt. |

### Textbox

| Event | Direction | Description |
|-------|-----------|-------------|
| `textbox-changedata` | any → OverworldUI | Display textbox with text. Payload: BBCode string. Also disables player movement. |
| `textbox-complete` | OverworldUI → any | Textbox reached the last page. |
| `textbox-disable` | OverworldUI → any | Textbox was dismissed. Also re-enables player movement. |

### Menus

| Event | Pattern | Description |
|-------|---------|-------------|
| Menu selection | `{menu-name}-select-option-{idx}` | Fired when a menu option is confirmed. |

## game.events (Cross-Scene)

These are emitted on `this.game.events` / `scene.game.events` so all running scenes can hear them.

| Event | Emitter | Listener | Description |
|-------|---------|----------|-------------|
| `battle-start` | `encounter.js` | `OverworldUI` | Trigger a wild encounter. Payload: full battle data object (see Architecture.md). |
| `battle-complete` | `BattleScene2` state machine | `OverworldUI` | Battle ended. Payload varies by result — see below. |
| `map-enter` | `GameMap.loadMap()` | `OverworldUI` | A map scene finished loading. Payload: `mapName` string. `OverworldUI` shows it as a toast. |
| `overworld-item-result` | `BagTeamPickScreen` | `OverworldUI` | An overworld item use triggered an evolution. Payload: `{ pid: string, readyToEvolve: number }` where `readyToEvolve` is the target species `nat_dex_id`. |

### battle-start payload

```js
{
  tilesetBaseUrl: string,           // base URL of the pokemon tileset directory (trailing slash)
  textSpeed: string,                // 'normal' | 'fast' | 'instant' — mirrors store.state.game.textSpeed
  field:  { weather: string | null, terrain: string },
  player: {
    name: string,
    team: PokemonConfig[],          // deep-cloned from store.state.party.list
    inventory: { items: [], pokeballs: [], tms: [] },
  },
  enemy: {
    isTrainer: boolean,
    name: string,
    team: PokemonConfig[],
  },
}
```

The player team is a deep clone of the current party — changes inside the battle do not affect the store until `battle-complete` fires and `OverworldUI` commits `party/SYNC_AFTER_BATTLE`.

### battle-complete payload

Result varies by how the battle ended:

**Won / Lost / Run:**
```js
{ result: 'won' | 'lost' | 'run' }
```
Emitted by `BattleWon`, `BattleLost`, and `BattleEnd` states.

**Caught:**
```js
{
  result: 'caught',
  caughtPokemon: {
    pid, species, level, nature, gender, ability,
    ivs, evs, moves, currentHp, exp, status, pokerus, isShiny,
  },
  team: PokemonConfig[],   // serialised snapshot of the full player team post-battle
}
```
Emitted by the `PokemonCaught` state after the battle logger flushes.

On receipt, `OverworldUI` reads `BattleScene2.config.player.team.pokemon` directly from the live scene to obtain updated HP and PP, then commits `party/SYNC_AFTER_BATTLE` before starting the fade-out transition. For `result: 'caught'` it additionally commits `pokedex/CATCH` for the captured species.

### overworld-item-result payload

```js
{ pid: string, readyToEvolve: number }
```

`pid` identifies the party Pokémon; `readyToEvolve` is the target species `nat_dex_id`.

On receipt, `OverworldUI` closes the pause menu, disables player input, and launches `EvolutionScene` with `canCancel: true`. When the scene completes it commits `party/EVOLVE` (on confirm) or `party/CLEAR_READY_TO_EVOLVE` (on cancel), then re-enables player input.
