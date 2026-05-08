import { Tile } from '@Objects';
import { Pokedex, buildMon } from '@spriteworld/pokemon-data';
import { gameState } from '@Data/gameState.js';
import { getPropertyValue, getBattleTheme } from '@Utilities';
import { getGameDef, filterByAvailablePokemon, seededRng } from '@Data/gameDef.js';
import Tileset from '@Tileset';
import { rng } from '@Utilities/rng.js';
import store from '../../store/index.js';
import { buildBattleInventory } from './encounter.js';
import Reflection from '@Objects/characters/Reflection.js';

/** Default percentage of encounter-zone tiles that spawn a visible OW Pokémon. */
const DEFAULT_DENSITY = 3; // 3 %

/**
 * Extra margin (in tiles) added around the camera viewport when deciding
 * whether to keep an OW encounter spawned. Large enough that no sprite can
 * ever appear or vanish on-screen — spawns happen strictly off-camera.
 */
const SPAWN_MARGIN_TILES = 4;

const WILD_LEVEL_MIN = 3;
const WILD_LEVEL_MAX = 8;

const OW_ENC_PREFIX = 'ow_enc_';

// ── Level-aware reactive behaviour tuning ─────────────────────────────────────
/** Tiles within which a mon can notice the player (Manhattan). */
const DETECTION_RADIUS        = 5;
/** Per-player-step chance that an eligible mon reacts. */
const REACTION_CHANCE         = 0.25;
/** Player-steps of cooldown after a reaction ends before the same mon can re-react. */
const REACTION_COOLDOWN_STEPS = 5;
/** mon.level ≥ lead + N → eligible to chase. */
const LEVEL_CHASE_THRESHOLD   = 3;
/** lead.level ≥ mon + N → eligible to flee. */
const LEVEL_FLEE_THRESHOLD    = 3;
/** Tiles a chaser walks before giving up. */
const CHASE_TILE_BUDGET       = 5;
/** Tiles a fleer walks before resuming normal wandering. */
const FLEE_TILE_BUDGET        = 4;
/** Hard time cap on a chase/flee reaction (ms). */
const CHASE_MAX_MS            = 8000;
/** If no step is taken for this long during a reaction (ms), give up. */
const BLOCKED_TIMEOUT_MS      = 1500;
/** GridEngine tile-speed during chase (moveRandomly default ≈ 3). */
const CHASE_SPEED             = 6;
/** GridEngine tile-speed during flee. */
const FLEE_SPEED              = 5;
/** Duration of the `!` exclamation before the chaser starts moving (ms). */
const EXCLAIM_MS              = 700;
/** Default GridEngine tile-speed to restore after a reaction. */
const DEFAULT_SPEED           = 3;
/** Shared `!` animation key (matches `src/scriptrunner/commands/character.js`). */
const EXCLAIM_ANIM_KEY        = 'trainer-spotted';

function pickWeighted(entries) {
  const total = entries.reduce((sum, e) => sum + e.rarity, 0);
  let r = rng() * total;
  for (const e of entries) {
    r -= e.rarity;
    if (r <= 0) return e;
  }
  return entries[entries.length - 1];
}

/** Ray-cast point-in-polygon test (pixel space). */
function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/** djb2 hash → unsigned 32-bit integer. */
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}

/** Two pixel rectangles touch (share an edge/corner) or overlap. */
function rectsNeighbor(a, b) {
  return a.x <= b.x + b.width
      && b.x <= a.x + a.width
      && a.y <= b.y + b.height
      && b.y <= a.y + a.height;
}

/**
 * Handles visible overworld Pokémon encounters.
 *
 * On init() a small random subset of the map's encounter-zone tiles is chosen
 * (controlled by `ow-encounter-rate` in map-settings, default 3 %) and their
 * battle data is **pre-generated** so the species the player sees matches what
 * they will fight.  No sprites are created yet — they are held in `_pending`.
 *
 * On event(), the plugin subscribes to GridEngine position changes.  Each time
 * the player moves, any pending spawn within SPAWN_RADIUS tiles has its sprite
 * created via `pokemon.addToScene()`, which lazy-loads the texture through
 * Phaser's runtime loader (`scene.load.spritesheet` + `scene.load.start()`).
 * This means no Pokémon textures are queued at map creation time; they are
 * only loaded when the player is close enough to see the sprite.
 *
 * When the player steps onto an active spawn tile the pre-built battle config
 * is emitted via 'battle-start'.  The Pokémon disappears after the battle
 * regardless of outcome.
 *
 * Global toggle: `getGameDef().owEncounters`.
 * Per-map toggle: `map-settings['ow-encounters'] = false` disables on that map.
 * Per-map density: `map-settings['ow-encounter-rate']` (integer %, default 3).
 *
 * Respects the same `game.config.debug.noEncounters` flag as grass encounters.
 */
export default class OverworldEncounter {
  constructor(scene) {
    this.scene      = scene;
    this._pending   = []; // [{ x, y, texture, battleConfig }]      — not yet spawned
    this._active    = []; // [{ x, y, sprite, battleConfig }]       — sprite live
    this._sub       = null; // positionChangeStarted — battle trigger
    this._spawnSub  = null; // positionChangeFinished — spawn/despawn by route
    this._locations     = []; // [{ name, x, y, width, height, tableNames }] — map location objects (pixels)
    this._mapTableNames = []; // table names from map-level encounter-table
    this._movePool      = null;
    /**
     * Per-mon reaction state, keyed by GridEngine id.
     * { mode: 'neutral'|'chase'|'flee'|'battling',
     *   stepsLeft, cooldownLeft, startedAt, lastMoveAt,
     *   origRate, origRadius, exclaimSprite, exclaimTimer }
     */
    this._behaviour = {};
  }

