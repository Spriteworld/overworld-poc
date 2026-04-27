import Phaser from 'phaser';
import { Tile } from '@Objects';
import Tileset from '@Tileset';
import Scenes from '@Scenes';
import Debug from '@Data/debug.js';
import { loadGame } from '@Data/gameState.js';
import store from '../../store/index.js';
import { getStartScene } from '@Data/startScene.js';
import { getGameDef } from '@Data/gameDef.js';
import { getStartFlags, clearStartFlags } from '@Data/startFlags.js';
import { getStartDebug, clearStartDebug } from '@Data/startDebug.js';
import { getStartPlayerLocation, clearStartPlayerLocation } from '@Data/startPlayerLocation.js';
import { isTestMode } from '@Data/testMode.js';
import { initRng } from '@Utilities/rng.js';
import { createInputManager, getInputManager } from '@Utilities';
import { SHADER_ASSET_KEYS } from '@/asset-key.js';
import shader_wipe          from '@/assets/shader/wipe.png';
import shader_wipe_diagonal from '@/assets/shader/wipe-diagonal.png';
import shader_wipe_vertical from '@/assets/shader/wipe-vertical.png';
import shader_close_bars    from '@/assets/shader/close-bars.png';
import shader_trapped       from '@/assets/shader/trapped.png';
import shader_fog_diagonal  from '@/assets/shader/fog_diagonal.png';
import shader_fog_horizontal from '@/assets/shader/fog_horizontal.png';
import shader_sandstorm     from '@/assets/shader/sandstorm.png';
import shader_snow0         from '@/assets/shader/snow0.png';
import shader_snow1         from '@/assets/shader/snow1.png';

export default class extends Phaser.Scene {
  constructor() {
    super({ key: 'Preload' });
    this.loadOverworld = true;
    this.enableOWTrainers = !true;
    this.enableOWPokemon = !true;
    this.enablePlayerOWPokemon = !true;
    this.enableAnimations = !true;
  }

