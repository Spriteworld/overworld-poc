import Phaser from 'phaser';
import * as Tile from '@Objects/Tile.js';
import { Pokedex, GAMES, NATURES, GENDERS, STATS, Moves, Items, FRLG_LEARNSETS } from '@spriteworld/pokemon-data';
import { gameState } from '@Data/gameState.js';
import { getPropertyValue, remapProps, Vector2 } from '@Utilities';
import { getGameDef } from '@Data/gameDef.js';
import Tileset from '@Tileset';
import Trainer from '@Objects/characters/Trainer.js';
import store from '../../store/index.js';

// ── Battle helpers (mirrors encounter.js) ────────────────────────────────────

const ITEM_REGISTRY = {
  'Potion':        Items.Potion,
  'Super Potion':  Items.SuperPotion,
  'Hyper Potion':  Items.HyperPotion,
  'Max Potion':    Items.MaxPotion,
  'Full Restore':  Items.FullRestore,
  'Ether':         Items.Ether,
  'Revive':        Items.Revive,
};

function buildBattleInventory() {
  const { items } = store.state.bag;
  return {
    items: items
      .filter(e => ITEM_REGISTRY[e.name] && e.quantity > 0)
      .map(e => ({ item: new ITEM_REGISTRY[e.name](), quantity: e.quantity })),
    pokeballs: [],
    tms:       [],
  };
}

const STAT_KEYS   = [STATS.HP, STATS.ATTACK, STATS.DEFENSE, STATS.SPECIAL_ATTACK, STATS.SPECIAL_DEFENSE, STATS.SPEED];
const NATURE_LIST = Object.values(NATURES);

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickUnique(arr, n) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, Math.min(n, arr.length));
}
function buildMovePool() {
  return Moves.getMovesByGameId(GAMES.POKEMON_FIRE_RED).filter(
    m => m.pp > 0 && (m.power !== null || m.category === Moves.MOVE_CATEGORIES.STATUS)
  );
}

let _pokedex = null;
function getPokedex() {
  if (!_pokedex) _pokedex = new Pokedex(GAMES.POKEMON_FIRE_RED);
  return _pokedex;
}

/**
 * Resolves a species value to a nat_dex_id.
 * Accepts a numeric nat_dex_id directly, or a species name string (e.g. 'pikachu').
 * Returns the species name alongside the id so callers can use it for learnset lookup.
 * @param {number|string} species
 * @returns {{ id: number|null, name: string|null }}
 */
function resolveSpecies(species) {
  if (typeof species === 'number') {
    const entry = Object.values(getPokedex().pokedex).find(p => p.nat_dex_id === species);
    return { id: species, name: entry?.name ?? null };
  }
  if (typeof species === 'string') {
    const lower = species.toLowerCase();
    const entry = Object.values(getPokedex().pokedex).find(
      p => p.name?.toLowerCase() === lower
    );
    return { id: entry?.nat_dex_id ?? null, name: entry?.name ?? species };
  }
  return { id: null, name: null };
}

/**
 * Builds up to four moves for a Pokémon using its FRLG level-up learnset,
 * taking the most recently learned moves at or below `level`.
 * Falls back to random moves from `fallbackPool` when no learnset exists.
 * @param {string}   speciesName
 * @param {number}   level
 * @param {object[]} fallbackPool
 * @returns {{ name: string, pp: { max: number, current: number } }[]}
 */
function buildMovesFromLearnset(speciesName, level, fallbackPool) {
  const learnset = FRLG_LEARNSETS[speciesName.toUpperCase()];
  if (!learnset?.length) {
    return pickUnique(fallbackPool, 4).map(m => ({ name: m.name, pp: { max: m.pp, current: m.pp } }));
  }
  const learnable = learnset.filter(([lvl]) => lvl <= level);
  const selected  = learnable.slice(-4);
  const ppByName  = Object.fromEntries(fallbackPool.map(m => [m.name, m.pp]));
  return selected.map(([, name]) => {
    const pp = ppByName[name] ?? 5;
    return { name, pp: { max: pp, current: pp } };
  });
}

// ─────────────────────────────────────────────────────────────────────────────

const EXCLAIM_ANIM_KEY  = 'trainer-spotted';
const EXCLAIM_FRAMES    = { start: 13, end: 16 };
const EXCLAIM_FRAME_RATE = 10;
// Delay (ms) before the trainer starts walking after the exclamation plays.
const EXCLAIM_DURATION  = 700;