  init() {
    // Global game-definition toggle
    if (!getGameDef().owEncounters) return;

    const mapProps    = this.scene.config?.tilemap?.properties ?? [];
    const mapSettings = getPropertyValue(mapProps, 'map-settings') ?? {};

    // Per-map opt-out
    if (mapSettings['ow-encounters'] === false) return;

    const mapDensity = (mapSettings['ow-encounter-rate'] ?? DEFAULT_DENSITY) / 100;

    // Build encounter table (mirrors encounter.js logic)
    const tableFragments = [];
    this._mapTableNames = [];
    if (mapSettings['encounter-table']) {
      tableFragments.push(mapSettings['encounter-table']);
      this._mapTableNames = this._extractTableNames(mapSettings['encounter-table']);
    }
    if (this.scene.config.tilemap.getObjectLayer('maps')) {
      const locationObjs = this.scene.config.tilemap.filterObjects(
        'maps', obj => obj.type === 'location'
      ) ?? [];
      for (const obj of locationObjs) {
        const objSettings = getPropertyValue(obj.properties ?? [], 'map-settings');
        this._locations.push({
          name: obj.name, x: obj.x, y: obj.y, width: obj.width, height: obj.height,
          tableNames: [],
          owEncounterRate: objSettings?.['ow-encounter-rate'] ?? null,
        });
        if (objSettings?.['encounter-table']) {
          tableFragments.push(objSettings['encounter-table']);
          this._locations[this._locations.length - 1].tableNames = this._extractTableNames(objSettings['encounter-table']);
        }
      }
    }

    const encounterTable = this._parseEncounterTable(tableFragments);

    const allTiles = this._collectEncounterTiles(encounterTable);
    if (allTiles.length === 0) return;

    for (const tile of allTiles) {
      const density = this._tileDensity(tile, mapDensity);
      if (rng() >= density) continue;

      const battleConfig = this._buildBattleConfig(tile, encounterTable);
      if (!battleConfig) continue;

      const mon = battleConfig.enemy.team[0];
      const speciesId = String(mon.species).padStart(3, '0');
      const texture   = mon.isShiny ? speciesId + 's' : speciesId;
      this._pending.push({
        x: tile.x,
        y: tile.y,
        texture,
        battleConfig,
        isWater: tile.section === 'surf',
      });
    }
  }

  update() {
    const ge = this.scene.gridEngine;
    const playerPos = ge?.hasCharacter('player') ? ge.getPosition('player') : null;

    for (const spawn of this._active) {
      const b = this._behaviour[spawn.geId];
      if (!b) continue;

      spawn.sprite?._reflection?.update();

      // Pin any active `!` sprite to the visual top of its mon. The mon is
      // tweened by GridEngine each frame, so a static placement at exclaim-
      // creation time would lag behind a moving sprite.
      if (b.exclaimSprite && spawn.sprite?.active) {
        const bounds = spawn.sprite.getBounds();
        b.exclaimSprite.x = bounds.centerX;
        b.exclaimSprite.y = bounds.top - 2;
      }

      // Per-frame collision check. Symmetric with the player-side trigger
      // (which fires when the player steps onto a mon's tile): if the mon
      // ends up colliding with the player it starts the battle, regardless
      // of which side moved or what GridEngine fired. Tolerance differs by
      // mode — a chaser counts as having caught up at adjacency (dist ≤ 1),
      // a wandering mon must literally land on the player's tile (dist == 0)
      // because we don't want every passing mon to trigger from one tile away.
      if (b.mode !== 'battling' && playerPos && ge?.hasCharacter(spawn.geId)) {
        const monPos = ge.getPosition(spawn.geId);
        if (monPos) {
          const dist  = Math.abs(playerPos.x - monPos.x) + Math.abs(playerPos.y - monPos.y);
          const limit = b.mode === 'chase' ? 1 : 0;
          if (dist <= limit) this._triggerBattleFromChase(spawn);
        }
      }
    }
  }

  event() {
    if (this._pending.length === 0 && this._active.length === 0) return;

    // Spawn anything near the player's starting position before first movement.
    const startPos = this.scene.gridEngine.getPosition('player');
    if (startPos) this._syncSpawns(startPos);

    // Battle trigger — positionChangeStarted fires before GE finalises the move.
    // We look up each active spawn's current GE position since the Pokémon is
    // wandering via moveRandomly.
    this._sub = this.scene.gridEngine.positionChangeStarted().subscribe(({ charId, enterTile }) => {
      if (charId !== 'player') return;
      if (this.scene.game.config.debug.noEncounters) return;

      const spawn = this._active.find(s => {
        if (!s.geId || !this.scene.gridEngine.hasCharacter(s.geId)) {
          return s.x === enterTile.x && s.y === enterTile.y;
        }
        const pos = this.scene.gridEngine.getPosition(s.geId);
        return pos && pos.x === enterTile.x && pos.y === enterTile.y;
      });
      if (!spawn) return;
      // If a chaser already fired battle-start this same tick, don't double-fire.
      const b = spawn.geId && this._behaviour[spawn.geId];
      if (b?.mode === 'battling') return;
      if (b) b.mode = 'battling';

      // Refresh the player half of the pre-built battleConfig so the battle
      // sees the LIVE party + bag — not the snapshot taken at map load.
      this._refreshPlayerSide(spawn.battleConfig);

      this.scene.game.events.emit('battle-start', spawn.battleConfig);
      this.scene.game.events.once('battle-complete', () => this._removeSpawn(spawn));
    });

    // Spawn/despawn by route — positionChangeFinished fires after GE completes
    // the move, so addCharacter() calls inside addToScene() are safe here. Also
    // drives chase/flee step counting and overlap-nudging for OW mons.
    this._spawnSub = this.scene.gridEngine.positionChangeFinished().subscribe(({ charId, enterTile }) => {
      if (charId === 'player') {
        this._syncSpawns(enterTile);
        this._tickBehaviour(enterTile);
      } else if (typeof charId === 'string' && charId.startsWith(OW_ENC_PREFIX)) {
        this._onMonStepFinished(charId, enterTile);
        this._nudgeIfOverlapping(charId);
      }
    });
  }