  preload () {
    if (this.game.config.debug.console.preload) {
      console.group('Preload::start');
    }
    
    if (this.game.config.debug.inspector) {
      this.load.scripts('inspector', [
        'https://cdn.jsdelivr.net/npm/tweakpane@3.1.0/dist/tweakpane.js',
        'https://cdn.jsdelivr.net/npm/phaser-plugin-inspector@2.0.0-1/dist/phaser-plugin-inspector.umd.js'
      ]);
      this.load.once('complete', () => {
        PhaserPluginInspector.Install(this.plugins);
      });
    }

    var progress = this.add.graphics();

    this.load.on('progress', (value) => {
      progress.clear();
      progress.fillStyle(0xffffff, 1);
      progress.fillRect(0, this.scale.height / 2 - 30, this.scale.width * value, 60);
    });

    this.load.on('complete', () => progress.destroy());

    this.load.image('blank', Tileset.blank);

    // Battle-transition gradients — sampled by GradientTexturePostFxPipeline.
    this.load.image(SHADER_ASSET_KEYS.WIPE,          shader_wipe);
    this.load.image(SHADER_ASSET_KEYS.WIPE_DIAGONAL, shader_wipe_diagonal);
    this.load.image(SHADER_ASSET_KEYS.WIPE_VERTICAL, shader_wipe_vertical);
    this.load.image(SHADER_ASSET_KEYS.CLOSE_BARS,    shader_close_bars);
    this.load.image(SHADER_ASSET_KEYS.TRAPPED,       shader_trapped);
    this.load.image(SHADER_ASSET_KEYS.FOG_DIAGONAL,   shader_fog_diagonal);
    this.load.image(SHADER_ASSET_KEYS.FOG_HORIZONTAL, shader_fog_horizontal);
    this.load.image(SHADER_ASSET_KEYS.SANDSTORM,      shader_sandstorm);
    this.load.image(SHADER_ASSET_KEYS.SNOW_0,         shader_snow0);
    this.load.image(SHADER_ASSET_KEYS.SNOW_1,         shader_snow1);
    
    this.load.spritesheet('red', Tileset.red, {frameWidth: 32, frameHeight: 48});
    this.load.spritesheet('red_bike', Tileset.red_bike, {frameWidth: 48, frameHeight: 48});
    this.load.spritesheet('red_surf', Tileset.red_surf, {frameWidth: 32, frameHeight: 48});
    this.load.spritesheet('leaf', Tileset.leaf, {frameWidth: 32, frameHeight: 48});
    this.load.spritesheet('leaf_bike', Tileset.leaf_bike, {frameWidth: 48, frameHeight: 48});
    this.load.spritesheet('leaf_surf', Tileset.leaf_surf, {frameWidth: 32, frameHeight: 48});
    this.load.spritesheet('brendan', Tileset.brendan, {frameWidth: 32, frameHeight: 48});
    this.load.spritesheet('brendan_bike', Tileset.brendan_bike, {frameWidth: 48, frameHeight: 48});
    this.load.spritesheet('brendan_surf', Tileset.brendan_surf, {frameWidth: 32, frameHeight: 48});
    this.load.spritesheet('may', Tileset.may, {frameWidth: 32, frameHeight: 48});
    this.load.spritesheet('may_bike', Tileset.may_bike, {frameWidth: 48, frameHeight: 48});
    this.load.spritesheet('may_surf', Tileset.may_surf, {frameWidth: 32, frameHeight: 48});
    this.load.spritesheet('base_surf', Tileset.base_surf, {frameWidth: 64, frameHeight: 64});

    // Menu UI icons — per-icon PNGs from public/tileset/ui/ (types + categories)
    // plus the remaining status spritesheet.
    this.load.spritesheet('statuses', Tileset.statuses_sheet, { frameWidth: 44, frameHeight: 16 });
    const TYPE_NAMES = [
      'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
      'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark',
      'steel', 'fairy',
    ];
    const CATEGORY_NAMES = ['physical', 'special', 'status'];
    // Display targets — pre-downscale onto a canvas so Phaser renders at 1:1
    // (no WebGL bilinear smudge on high-contrast pixel art).
    TYPE_NAMES.forEach(t     => this._loadResized(`type-${t}`,     `tileset/ui/types/${t}.png`,     24, 24));
    CATEGORY_NAMES.forEach(c => this._loadResized(`category-${c}`, `tileset/ui/categories/${c}.png`, 24, 24));

    this.load.spritesheet('animated_grass', Tileset.animated_grass, { frameWidth: Tile.WIDTH, frameHeight: Tile.HEIGHT });
    this.load.spritesheet('animation', Tileset.animation_sheet, { frameWidth: Tile.WIDTH, frameHeight: Tile.HEIGHT });
    this.load.spritesheet('gen3_inside', Tileset.gen3inside, { frameWidth: Tile.WIDTH, frameHeight: Tile.HEIGHT });
    this.load.spritesheet('gen3_outside', Tileset.gen3outside, { frameWidth: Tile.WIDTH, frameHeight: Tile.HEIGHT });

    this.preloadTrainers();

    Object.keys(Scenes)
      .filter(scene => scene !== 'Preload')
      .forEach((scene) => {
        this.scene.add(Scenes[scene].name, Scenes[scene], false);
      })
    ;

    if (this.game.config.debug.console.preload) {
      console.log('Preload::complete');
      console.groupEnd();
    }
  }