export default class {
  constructor(scene) {
    this.scene    = scene;
    this.trainers = []; // [{ obj, char, defeatedFlag, moveSub }]
  }

  init() {
    this.scene.trainers = this.scene.add.group();
    this.scene.trainers.runChildUpdate = true;

    const trainerObjs = this.scene.findInteractions('trainer');
    if (trainerObjs.length === 0) return;

    trainerObjs.forEach(obj => {
      const defeatedFlag = 'trainer_defeated_' + obj.name;
      const isDefeated   = !!store.state.game.gameFlags[defeatedFlag];

      const entry = { obj, char: null, defeatedFlag, moveSub: null };
      entry.char  = this._addToScene(obj, entry, isDefeated);
      this.trainers.push(entry);
    });

    // Register the exclamation animation once per scene.
    if (!this.scene.anims.exists(EXCLAIM_ANIM_KEY)) {
      this.scene.anims.create({
        key:       EXCLAIM_ANIM_KEY,
        frames:    this.scene.anims.generateFrameNumbers('animation', EXCLAIM_FRAMES),
        frameRate: EXCLAIM_FRAME_RATE,
        repeat:    0,
      });
    }
  }

  /**
   * Create a Trainer character for the given Tiled object and register it with
   * the scene's interaction system.
   */
  _addToScene(obj, entry, isDefeated) {
    const texture  = getPropertyValue(obj.properties, 'overworld-texture');
    const x        = obj.x / Tile.WIDTH;
    const y        = obj.y / Tile.HEIGHT;

    const trainerDef = {
      id:              'trainer_' + obj.name,
      type:            'trainer',
      texture:         texture,
      x,
      y,
      scene:           this.scene,
      properties:      obj.properties,
      collides:        { enabled: true },
      'seen-character': 'player',
      'seen-radius':    5,
      'move':           false,
      'event-can-see-character': (charId) => this._onSpotPlayer(charId),
      ...(obj.properties ? remapProps(obj.properties) : {}),
      // remapProps may overwrite the above; restore forced values:
      'seen-character': 'player',
      'seen-radius':    5,
      'move':           false,
    };

    const trainerChar = new Trainer(trainerDef);
    this.scene.trainers.add(trainerChar);

    if (this.scene.textures.exists(texture)) {
      this._ensureAnim(texture);
      if (this.scene.ge_init) {
        this.scene.gridEngine.addCharacter(trainerChar.characterDef());
      }
    } else {
      const path = texture ? Tileset.trainers[texture] : null;
      if (!path) {
        if (texture) console.warn('[Trainer] no sprite path for texture:', texture);
        trainerChar.setTexture('red');
        if (this.scene.ge_init) {
          this.scene.gridEngine.addCharacter(trainerChar.characterDef());
        }
      } else {
        trainerChar.setTexture('red');
        if (this.scene.ge_init) {
          this.scene.gridEngine.addCharacter(trainerChar.characterDef());
        }
        this.scene.load.spritesheet(texture, path, { frameWidth: Tile.WIDTH, frameHeight: 42 });
        this.scene.load.once('filecomplete-spritesheet-' + texture, () => {
          this._ensureAnim(texture);
          trainerChar.setTexture(texture);
        });
        this.scene.load.start();
      }
    }

    if (isDefeated) trainerChar._spotted = true;

    this.scene.interactTile(this.scene.game.config.tilemap, {
      ...trainerDef,
      id:   trainerDef.id,
      type: 'trainer',
      x:    obj.x,
      y:    obj.y,
    }, 0xff8800);

    return trainerChar;
  }

  _ensureAnim(texture) {
    if (!this.scene.anims.exists(texture + '-spin')) {
      this.scene.anims.create({
        key:       texture + '-spin',
        frames:    this.scene.anims.generateFrameNumbers(texture, { frames: [0, 4, 12, 8] }),
        frameRate: 7,
        repeat:    -1,
      });
    }
  }

  update() {}

  event() {
    this._onInteract = (tile) => {
      if (tile.obj.type !== 'trainer') return;

      const entry = this.trainers.find(t => t.char?.config.id === tile.obj.id);
      if (!entry) return;

      const isDefeated = !!store.state.game.gameFlags[entry.defeatedFlag];

      if (isDefeated) {
        const text = this.scene.getPropertyFromTile(entry.obj, 'text-post-defeat');
        if (!text) return;
        const player = this.scene.characters.get('player');
        entry.char.look(player.getOppositeFacingDirection());
        this.scene.game.events.emit('textbox-changedata', text);
        return;
      }

      // Undefeated trainer — trigger the full spot sequence (exclaim + intro text → walk → battle).
      this._onSpotPlayer(entry.char.config.id);
    };
    this.scene.game.events.on('interact-with-obj', this._onInteract);
  }