  destroy() {
    this._sub?.unsubscribe();
    this._spawnSub?.unsubscribe();
    // Clean up any in-flight `!` sprites / timers so they don't leak past the
    // scene transition. GE characters are torn down automatically with the scene.
    for (const b of Object.values(this._behaviour)) {
      if (b.exclaimTimer)  b.exclaimTimer.remove?.(false);
      if (b.exclaimSprite) b.exclaimSprite.destroy();
      if (b.startTimer)    b.startTimer.remove?.(false);
      if (b.wanderTimer)   b.wanderTimer.remove?.(false);
    }
    this._behaviour = {};
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  /**
   * Spawn pending entries whose origin tile lies in a location the player is
   * currently in or next to, and despawn active entries whose origin tile is
   * outside that set. Despawned entries are moved back to `_pending` so they
   * respawn if the player re-enters the area.
   *
   * Falls back to a Manhattan-distance radius when the map has no location
   * objects on the `maps` layer (e.g. small test maps).
   *
   * @param {{ x:number, y:number }} playerTile
   */
  _syncSpawns(playerTile) {
    // Screen-sized + 4-tile-margin bounding box around the player. Using per-
    // axis half-extents (Chebyshev-style, not Manhattan) so the active region
    // matches the camera's visible rectangle instead of a diamond, which is
    // what caused sprites to pop in/out along the screen edges.
    const cam      = this.scene.cameras?.main;
    const halfW    = cam ? Math.ceil(cam.width  / Tile.WIDTH  / 2) : 13;
    const halfH    = cam ? Math.ceil(cam.height / Tile.HEIGHT / 2) : 10;
    const maxDX    = halfW + SPAWN_MARGIN_TILES;
    const maxDY    = halfH + SPAWN_MARGIN_TILES;
    const inSet    = (tx, ty) =>
      Math.abs(tx - playerTile.x) <= maxDX &&
      Math.abs(ty - playerTile.y) <= maxDY;

    // Despawn anything outside the active set — move back to _pending.
    const stillActive = [];
    for (const s of this._active) {
      if (inSet(s.x, s.y)) {
        stillActive.push(s);
      } else {
        this._despawnToPending(s);
      }
    }
    this._active = stillActive;

    // Spawn anything pending that's now in range.
    const stillPending = [];
    for (const p of this._pending) {
      if (!inSet(p.x, p.y)) { stillPending.push(p); continue; }
      const result = this._spawnVisualSprite(p);
      if (!result) { stillPending.push(p); continue; }
      this._active.push({
        x: p.x,
        y: p.y,
        sprite: result.sprite,
        geId:   result.geId,
        battleConfig: p.battleConfig,
        isWater: !!p.isWater,
      });
    }
    this._pending = stillPending;
  }

  /**
   * The locations the player is currently in, union with their neighbours.
   * Two locations are neighbours when their pixel rectangles touch or overlap.
   */
  _activeLocations(playerTile) {
    const px = playerTile.x * Tile.WIDTH  + Tile.WIDTH  / 2;
    const py = playerTile.y * Tile.HEIGHT + Tile.HEIGHT / 2;
    const here = this._locations.filter(loc =>
      px >= loc.x && px <= loc.x + loc.width &&
      py >= loc.y && py <= loc.y + loc.height
    );
    if (here.length === 0) return [];
    const result = new Set(here);
    for (const loc of this._locations) {
      if (result.has(loc)) continue;
      for (const h of here) {
        if (rectsNeighbor(loc, h)) { result.add(loc); break; }
      }
    }
    return [...result];
  }

  /**
   * If another OW encounter mon is standing on the same tile as `geId`, push
   * `geId` onto the first walkable neighbour tile that isn't also occupied.
   * Two OW mons can share a tile because their `collisionGroups` is empty so
   * that the player can still walk through them to trigger a battle.
   */
  _nudgeIfOverlapping(geId) {
    const ge = this.scene.gridEngine;
    if (!ge?.hasCharacter(geId)) return;
    const pos   = ge.getPosition(geId);
    const layer = ge.getCharLayer?.(geId) ?? 'ground';

    const self    = this._active.find(s => s.geId === geId);
    const isWater = !!self?.isWater;

    const others = [];
    for (const s of this._active) {
      if (s.geId === geId || !s.geId) continue;
      if (!ge.hasCharacter(s.geId)) continue;
      const p = ge.getPosition(s.geId);
      if (p) others.push(p);
    }
    if (!others.some(o => o.x === pos.x && o.y === pos.y)) return;

    const candidates = [
      { dir: 'up',    dx:  0, dy: -1 },
      { dir: 'down',  dx:  0, dy:  1 },
      { dir: 'left',  dx: -1, dy:  0 },
      { dir: 'right', dx:  1, dy:  0 },
    ].sort(() => rng() - 0.5);

    for (const c of candidates) {
      const t = { x: pos.x + c.dx, y: pos.y + c.dy };
      if (isWater) {
        // Water mons have collidesWithTiles off — isBlocked would let them
        // slide onto land. Gate the nudge through the same water filter used
        // by _waterWanderStep so they stay in their region.
        if (!this.scene.isWaterTile?.(t.x, t.y)) continue;
        if (this.scene.hasNonWaterCollision?.(t.x, t.y)) continue;
      } else {
        if (ge.isBlocked(t, layer) !== false) continue;
      }
      if (others.some(o => o.x === t.x && o.y === t.y)) continue;
      ge.move(geId, c.dir);
      return;
    }
  }

  /**
   * Player stepped — decrement cooldowns, enforce time-based give-ups, and
   * maybe trigger a chase/flee reaction on mons within DETECTION_RADIUS.
   */
  _tickBehaviour(playerTile) {
    const ge       = this.scene.gridEngine;
    const lead     = gameState.party?.[0];
    const leadLvl  = typeof lead?.level === 'number' ? lead.level : null;
    const now      = this.scene.time?.now ?? 0;

    for (const spawn of this._active) {
      const b = this._behaviour[spawn.geId];
      if (!b) continue;

      // Time-based give-up for any in-progress reaction.
      if (b.mode === 'chase' || b.mode === 'flee') {
        if (now - b.startedAt  > CHASE_MAX_MS
         || now - b.lastMoveAt > BLOCKED_TIMEOUT_MS) {
          this._endReaction(spawn);
          continue;
        }
      }

      if (b.cooldownLeft > 0) b.cooldownLeft--;
      if (b.mode !== 'neutral' || b.cooldownLeft > 0) continue;
      // Water mons can't leave their water region, so chase/flee are skipped —
      // pathfinding would either land them on unreachable land or grind against
      // the shoreline.
      if (spawn.isWater) continue;
      if (leadLvl == null) continue;
      if (!ge?.hasCharacter(spawn.geId)) continue;

      const pos = ge.getPosition(spawn.geId);
      const dist = Math.abs(pos.x - playerTile.x) + Math.abs(pos.y - playerTile.y);
      if (dist > DETECTION_RADIUS) continue;

      const monLevel = spawn.battleConfig?.enemy?.team?.[0]?.level ?? 1;
      if (rng() >= REACTION_CHANCE) continue;

      if (monLevel - leadLvl >= LEVEL_CHASE_THRESHOLD)      this._beginChase(spawn);
      else if (leadLvl - monLevel >= LEVEL_FLEE_THRESHOLD)  this._beginFlee(spawn);
    }
  }

  /**
   * Stop wandering, show the `!` animation, then pathfind toward the player.
   * Gives up after CHASE_TILE_BUDGET tiles walked, a hard time cap, or when
   * no progress is made for BLOCKED_TIMEOUT_MS.
   */
  _beginChase(spawn) {
    const ge = this.scene.gridEngine;
    if (!ge?.hasCharacter(spawn.geId)) return;
    const b = this._behaviour[spawn.geId];
    if (!b) return;

    const now = this.scene.time?.now ?? 0;
    b.mode        = 'chase';
    b.stepsLeft   = CHASE_TILE_BUDGET;
    b.startedAt   = now;
    b.lastMoveAt  = now;

    ge.stopMovement(spawn.geId);
    this._playExclaim(spawn, () => {
      if (!ge.hasCharacter(spawn.geId)) return;
      if (this._behaviour[spawn.geId]?.mode !== 'chase') return;
      ge.setSpeed(spawn.geId, CHASE_SPEED);
      this._chaseStep(spawn);
    });
  }

  /**
   * Pathfind toward the player's current tile. Re-issued each step-finished
   * so the chaser keeps re-targeting as the player moves. If the mon is
   * already adjacent (or on the player's tile) trigger the battle directly,
   * because moveTo with CLOSEST_REACHABLE would just resolve to the mon's
   * current tile and never fire another positionChangeFinished event.
   */
  _chaseStep(spawn) {
    const ge = this.scene.gridEngine;
    if (!ge?.hasCharacter(spawn.geId)) return;
    const playerPos = ge.getPosition('player');
    if (!playerPos) return;
    const monPos = ge.getPosition(spawn.geId);
    if (monPos) {
      const dist = Math.abs(playerPos.x - monPos.x) + Math.abs(playerPos.y - monPos.y);
      if (dist <= 1) {
        this._triggerBattleFromChase(spawn);
        return;
      }
    }
    ge.moveTo(spawn.geId, playerPos, {
      noPathFoundStrategy: 'CLOSEST_REACHABLE',
      pathBlockedStrategy: 'WAIT',
    });
  }

  /**
   * Walk away from the player along the dominant axis of separation, up to
   * FLEE_TILE_BUDGET tiles. No `!` animation — fleers slink away quietly.
   */
  _beginFlee(spawn) {
    const ge = this.scene.gridEngine;
    if (!ge?.hasCharacter(spawn.geId)) return;
    const b = this._behaviour[spawn.geId];
    if (!b) return;

    const playerPos = ge.getPosition('player');
    if (!playerPos) return;
    const monPos = ge.getPosition(spawn.geId);
    const layer  = ge.getCharLayer?.(spawn.geId) ?? 'ground';

    // Unit vector away from player. Prefer dominant axis; fall back to the
    // other axis if the preferred one leads straight into a wall.
    const dxSign = Math.sign(monPos.x - playerPos.x) || (rng() < 0.5 ? -1 : 1);
    const dySign = Math.sign(monPos.y - playerPos.y) || (rng() < 0.5 ? -1 : 1);
    const axes = Math.abs(monPos.x - playerPos.x) >= Math.abs(monPos.y - playerPos.y)
      ? [{ dx: dxSign, dy: 0 }, { dx: 0, dy: dySign }]
      : [{ dx: 0, dy: dySign }, { dx: dxSign, dy: 0 }];

    let dest = null;
    for (const axis of axes) {
      for (let n = FLEE_TILE_BUDGET; n >= 1; n--) {
        const t = { x: monPos.x + axis.dx * n, y: monPos.y + axis.dy * n };
        if (ge.isBlocked(t, layer) === false) { dest = t; break; }
      }
      if (dest) break;
    }
    if (!dest) return;  // fully blocked — just keep wandering

    const now = this.scene.time?.now ?? 0;
    b.mode       = 'flee';
    b.stepsLeft  = FLEE_TILE_BUDGET;
    b.startedAt  = now;
    b.lastMoveAt = now;

    ge.stopMovement(spawn.geId);
    ge.setSpeed(spawn.geId, FLEE_SPEED);
    ge.moveTo(spawn.geId, dest, {
      noPathFoundStrategy: 'CLOSEST_REACHABLE',
      pathBlockedStrategy: 'STOP',
    });
  }

  /**
   * Show the `!` animation above the mon for EXCLAIM_MS, then invoke `after()`.
   * Registers the shared `trainer-spotted` animation once per scene.
   */
  _playExclaim(spawn, after) {
    const scene = this.scene;
    if (!scene.anims.exists(EXCLAIM_ANIM_KEY)) {
      scene.anims.create({
        key:       EXCLAIM_ANIM_KEY,
        frames:    scene.anims.generateFrameNumbers('animation', { start: 21, end: 24 }),
        frameRate: 10,
      });
    }
    const b = this._behaviour[spawn.geId];
    const bounds = spawn.sprite.getBounds();
    const ex = scene.add.sprite(
      bounds.centerX,
      bounds.top - 2,
      'animation',
      21,
    ).setOrigin(0.5, 1).setDepth(9999);
    ex.play(EXCLAIM_ANIM_KEY);
    if (b) b.exclaimSprite = ex;

    const timer = scene.time.delayedCall(EXCLAIM_MS, () => {
      ex.destroy();
      if (b && b.exclaimSprite === ex) { b.exclaimSprite = null; b.exclaimTimer = null; }
      after?.();
    });
    if (b) b.exclaimTimer = timer;
  }

  /**
   * Called on every OW mon's positionChangeFinished. Decrements reaction step
   * budgets and, for chasers that reached the player (same tile or adjacent),
   * fires the battle-start handoff. GridEngine pathfinding treats the player
   * as a tile obstacle, so a chaser typically stops on the adjacent tile
   * rather than landing exactly on the player — both cases trigger here.
   */
  _onMonStepFinished(charId, enterTile) {
    const b = this._behaviour[charId];
    if (!b || b.mode === 'neutral' || b.mode === 'battling') return;
    b.lastMoveAt = this.scene.time?.now ?? 0;

    const spawn = this._active.find(s => s.geId === charId);
    if (!spawn) return;

    if (b.mode === 'chase') {
      const playerPos = this.scene.gridEngine.getPosition('player');
      if (playerPos) {
        const dist = Math.abs(playerPos.x - enterTile.x) + Math.abs(playerPos.y - enterTile.y);
        if (dist <= 1) {
          this._triggerBattleFromChase(spawn);
          return;
        }
      }
      b.stepsLeft--;
      if (b.stepsLeft <= 0) { this._endReaction(spawn); return; }
      // Re-target the player for the next step.
      this._chaseStep(spawn);
    } else if (b.mode === 'flee') {
      b.stepsLeft--;
      if (b.stepsLeft <= 0) this._endReaction(spawn);
    }
  }

  /**
   * A chaser landed on the player's tile — emit `battle-start` with the same
   * contract as the player-side `positionChangeStarted` handler.
   */
  _triggerBattleFromChase(spawn) {
    if (this.scene.game.config.debug.noEncounters) { this._endReaction(spawn); return; }
    const b = this._behaviour[spawn.geId];
    if (b) b.mode = 'battling';
    this._refreshPlayerSide(spawn.battleConfig);
    this.scene.game.events.emit('battle-start', spawn.battleConfig);
    this.scene.game.events.once('battle-complete', () => this._removeSpawn(spawn));
  }

  /**
   * Overwrite `battleConfig.player.team` and `battleConfig.player.inventory`
   * with fresh snapshots of the LIVE party and bag. The pre-built battleConfig
   * is stamped at map load, so without this any level-ups, evolutions, hp
   * changes, or new gift mons since map entry would be ignored at battle start.
   */
  _refreshPlayerSide(battleConfig) {
    if (!battleConfig?.player) return;
    battleConfig.player.team = gameState.party.map(p => ({
      ...p,
      moves: p.moves.map(m => ({ ...m, pp: { ...m.pp } })),
      ivs:   { ...p.ivs },
      evs:   { ...p.evs },
    }));
    battleConfig.player.inventory = buildBattleInventory();
  }

  /**
   * End a chase/flee reaction: tear down the `!` sprite/timer, restore default
   * speed, resume wandering, and impose a per-mon cooldown.
   */
  _endReaction(spawn) {
    const ge = this.scene.gridEngine;
    const b  = this._behaviour[spawn.geId];
    if (!b) return;

    if (b.exclaimTimer)  { b.exclaimTimer.remove?.(false); b.exclaimTimer = null; }
    if (b.exclaimSprite) { b.exclaimSprite.destroy(); b.exclaimSprite = null; }

    if (ge?.hasCharacter(spawn.geId)) {
      ge.stopMovement(spawn.geId);
      ge.setSpeed(spawn.geId, DEFAULT_SPEED);
      ge.moveRandomly(spawn.geId, b.origRate, b.origRadius);
    }

    b.mode         = 'neutral';
    b.stepsLeft    = 0;
    b.cooldownLeft = REACTION_COOLDOWN_STEPS;
  }

  /**
   * One tick of water-restricted wandering for an OW mon on water. Picks a
   * random cardinal neighbour that is (a) within radius 2 of the spawn origin
   * and (b) an actual water tile free of non-water obstacles (rocks, cliffs).
   * Always reschedules itself after `rate` ms so rhythm persists even when no
   * step was possible.
   *
   * Water mons have `collidesWithTiles: false` (otherwise GE would refuse to
   * put them on water), so this filter is the only thing keeping them inside
   * the water area.
   */
  _waterWanderStep(geId, entry, rate) {
    const ge = this.scene.gridEngine;
    if (!ge?.hasCharacter(geId)) return;
    const b = this._behaviour[geId];
    if (!b) return;
    if (b.mode === 'battling') return;

    const pos = ge.getPosition(geId);
    if (pos) {
      const candidates = [
        { dir: 'up',    dx:  0, dy: -1 },
        { dir: 'down',  dx:  0, dy:  1 },
        { dir: 'left',  dx: -1, dy:  0 },
        { dir: 'right', dx:  1, dy:  0 },
      ].sort(() => rng() - 0.5);
      for (const c of candidates) {
        const tx = pos.x + c.dx;
        const ty = pos.y + c.dy;
        if (Math.abs(tx - entry.x) > 2 || Math.abs(ty - entry.y) > 2) continue;
        if (!this.scene.isWaterTile?.(tx, ty)) continue;
        if (this.scene.hasNonWaterCollision?.(tx, ty)) continue;
        ge.move(geId, c.dir);
        break;
      }
    }

    b.wanderTimer = this.scene.time.delayedCall(rate, () => {
      this._waterWanderStep(geId, entry, rate);
    });
  }

  _tileInLocations(tx, ty, locations) {
    const px = tx * Tile.WIDTH  + Tile.WIDTH  / 2;
    const py = ty * Tile.HEIGHT + Tile.HEIGHT / 2;
    for (const loc of locations) {
      if (px >= loc.x && px <= loc.x + loc.width
        && py >= loc.y && py <= loc.y + loc.height) return true;
    }
    return false;
  }

  /**
   * Tear down a live spawn's sprite/GE registration and push a pending-entry
   * equivalent back onto `_pending` so it can respawn on re-entry.
   */
  _despawnToPending(spawn) {
    const texture = spawn.sprite?.texture?.key;
    this._clearBehaviour(spawn.geId);
    try {
      if (spawn.geId && this.scene.gridEngine?.hasCharacter(spawn.geId)) {
        this.scene.gridEngine.stopMovement(spawn.geId);
        this.scene.gridEngine.removeCharacter(spawn.geId);
      }
      spawn.sprite?._reflection?.destroy();
      spawn.sprite?.destroy();
    } catch (_) {}
    this._pending.push({
      x: spawn.x,
      y: spawn.y,
      texture: texture && texture !== '__DEFAULT' ? texture : String(spawn.battleConfig?.enemy?.team?.[0]?.species ?? '').padStart(3, '0'),
      battleConfig: spawn.battleConfig,
      isWater: !!spawn.isWater,
    });
  }

  _clearBehaviour(geId) {
    const b = geId && this._behaviour[geId];
    if (!b) return;
    if (b.exclaimTimer)  b.exclaimTimer.remove?.(false);
    if (b.exclaimSprite) b.exclaimSprite.destroy();
    if (b.startTimer)    b.startTimer.remove?.(false);
    if (b.wanderTimer)   b.wanderTimer.remove?.(false);
    delete this._behaviour[geId];
  }

  /**
   * Create a Phaser sprite for a pending OW encounter entry and register it
   * with GridEngine so it can wander via `moveRandomly`. Battle trigger still
   * reads the spawn's live GE position (see `event()`).
   *
   * Texture is lazy-loaded: the sprite starts with a transparent placeholder
   * and registration-with-GE is deferred until the real spritesheet arrives so
   * the walking animation mapping has valid frames.
   *
   * @param {{ x:number, y:number, texture:string }} entry
   * @returns {{ sprite:Phaser.GameObjects.Sprite, geId:string }|null}
   */
  _spawnVisualSprite(entry) {
    const { texture } = entry;
    const isShiny    = texture.endsWith('s');
    const pathFactory = isShiny ? Tileset.pokemon_shiny[texture] : Tileset.pokemon[texture];
    const dimSrc     = isShiny ? Tileset.ow_pokemon_shiny_dimensions : Tileset.ow_pokemon_dimensions;
    const dims       = dimSrc.default?.[texture];

    if (!pathFactory || !dims) {
      console.warn('[OverworldEncounter] no sprite data for', texture);
      return null;
    }

    const frameW = Math.floor(dims.width  / 4);
    const frameH = Math.floor(dims.height / 4);
    // Match player_mon placement: feet at the tile's bottom, origin-centered.
    const px     = entry.x * Tile.WIDTH + Tile.WIDTH / 2;
    const py     = (entry.y + 1) * Tile.HEIGHT - frameH / 2;

    const sprite = this.scene.add.sprite(px, py, '__DEFAULT');
    sprite.setOrigin(0.5, 0.5);
    sprite.setAlpha(0);  // hidden until real texture loads

    const geId = `${OW_ENC_PREFIX}${entry.x}_${entry.y}`;

    const registerWithGE = () => {
      if (!sprite.active) return;
      if (this.scene.gridEngine.hasCharacter(geId)) return;
      this.scene.gridEngine.addCharacter({
        id: geId,
        sprite,
        walkingAnimationMapping: {
          up:    { leftFoot: 13, standing: 12, rightFoot: 15 },
          down:  { leftFoot:  1, standing:  0, rightFoot:  3 },
          left:  { leftFoot:  7, standing:  4, rightFoot:  5 },
          right: { leftFoot:  9, standing:  8, rightFoot: 11 },
        },
        startPosition: { x: entry.x, y: entry.y },
        collides: {
          // Water mons live on tiles ground-layer characters would be blocked
          // from (water carries ge_collide). Turn off tile collision so GE
          // will actually put them there, then constrain them to water in the
          // custom wander step below. Land mons stay blocked by walls/terrain.
          // Empty collisionGroups in both cases so the player can walk through.
          collidesWithTiles: !entry.isWater,
          collisionGroups:   [],
        },
        charLayer: 'ground',
      });
      // Stagger each mon: random per-mon interval (1.8s–3.6s) plus a random
      // 0..rate initial delay. Without this every spawn shares the same beat
      // and they all step in unison after a map load.
      const rate  = 1800 + Math.floor(rng() * 1800);
      const delay = Math.floor(rng() * rate);
      const startTimer = this.scene.time.delayedCall(delay, () => {
        if (this.scene.gridEngine?.hasCharacter(geId)) {
          if (entry.isWater) {
            this._waterWanderStep(geId, entry, rate);
          } else {
            this.scene.gridEngine.moveRandomly(geId, rate, 2);
          }
        }
        const b = this._behaviour[geId];
        if (b && b.startTimer === startTimer) b.startTimer = null;
      });
      this._behaviour[geId] = {
        mode:         'neutral',
        stepsLeft:    0,
        cooldownLeft: 0,
        startedAt:    0,
        lastMoveAt:   0,
        origRate:     rate,
        origRadius:   2,
        isWater:      !!entry.isWater,
        exclaimSprite: null,
        exclaimTimer:  null,
        startTimer,
        wanderTimer:   null,
      };
    };

    const applyTexture = () => {
      if (!sprite.active) return;
      if (!this.scene.anims.exists(texture + '-spin')) {
        this.scene.anims.create({
          key: texture + '-spin',
          frames: this.scene.anims.generateFrameNumbers(texture, { frames: [0, 4, 12, 8] }),
          frameRate: 7,
          repeat: -1,
        });
      }
      sprite.setTexture(texture, 0);
      sprite.setAlpha(1);
      if (entry.isWater) {
        sprite._reflection = new Reflection({ parent: sprite });
      }
      registerWithGE();
    };

    if (this.scene.textures.exists(texture)) {
      applyTexture();
    } else {
      pathFactory().then(path => {
        if (!sprite.active) return;
        this.scene.load.spritesheet(texture, path, { frameWidth: frameW, frameHeight: frameH });
        this.scene.load.once('filecomplete-spritesheet-' + texture, applyTexture);
        this.scene.load.start();
      });
    }

    return { sprite, geId };
  }

  /**
   * Remove an active spawn: deregister the GE character and destroy the sprite.
   * @param {{ x:number, y:number, sprite:Phaser.GameObjects.Sprite, geId?:string, battleConfig:object }} spawn
   */
  _removeSpawn(spawn) {
    this._clearBehaviour(spawn.geId);
    try {
      if (spawn.geId && this.scene.gridEngine?.hasCharacter(spawn.geId)) {
        this.scene.gridEngine.stopMovement(spawn.geId);
        this.scene.gridEngine.removeCharacter(spawn.geId);
      }
      spawn.sprite?._reflection?.destroy();
      spawn.sprite?.destroy();
    } catch (_) {}
    this._active = this._active.filter(s => s !== spawn);
  }

  /**
   * Expand all encounter-zone objects on this map into a flat tile list,
   * then auto-detect water tiles and add them as surf encounters when an
   * encounter table with a 'surf' slot exists for their location.
   *
   * @param {Record<string, object>|null} encounterTable - Parsed encounter tables.
   * @returns {{ x:number, y:number, tableId:string|null, section:string }[]}
   */
  _collectEncounterTiles(encounterTable) {
    const tiles = [];
    const zones = this.scene.findInteractions('encounters');
    for (const obj of zones) {
      const tableId = this.scene.getPropertyFromTile(obj, 'table-id') || null;
      const section = this.scene.getPropertyFromTile(obj, 'section') || 'grass';
      const shape   = obj.polygon ?? obj.polyline ?? null;
      // Surf zones authored as rectangles/polygons can overhang non-water
      // edges; gate each tile through isWaterTile so surf mons only ever
      // spawn on actual water.
      const accept = (tx, ty) => {
        if (section !== 'surf') return true;
        return this.scene.isWaterTile?.(tx, ty) === true;
      };
      if (shape === null) {
        const w = parseInt(obj.width  / Tile.WIDTH);
        const h = parseInt(obj.height / Tile.HEIGHT);
        for (let x = 0; x < w; x++) {
          for (let y = 0; y < h; y++) {
            const tx = obj.x / Tile.WIDTH  + x;
            const ty = obj.y / Tile.HEIGHT + y;
            if (!accept(tx, ty)) continue;
            tiles.push({ x: tx, y: ty, tableId, section });
          }
        }
      } else {
        const abs  = shape.map(pt => ({ x: obj.x + pt.x, y: obj.y + pt.y }));
        const minTx = Math.floor(Math.min(...abs.map(p => p.x)) / Tile.WIDTH);
        const maxTx = Math.floor(Math.max(...abs.map(p => p.x)) / Tile.WIDTH);
        const minTy = Math.floor(Math.min(...abs.map(p => p.y)) / Tile.HEIGHT);
        const maxTy = Math.floor(Math.max(...abs.map(p => p.y)) / Tile.HEIGHT);
        for (let tx = minTx; tx <= maxTx; tx++) {
          for (let ty = minTy; ty <= maxTy; ty++) {
            const cx = tx * Tile.WIDTH  + Tile.WIDTH  / 2;
            const cy = ty * Tile.HEIGHT + Tile.HEIGHT / 2;
            if (!pointInPolygon(cx, cy, abs)) continue;
            if (!accept(tx, ty)) continue;
            tiles.push({ x: tx, y: ty, tableId, section });
          }
        }
      }
    }

    // Auto-detect water tiles and add surf encounters. Any water tile not
    // already covered by a hand-drawn surf zone gets a virtual encounter
    // entry when its location's encounter table has a 'surf' slot.
    this._autoCollectWaterTiles(tiles, encounterTable);

    return tiles;
  }

  /**
   * Scan every tilemap cell on the water layer, group contiguous water
   * into regions, and push tiles with `section: 'surf'` into the provided
   * array. Tiles already present as surf in `tiles` are skipped to avoid
   * duplicates.
   */
  _autoCollectWaterTiles(tiles, encounterTable) {
    if (!encounterTable) return;
    const map = this.scene.config.tilemap;
    if (!map) return;

    const existingSurf = new Set(
      tiles.filter(t => t.section === 'surf').map(t => `${t.x},${t.y}`)
    );

    // Collect all water tile positions
    const waterSet = new Set();
    for (let x = 0; x < map.width; x++) {
      for (let y = 0; y < map.height; y++) {
        if (this.scene.isWaterTile(x, y)) waterSet.add(`${x},${y}`);
      }
    }
    if (waterSet.size === 0) return;

    // Flood-fill into contiguous regions
    const visited = new Set();
    for (const key of waterSet) {
      if (visited.has(key)) continue;
      const [sx, sy] = key.split(',').map(Number);
      const region = [];
      const stack = [[sx, sy]];
      while (stack.length) {
        const [cx, cy] = stack.pop();
        const ck = `${cx},${cy}`;
        if (visited.has(ck)) continue;
        visited.add(ck);
        region.push({ x: cx, y: cy });
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const nk = `${cx + dx},${cy + dy}`;
          if (waterSet.has(nk) && !visited.has(nk)) stack.push([cx + dx, cy + dy]);
        }
      }

      // Find a table with a 'surf' slot that covers this region
      const tableId = this._findSurfTableForRegion(region, encounterTable);
      if (!tableId) continue;

      for (const t of region) {
        const k = `${t.x},${t.y}`;
        if (existingSurf.has(k)) continue;
        tiles.push({ x: t.x, y: t.y, tableId, section: 'surf' });
      }
    }
  }