  /**
   * Load an image, then pre-downscale it onto a canvas at (w, h) using the
   * browser's high-quality smoothing. Registers the canvas as the Phaser
   * texture under `key` so runtime rendering is 1:1 (no WebGL re-scale).
   * Fixes the pixelated/mushy look of high-res UI art scaled on the GPU.
   */
  _loadResized(key, url, w, h) {
    const tmpKey = `__resize_src_${key}`;
    this.load.image(tmpKey, url);
    this.load.once(`filecomplete-image-${tmpKey}`, () => {
      const src = this.textures.get(tmpKey).getSourceImage();
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, 0, 0, w, h);
      this.textures.addCanvas(key, canvas);
      this.textures.remove(tmpKey);
    });
  }

  create () {
    this.createTrainerAnimations();

    // Capture before clearing so we can reapply after loadGame().
    const startFlags = getStartFlags();
    clearStartFlags();

    if (isTestMode()) {
      // Test scenarios must start from a clean slate — don't touch the real
      // localStorage save, and reset every module so stale in-memory state
      // from a previous test run can't leak in either.
      store.commit('game/RESET');
      store.commit('party/RESET');
      store.commit('bag/RESET');
      store.commit('pokedex/RESET');
      store.commit('overworld/RESET');
    } else {
      loadGame();
    }
    initRng(store.state.game.seed);

    if (!getInputManager()) {
      createInputManager(this);
    }

    // Apply test-harness flags AFTER loadGame() so they override any saved state.
    // Write to both game.config.gameFlags (Phaser-level) and the Vuex store.
    if (startFlags) {
      Object.assign(this.game.config.gameFlags, startFlags);
      store.commit('game/PATCH_FLAGS', startFlags);
    }

    // Test-harness debug overrides — deep-merge into game.config.debug so a
    // scenario can switch on visual debug flags (e.g. tests.timeOverlay) for
    // its duration without editing src/data/debug.js. Captured/cleared like
    // startFlags so it stays scoped to the launch.
    const startDebug = getStartDebug();
    clearStartDebug();
    if (startDebug) {
      deepMerge(this.game.config.debug, startDebug);
    }

    // Seed party when running a test scenario and it's empty.
    //   Test scene → randomise a full 6-mon party so menu screens have varied
    //                content to render. Save is blocked while test mode is on,
    //                so nothing here reaches localStorage.
    //   Other test scenes → single Pikachu (legacy behaviour).
    if (startFlags && store.state.party.list.length === 0) {
      if (getStartScene() === 'Test') {
        // Visibility rates intentionally inflated above the real drop rates so
        // menu screens actually render the flags most of the time.
        const STATUS_KEYS = ['SLEEP', 'POISONED', 'BURNED', 'FROZEN', 'PARALYZED', 'TOXIC'];
        const NICKNAMES = [
          'Sparky', 'Rex', 'Bruiser', 'Goldie', 'Spike', 'Tiny',
          'Flash', 'Buddy', 'Champ', 'Scout', 'Zephyr', 'Luna',
          'Shadow', 'Ember', 'Frosty', 'Bolt', 'Pebbles', 'Blaze',
          'Tank', 'Nibbles', 'Jinx',
        ];
        for (let i = 0; i < 6; i++) {
          const natDexId = 1 + Math.floor(Math.random() * 151);
          const level    = 5 + Math.floor(Math.random() * 56);   // 5..60
          const shiny    = Math.random() < 1 / 16;
          const nickname = Math.random() < 0.5
            ? NICKNAMES[Math.floor(Math.random() * NICKNAMES.length)]
            : undefined;
          store.commit('party/ADD_POKEMON', {
            natDexId, level, shiny, nickname,
            tid: store.state.game.trainerId,
          });

          const mon = store.state.party.list[store.state.party.list.length - 1];
          if (!mon) continue;
          if (Math.random() < 1 / 8) mon.pokerus = 1;
          if (Math.random() < 1 / 3) {
            const key = STATUS_KEYS[Math.floor(Math.random() * STATUS_KEYS.length)];
            const turns = key === 'SLEEP' ? 1 + Math.floor(Math.random() * 3)
                        : key === 'TOXIC' ? 1 + Math.floor(Math.random() * 4)
                        : 1;
            mon.status = { [key]: turns };
          }
        }
      } else {
        store.commit('party/ADD_POKEMON', {
          natDexId: 25, level: 15,
          tid: store.state.game.trainerId,
        });
      }
    }

    if (this.game.config.gameFlags.has_bike) {
      const hasBicycle = store.state.bag.keyItems.some(e => e.name === 'Bicycle');
      if (!hasBicycle) {
        store.commit('bag/PICKUP', { name: 'Bicycle', qty: 1 });
      }
    }

    // VITE_LOAD_SLOT=1|2|3 — dev shortcut: hydrate from the given slot and
    // boot straight into its saved map, skipping the title screen. Ignored
    // under test mode (tests control their own state). If the slot is empty
    // or malformed, fall through to the normal boot path.
    const loadSlotRaw = import.meta.env.VITE_LOAD_SLOT;
    let envLoadedSlot = false;
    if (!isTestMode() && loadSlotRaw) {
      const slot = parseInt(loadSlotRaw, 10);
      if (Number.isFinite(slot) && slot >= 1 && slot <= 3) {
        if (localStorage.getItem(`sw_game_slot${slot}`)) {
          // Vuex action handlers run synchronously; by the time dispatch
          // returns here the store is already hydrated and gameDef has been
          // applied, even though dispatch formally returns a Promise.
          store.dispatch('loadGame', slot);
          console.log('Loaded save slot from env variable:', slot);
          envLoadedSlot = true;
        } else {
          console.warn(`VITE_LOAD_SLOT=${slot} but that slot is empty — showing title screen.`);
        }
      } else {
        console.warn(`VITE_LOAD_SLOT=${loadSlotRaw} is not a valid slot (1, 2, or 3) — showing title screen.`);
      }
    }

    const loadMap   = import.meta.env.VITE_LOAD_MAP || '';
    const testScene = getStartScene();

    // Fast-path into a specific map (VITE_LOAD_MAP).
    if (loadMap !== '') {
      console.log('Loading map from env variable:', loadMap);
      this.scene.start(loadMap);
      this.scene.start('OverworldUI');
      this.scene.bringToTop('OverworldUI');
      return;
    }

    // Direct-launch paths: a test harness scene or a hydrated save slot
    // both bypass the title screen and drop you straight into the game.
    if (testScene || envLoadedSlot) {
      const savedTile = testScene ? null : store.state.game.playerTile;
      // Test harness scenarios can pin the player to a specific tile via
      // `setStartPlayerLocation` — takes precedence over save-slot tile and
      // the map's default playerSpawn. Captured/cleared like startFlags.
      const harnessLoc = testScene ? getStartPlayerLocation() : null;
      clearStartPlayerLocation();
      const playerLocation = harnessLoc
        ? { ...harnessLoc }
        : (savedTile && (savedTile.x || savedTile.y))
          ? { x: savedTile.x, y: savedTile.y, charLayer: savedTile.charLayer }
          : {};
      const startScene = testScene || store.state.game.currentMap || getGameDef().overworldScene;
      const startParams = { playerLocation };
      // Restore the map variant that was active when the game was saved.
      // Don't apply variant when launching a test scene — it sets its own.
      if (!testScene && store.state.game.mapVariant) startParams.variant = store.state.game.mapVariant;
      this.scene.start(startScene, startParams);

      if (this.game.config.debug.time) {
        this.scene.start('TimeOverlay');
        this.scene.bringToTop('TimeOverlay');
      }

      this.scene.start('OverworldUI');
      this.scene.bringToTop('OverworldUI');
      return;
    }

    // VITE_SKIP_INTRO: skip the Nintendo + Copyright splash chain but still
    // show the title screen — and jump it straight to the main menu so the
    // dev doesn't have to press-start every reload.
    if (import.meta.env.VITE_SKIP_INTRO === 'true') {
      this.scene.start('TitleScreen', { skipIdle: true });
      return;
    }

    // Full intro chain (default production-style boot).
    this.scene.start('NintendoLogo');
  }

  preloadTrainers() {
    if (!this.enableOWTrainers) {
      return;
    }
    if (this.game.config.debug.console.preload) {
      console.log('Preload::preloadTrainers');
    }
    Object.keys(Tileset.sprites)
      .forEach((name) => {
        console.log(name.toLowerCase(), Tileset.sprites[name]);
        this.load.spritesheet(name.toLowerCase(), Tileset.sprites[name], {
          frameWidth: Tile.WIDTH,
          frameHeight: 48
        });
      });
  }

  createTrainerAnimations() {
    if (!this.enableOWTrainers) {
      return;
    }
    if (this.game.config.debug.console.preload) {
      console.log('Preload::preloadTrainers');
    }

    Object.keys(Tileset.sprites).forEach((name) => {
      this.anims.create({
        key: name.toLowerCase() + '-spin',
        frames: this.anims.generateFrameNumbers(name.toLowerCase(), { frames: [0, 4, 12, 8] }),
        frameRate: 7,
        repeat: -1
      });
    });
  }
}

/**
 * Recursively merge `src` into `target`. Plain-object keys recurse; everything
 * else (primitives, arrays) replaces. Used to apply scenario-supplied debug
 * overrides on top of the default debug config without losing untouched keys.
 */
function deepMerge(target, src) {
  if (!target || !src || typeof src !== 'object') return target;
  for (const k of Object.keys(src)) {
    const sv = src[k];
    if (sv && typeof sv === 'object' && !Array.isArray(sv)
        && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
      deepMerge(target[k], sv);
    } else {
      target[k] = sv;
    }
  }
  return target;
}