  destroy() {
    this.scene.game.events.off('interact-with-obj', this._onInteract);
    this.trainers.forEach(t => t.moveSub?.unsubscribe());
  }

  // ── Trainer sequence ───────────────────────────────────────────────────────

  _onSpotPlayer(charId) {
    console.log('Trainer::_onSpotPlayer', charId);
    const entry = this.trainers.find(t => t.char?.config.id === charId);
    if (!entry) return;
    if (entry.char._spotted) return; // already handling

    const isDefeated = !!store.state.game.gameFlags[entry.defeatedFlag];
    if (isDefeated) return;

    // Lock the trainer and disable player input immediately.
    entry.char._spotted = true;
    this.scene.registry.set('player_input', false);

    // Show exclamation animation above the trainer's head.
    const exclaim = this._showExclamation(entry.char);

    // Show the trainer's dialogue alongside the exclamation; walk when dismissed.
    const text = this.scene.getPropertyFromTile(entry.obj, 'text-intro');
    if (text) {
      this.scene.game.events.emit('textbox-changedata', text);
      this.scene.game.events.once('textbox-disable', () => {
        exclaim.destroy();
        this._walkToPlayer(entry);
      });
    } else {
      // No text — fall back to timed delay before walking.
      this.scene.time.delayedCall(EXCLAIM_DURATION, () => {
        exclaim.destroy();
        this._walkToPlayer(entry);
      });
    }
  }

  _showExclamation(trainerChar) {
    // Trainer sprites have origin (0, 0) so x/y is the top-left corner.
    // Center X = x + width/2; top of head = y. The exclamation has origin
    // (0.5, 1) so its bottom sits flush above the head with a small gap.
    const ex = this.scene.add.sprite(
      trainerChar.x + trainerChar.width / 2,
      trainerChar.y - 2,
      'animation',
      EXCLAIM_FRAMES.start,
    ).setDepth(9999).setOrigin(0.5, 1);
    ex.play(EXCLAIM_ANIM_KEY);
    return ex;
  }

  _walkToPlayer(entry) {
    const player = this.scene.characters.get('player');
    if (!player) { this._initiateConfrontation(entry); return; }

    entry.char.moveTo(player.getPosition(), {
      noPathFoundStrategy:  'CLOSEST_REACHABLE',
      pathBlockedStrategy:  'WAIT',
    });

    const checkArrival = ({ charId }) => {
      if (charId !== entry.char.config.id) return;
      const dist = Math.abs(entry.char.getPosition().x - player.getPosition().x)
                 + Math.abs(entry.char.getPosition().y - player.getPosition().y);
      if (dist <= 1) {
        entry.moveSub.unsubscribe();
        entry.moveSub = null;
        this._initiateConfrontation(entry);
      }
    };

    entry.moveSub = this.scene.gridEngine.positionChangeFinished().subscribe(checkArrival);
  }

  _initiateConfrontation(entry) {
    entry.char.stopMove(true);
    const player = this.scene.characters.get('player');
    if (player) entry.char.look(player.getOppositeFacingDirection());
    this.scene.registry.set('player_input', false);
    this._startBattle(entry);
  }

  _startBattle(entry) {
    const battleData = this._buildTrainerBattle(entry.obj);
    this.scene.game.events.emit('battle-start', battleData);
    this.scene.game.events.once('battle-complete', ({ result }) => {
      this._onBattleComplete(entry, result);
    });
  }

  _buildTrainerBattle(obj) {
    const team            = this._parseTrainerTeam(obj);
    const overworldSprite = getPropertyValue(obj.properties, 'overworld-texture');
    const battleSprite    = getPropertyValue(obj.properties, 'battle-texture') ?? overworldSprite;
    return {
      tilesetBaseUrl: '/',
      expRate:        getGameDef().expRate,
      field:          { weather: null, terrain: 'normal' },
      player: {
        name:      'Red',
        team:      gameState.party.map(p => ({
          ...p,
          moves: p.moves.map(m => ({ ...m, pp: { ...m.pp } })),
          ivs:   { ...p.ivs },
          evs:   { ...p.evs },
        })),
        inventory: buildBattleInventory(),
      },
      enemy: {
        isTrainer:             true,
        name:                  this.scene.getPropertyFromTile(obj, 'trainer-name') || obj.name,
        team,
        prizeMoney:            this._calcPrizeMoney(obj, team),
        trainerBattleSprite:   battleSprite ?? null,
        midFightText:          getPropertyValue(obj.properties, 'text-mid-fight') ?? null,
        postDefeatText:        getPropertyValue(obj.properties, 'text-post-defeat') ?? null,
      },
    };
  }