  /**
   * Find the first encounter table with a 'surf' slot whose owning location
   * contains at least one tile from the region. Falls back to map-level tables.
   */
  _findSurfTableForRegion(region, encounterTable) {
    // Check location-level tables first
    for (const loc of this._locations) {
      if (!loc.tableNames?.length) continue;
      const hit = region.some(t => {
        const px = t.x * Tile.WIDTH  + Tile.WIDTH  / 2;
        const py = t.y * Tile.HEIGHT + Tile.HEIGHT / 2;
        return px >= loc.x && px <= loc.x + loc.width
            && py >= loc.y && py <= loc.y + loc.height;
      });
      if (!hit) continue;
      for (const name of loc.tableNames) {
        if (encounterTable[name]?.slots?.surf) return name;
      }
    }
    // Fall back to map-level tables
    for (const name of (this._mapTableNames ?? [])) {
      if (encounterTable[name]?.slots?.surf) return name;
    }
    return null;
  }

  _tileDensity(tile, mapDensity) {
    const px = tile.x * Tile.WIDTH  + Tile.WIDTH  / 2;
    const py = tile.y * Tile.HEIGHT + Tile.HEIGHT / 2;
    for (const loc of this._locations) {
      if (loc.owEncounterRate == null) continue;
      if (px >= loc.x && px <= loc.x + loc.width &&
          py >= loc.y && py <= loc.y + loc.height) {
        return loc.owEncounterRate / 100;
      }
    }
    return mapDensity;
  }

