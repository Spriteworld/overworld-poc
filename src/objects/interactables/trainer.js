import Phaser from 'phaser';
import * as Tile from '@Objects/Tile.js';
import { buildMon, buildMovePool, resolveSpecies } from '@spriteworld/pokemon-data';
import { gameState } from '@Data/gameState.js';
import { getPropertyValue, getBattleTheme, remapProps, Vector2, checkOnlyIf, assertNotReservedId, loadOverworldSpritesheet } from '@Utilities';
import { getGameDef } from '@Data/gameDef.js';
import { resolveAiType, DEFAULT_TRAINER_AI } from '@Data/aiTypes.js';
import { rng } from '@Utilities/rng.js';
import Tileset from '@Tileset';
import Trainer from '@Objects/characters/Trainer.js';
import ScriptRunner from '../../utilities/ScriptRunner.js';
import store from '../../store/index.js';
import { buildBattleInventory } from '@Data/itemDefs.js';

// ─────────────────────────────────────────────────────────────────────────────

const EXCLAIM_ANIM_KEY  = 'trainer-spotted';
const EXCLAIM_FRAMES    = { start: 21, end: 24 };
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
    // Updates are driven by GameMap.updateCharacters with camera culling.
    this.scene.trainers.runChildUpdate = false;

    const trainerObjs = this.scene.findInteractions('trainer');
    if (trainerObjs.length === 0) return;

    trainerObjs.forEach(obj => {
      if (!checkOnlyIf(getPropertyValue(obj.properties, 'only_if'), store.state.game.gameFlags, this.scene.config.variant ?? null, this.scene.mapVars ?? {})) return;
      assertNotReservedId(obj.name, 'Interactables::trainer');
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

    if (trainerDef['movement-behavior'] === 'spinner') {
      trainerDef.spin = true;
    }

    const trainerChar = new Trainer(trainerDef);
    this.scene.trainers.add(trainerChar);

    if (this.scene.textures.exists(texture)) {
      this._ensureAnim(texture);
      if (this.scene.ge_init) {
        this.scene.gridEngine.addCharacter(trainerChar.characterDef());
        this.scene._indexCharacter?.(trainerChar.config.id);
      }
    } else {
      const pathFactory = texture ? Tileset.sprites[texture] : null;
      if (!pathFactory) {
        if (texture) console.warn('[Trainer] no sprite path for texture:', texture);
        trainerChar.setTexture('red');
        if (this.scene.ge_init) {
          this.scene.gridEngine.addCharacter(trainerChar.characterDef());
          this.scene._indexCharacter?.(trainerChar.config.id);
        }
      } else {
        trainerChar.setTexture('red');
        if (this.scene.ge_init) {
          this.scene.gridEngine.addCharacter(trainerChar.characterDef());
          this.scene._indexCharacter?.(trainerChar.config.id);
        }
        pathFactory().then(path => {
          if (!this.scene.sys) return;
          loadOverworldSpritesheet(this.scene, texture, path).then(() => {
            this._ensureAnim(texture);
            // Update ALL trainers sharing this texture, not just the one that triggered the load.
            this.scene.trainers.getChildren()
              .filter(t => t.config?.texture === texture)
              .forEach(t => {
                t.setTexture(texture);
                if (this.scene.gridEngine?.hasCharacter(t.config.id)) {
                  this.scene.gridEngine.setWalkingAnimationMapping(t.config.id, t.characterFramesDef());
                  const dir = this.scene.gridEngine.getFacingDirection(t.config.id);
                  this.scene.gridEngine.turnTowards(t.config.id, dir);
                }
              });
          });
        });
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

      const player      = this.scene.characters.get('player');
      const originalDir = entry.char.getFacingDirection();
      entry.char.look(player.getOppositeFacingDirection());

      const isDefeated = !!store.state.game.gameFlags[entry.defeatedFlag];

      if (isDefeated) {
        const text = this.scene.getPropertyFromTile(entry.obj, 'text-post-defeat');
        if (!text) {
          entry.char.look(originalDir);
          return;
        }
        this.scene.game.events.emit('textbox-changedata', text);
        this.scene.game.events.once('textbox-disable', () => entry.char.look(originalDir));
        return;
      }

      // Undefeated trainer — trigger the full spot sequence (exclaim + intro text → walk → battle).
      this._onSpotPlayer(entry.char.config.id);
    };
    this.scene.game.events.on('interact-with-obj', this._onInteract);

    this._onOverworldReady = () => {
      if (!this._pendingPostDefeatScript) return;
      const { entry, script } = this._pendingPostDefeatScript;
      this._pendingPostDefeatScript = null;
      const player = this.scene.characters?.get('player');
      if (player) entry.char.look(player.getOppositeFacingDirection());
      new ScriptRunner(this.scene, [...script]).run();
    };
    this.scene.game.events.on('post-battle-overworld-ready', this._onOverworldReady);
  }

  destroy() {
    this.scene.game.events.off('interact-with-obj', this._onInteract);
    this.scene.game.events.off('post-battle-overworld-ready', this._onOverworldReady);
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
      tilesetBaseUrl:  '/',
      expRate:         getGameDef().expRateMultiplier,
      deferEvolution:  getGameDef().deferEvolution,
      field:           { weather: null, terrain: 'normal', scene: getBattleTheme(this.scene) },
      player: {
        name:      'Red',
        team:      gameState.party.map(p => ({
          ...p,
          moves: p.moves.map(m => ({ ...m, pp: { ...m.pp } })),
          ivs:   { ...p.ivs },
          evs:   { ...p.evs },
        })),
        inventory: buildBattleInventory(store.state.bag),
      },
      enemy: {
        isTrainer:             true,
        name:                  this.scene.getPropertyFromTile(obj, 'trainer-name') || obj.name,
        team,
        trainerClass:          resolveAiType(getPropertyValue(obj.properties, 'use-ai'), DEFAULT_TRAINER_AI),
        prizeMoney:            this._calcPrizeMoney(obj, team),
        trainerBattleSprite:   battleSprite ?? null,
        midFightText:          getPropertyValue(obj.properties, 'text-mid-fight') ?? null,
        postDefeatText:        getPropertyValue(obj.properties, 'text-post-defeat') ?? null,
        wonFightText:          getPropertyValue(obj.properties, 'text-won-fight') ?? null,
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
    return highestLevel * 50 * (getGameDef().prizeMoneyMultiplier ?? 1);
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

    const game     = getGameDef().game;
    const movePool = buildMovePool(game);

    return specs.map(spec => {
      const { id: speciesId } = spec.species != null
        ? resolveSpecies(spec.species, game)
        : { id: null };
      if (speciesId == null) return null;

      // Resolve Tiled move1-4 / legacy moves[] into a fully-formed moves array.
      // If neither is provided, leave `moves` undefined and let buildMon roll it.
      const moveNames = [spec.move1, spec.move2, spec.move3, spec.move4]
        .filter(m => typeof m === 'string' && m.trim() !== '');
      let moves;
      if (moveNames.length > 0) {
        const ppByName = Object.fromEntries(movePool.map(m => [m.name.toLowerCase(), m.pp]));
        moves = moveNames.map(name => {
          const pp = ppByName[name.toLowerCase()] ?? 5;
          return { name, pp: { max: pp, current: pp } };
        });
      } else if (spec.moves?.length) {
        const ppByName = Object.fromEntries(movePool.map(m => [m.name.toLowerCase(), m.pp]));
        moves = spec.moves.slice(0, 4).map(m => {
          if (typeof m === 'string') {
            const pp = ppByName[m.toLowerCase()] ?? 5;
            return { name: m, pp: { max: pp, current: pp } };
          }
          return m;
        });
      }

      const heldItem = spec.item && typeof spec.item === 'string' && spec.item.trim() !== ''
        ? spec.item.trim()
        : undefined;

      const overrides = {
        rng,
        game,
        movePool,
        movesMode: getGameDef().learnsets,
        maxIvs:    !!getGameDef().maxIvs,
        pid:       spec.pid ?? rng(),
      };
      if (spec.nature  != null) overrides.nature  = spec.nature;
      if (spec.gender  != null) overrides.gender  = spec.gender;
      if (spec.ability != null) overrides.ability = spec.ability;
      if (spec.ivs     != null) overrides.ivs     = spec.ivs;
      if (spec.evs     != null) overrides.evs     = spec.evs;
      if (moves        != null) overrides.moves   = moves;
      if (heldItem     != null) overrides.heldItem = heldItem;
      if (spec.isShiny != null) overrides.isShiny = !!spec.isShiny;
      if (spec.shiny   != null) overrides.isShiny = !!spec.shiny;
      if (spec.pokerus != null) overrides.pokerus = !!spec.pokerus;

      return buildMon(speciesId, spec.level ?? 1, overrides);
    }).filter(Boolean);
  }

  _onBattleComplete(entry, result) {
    if (result !== 'won') return;

    store.commit('game/PATCH_FLAGS', { [entry.defeatedFlag]: true });
    entry.char.setDefeated();

    const postScript = this.scene.getPropertyFromTile(entry.obj, 'post-defeat-script');
    if (postScript && Array.isArray(postScript) && postScript.length > 0) {
      this._pendingPostDefeatScript = { entry, script: postScript };
    }
  }
}