  /**
   * Returns the prize money for winning against this trainer.
   * Uses the Tiled `prize-money` property if set, otherwise falls back to
   * the Gen 3 formula: highest party level × 50.
   * @param {object} obj - Tiled object.
   * @param {Array}  team - Parsed trainer team specs.
   * @returns {number}
   */
  _calcPrizeMoney(obj, team) {
    const explicit = getPropertyValue(obj.properties, 'prize-money');
    if (explicit != null) { return Math.max(0, parseInt(explicit, 10) || 0); }
    const highestLevel = team.reduce((max, p) => Math.max(max, p.level ?? 1), 1);
    return highestLevel * 50;
  }

  _parseTrainerTeam(obj) {
    const raw = this.scene.getPropertyFromTile(obj, 'trainer-pokemon');
    let specs;

    if (Array.isArray(raw)) {
      // New Tiled list format: each entry is { propertytype, type, value: { species, level, move1-4, item } }
      specs = raw
        .slice(0, 6)
        .map(entry => entry.value ?? entry)
        .filter(v => v.species);
    } else {
      try { specs = JSON.parse(raw || '[]'); } catch { return []; }
    }

    const movePool = buildMovePool();
    return specs.map(spec => {
      const defaults = {
        game:    GAMES.POKEMON_FIRE_RED,
        pid:     Math.random(),
        nature:  pick(NATURE_LIST).name,
        gender:  pick([GENDERS.MALE, GENDERS.FEMALE]),
        ability: { name: 'none' },
        ivs:     Object.fromEntries(STAT_KEYS.map(s => [s, 31])),
        evs:     Object.fromEntries(STAT_KEYS.map(s => [s, 0])),
      };
      const resolved = { ...defaults, ...spec };

      // Resolve species → nat_dex_id, keeping the name for learnset lookup.
      const { id: speciesId, name: speciesName } = resolved.species != null
        ? resolveSpecies(resolved.species)
        : { id: null, name: null };
      if (speciesId != null) resolved.species = speciesId;

      // Collect move1–move4 string fields (new Tiled format).
      const moveNames = [spec.move1, spec.move2, spec.move3, spec.move4]
        .filter(m => typeof m === 'string' && m.trim() !== '');

      if (moveNames.length > 0) {
        const ppByName = Object.fromEntries(movePool.map(m => [m.name.toLowerCase(), m.pp]));
        resolved.moves = moveNames.map(name => {
          const pp = ppByName[name.toLowerCase()] ?? 5;
          return { name, pp: { max: pp, current: pp } };
        });
      } else if (spec.moves?.length) {
        // Legacy JSON format: moves array of strings or objects.
        const ppByName = Object.fromEntries(movePool.map(m => [m.name.toLowerCase(), m.pp]));
        resolved.moves = spec.moves.slice(0, 4).map(m => {
          if (typeof m === 'string') {
            const pp = ppByName[m.toLowerCase()] ?? 5;
            return { name: m, pp: { max: pp, current: pp } };
          }
          return m;
        });
      } else {
        // Default moves: respect the learnsets game-def setting.
        const useRandom = getGameDef().learnsets === 'random' || speciesName == null;
        resolved.moves = useRandom
          ? pickUnique(movePool, 4).map(m => ({ name: m.name, pp: { max: m.pp, current: m.pp } }))
          : buildMovesFromLearnset(speciesName, resolved.level ?? 1, movePool);
      }

      // Hold item: `item` field from Tiled (empty string = no item).
      if (spec.item && typeof spec.item === 'string' && spec.item.trim() !== '') {
        resolved.heldItem = spec.item.trim();
      }

      // Remove raw Tiled move/item fields from the resolved config.
      delete resolved.move1;
      delete resolved.move2;
      delete resolved.move3;
      delete resolved.move4;
      delete resolved.item;

      return resolved;
    });
  }

  _onBattleComplete(entry, result) {
    if (result !== 'won') return;

    store.commit('game/PATCH_FLAGS', { [entry.defeatedFlag]: true });
    entry.char.setDefeated();
  }
}