  /**
   * Extract table names from a raw encounter-table fragment.
   * @param {Array} fragment
   * @returns {string[]}
   */
  _extractTableNames(fragment) {
    const names = [];
    if (!Array.isArray(fragment)) return names;
    for (const item of fragment) {
      const entry = item?.value ?? item;
      if (entry?.name) names.push(entry.name);
    }
    return names;
  }

  /**
   * Trace the outer boundary of a contiguous tile region as a clockwise
   * polygon in pixel coordinates. Collects directed boundary edges (edges
   * between water and non-water tiles) and chains them head-to-tail.
   *
   * @param {Set<string>} regionSet - "x,y" keys of tiles in the region.
   * @param {{ x:number, y:number }[]} region - tile coordinate list.
   * @returns {{ x:number, y:number }[]} Ordered polygon vertices (pixels).
   */
  _traceWaterPolygon(region, regionSet) {
    const TW = Tile.WIDTH;
    const TH = Tile.HEIGHT;
    const edgeMap = new Map();

    const addEdge = (fx, fy, tx, ty) => {
      const key = `${fx},${fy}`;
      if (!edgeMap.has(key)) edgeMap.set(key, []);
      edgeMap.get(key).push({ x: tx, y: ty });
    };

    for (const { x, y } of region) {
      if (!regionSet.has(`${x},${y - 1}`))  addEdge(x * TW,       y * TH,       (x + 1) * TW, y * TH);
      if (!regionSet.has(`${x + 1},${y}`))  addEdge((x + 1) * TW, y * TH,       (x + 1) * TW, (y + 1) * TH);
      if (!regionSet.has(`${x},${y + 1}`))  addEdge((x + 1) * TW, (y + 1) * TH, x * TW,       (y + 1) * TH);
      if (!regionSet.has(`${x - 1},${y}`))  addEdge(x * TW,       (y + 1) * TH, x * TW,       y * TH);
    }

    if (edgeMap.size === 0) return [];

    const startKey = edgeMap.keys().next().value;
    const [sx, sy] = startKey.split(',').map(Number);
    const points = [];
    let cx = sx, cy = sy;

    do {
      points.push({ x: cx, y: cy });
      const key = `${cx},${cy}`;
      const nexts = edgeMap.get(key);
      if (!nexts?.length) break;
      const next = nexts.shift();
      if (nexts.length === 0) edgeMap.delete(key);
      cx = next.x;
      cy = next.y;
    } while (cx !== sx || cy !== sy);

    return points;
  }

