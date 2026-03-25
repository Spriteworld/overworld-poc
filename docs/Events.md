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
| `item-pickup` | Phaser → Vue | Player picked up an item. Payload: item data. |

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
| `battle-complete` | `BattleScene2` state machine | `OverworldUI` | Battle ended. Payload: `{ result: 'won' \| 'lost' \| 'run' }`. |

### battle-start payload

```js
{
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

```js
{ result: 'won' | 'lost' | 'run' }
```

Emitted by `BattleWon`, `BattleLost`, and `BattleEnd` states inside `@spriteworld/battle`.

On receipt, `OverworldUI` reads `BattleScene2.config.player.team.pokemon` directly from the live scene to obtain updated HP and PP, then commits `party/SYNC_AFTER_BATTLE` before starting the fade-out transition.