  /**
   * Normalises raw `encounter-table` list values from Tiled map-settings into a
   * `{ [tableName]: { name, slots: { grass, surf, good-rod, … } } }` map.
   *
   * Zones reference a specific table via `table-id` and a slot inside that
   * table via `section`; the resolver looks up `tables[tableId].slots[section]`.
   *
   * @param {Array|null} raw - Array of fragments, each a list of `encounterTable`
   *   class wrappers `[{ propertytype, type, value: { name, grass, surf, … } }]`.
   * @returns {Record<string, { name: string, slots: Record<string, object[]> }>|null}
   */
  _parseEncounterTable(raw) {
    if (raw == null) return null;
    const fragments = Array.isArray(raw) ? raw : [raw];
    const result = {};

    const unwrapEntries = (list) =>
      list.map(e => e?.value ?? e).filter(e => e?.species);

    for (const fragment of fragments) {
      if (!Array.isArray(fragment)) continue;
      for (const item of fragment) {
        const entry = item?.value ?? item;
        if (!entry || typeof entry !== 'object') continue;
        const name = entry.name;
        if (!name) continue;
        const table = result[name] ?? (result[name] = { name, slots: {} });
        for (const [slot, list] of Object.entries(entry)) {
          if (slot === 'name' || !Array.isArray(list) || list.length === 0) continue;
          const entries = unwrapEntries(list);
          if (entries.length > 0) table.slots[slot] = entries;
        }
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Pre-generate a complete wild battle config for a single tile.
   * Species, level, moves, IVs, shiny, and Pokérus are all determined here so
   * the sprite the player sees matches the Pokémon they will fight.
   *
   * @param {{ tableId:string|null }} tile
   * @param {Record<string, object[]>|null} encounterTable
   * @returns {object|null} Battle config, or null if no species could be resolved.
   */
  _buildBattleConfig(tile, encounterTable) {
    const def     = getGameDef();
    const dex     = new Pokedex(def.game);
    const allSpec = Object.values(dex.pokedex);
    const pool    = filterByAvailablePokemon(allSpec);
    if (!pool.length) return null;

    let entry, levelMin, levelMax;

    if (def.encounterTables === 'random') {
      const seed = ((store.state.game.seed ?? 0) + hashStr(tile.tableId ?? '')) >>> 0;
      const rng  = seededRng(seed);
      const picks = pool.slice().sort(() => rng() - 0.5).slice(0, Math.min(5, pool.length));
      entry    = picks[Math.floor(rng() * picks.length)];
      levelMin = WILD_LEVEL_MIN;
      levelMax = WILD_LEVEL_MAX;
    } else {
      const section = tile.section ?? 'grass';
      const table   = tile.tableId ? encounterTable?.[tile.tableId] : null;
      const entries = table?.slots?.[section] ?? null;
      if (entries?.length > 0) {
        const picked = pickWeighted(entries);
        const name   = picked.species?.toLowerCase();
        entry        = allSpec.find(p => p.species?.toLowerCase() === name);
        if (!entry) {
          console.warn(`[OverworldEncounter] unknown species '${name}', falling back to random`);
          entry = pool[Math.floor(rng() * pool.length)];
        }
        levelMin = picked['level-range-min'] ?? WILD_LEVEL_MIN;
        levelMax = picked['level-range-max'] ?? levelMin;
      } else {
        return null; // no table entry for this zone — skip OW encounter
      }
    }

    // Mark as seen in the Pokédex at spawn time.
    store.commit('pokedex/SEE', entry.nat_dex_id);

    const level = levelMin + Math.floor(rng() * (levelMax - levelMin + 1));
    const wildMon = buildMon(entry.nat_dex_id, level, {
      rng,
      game:      def.game,
      movesMode: def.learnsets,
      maxIvs:    !!def.maxIvs,
    });

    return {
      tilesetBaseUrl: '/',
      textSpeed:      store.state.game.textSpeed ?? 'normal',
      expRate:          def.expRateMultiplier,
      catchingGivesExp: !!def.catchingGivesExp,
      deferEvolution:   def.deferEvolution,
      nuzlocke: def.gameMode === 'nuzlocke' ? {
        zone:       tile.tableId ?? null,
        zoneCaught: tile.tableId
          ? !!store.state.game.gameFlags[`nuzlocke_caught_${tile.tableId}_${tile.section ?? 'grass'}`]
          : false,
      } : null,
      field:  { weather: null, terrain: 'normal', scene: getBattleTheme(this.scene) },
      player: {
        name: 'Red',
        team: gameState.party.map(p => ({
          ...p,
          moves: p.moves.map(m => ({ ...m, pp: { ...m.pp } })),
          ivs:   { ...p.ivs },
          evs:   { ...p.evs },
        })),
        // inventory is attached from the player's live bag at trigger time
        // (see `event()`), not at map-load time.
      },
      enemy: {
        isTrainer: false,
        name:      'Wild',
        team:      [wildMon],
      },
    };
  }
}
