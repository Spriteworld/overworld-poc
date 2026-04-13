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
      progress.fillRect(0, 270, 800 * value, 60);
    });

    this.load.on('complete', () => progress.destroy());

    this.load.image('blank', Tileset.blank);
    this.load.spritesheet('red', Tileset.red, {
      frameWidth: 32,
      frameHeight: 48
    });
    this.load.spritesheet('red_bike', Tileset.trainers.red_bike, {
      frameWidth: 48,
      frameHeight: 48
    });
    this.load.spritesheet('leaf', Tileset.trainers.leaf, {
      frameWidth: 32,
      frameHeight: 48
    });
    this.load.spritesheet('leaf_bike', Tileset.trainers.leaf_bike, {
      frameWidth: 48,
      frameHeight: 48
    });
    this.load.spritesheet('brendan', Tileset.trainers.brendan, {
      frameWidth: 32,
      frameHeight: 48
    });
    this.load.spritesheet('brendan_bike', Tileset.trainers.brendan_bike, {
      frameWidth: 48,
      frameHeight: 48
    });
    this.load.spritesheet('may', Tileset.trainers.may, {
      frameWidth: 32,
      frameHeight: 48
    });
    this.load.spritesheet('may_bike', Tileset.trainers.may_bike, {
      frameWidth: 48,
      frameHeight: 48
    });
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

  create () {
    this.createTrainerAnimations();

    const startFlags = getStartFlags();
    if (startFlags) {
      Object.assign(this.game.config.gameFlags, startFlags);
      clearStartFlags();
    }

    loadGame();

    if (this.game.config.gameFlags.has_bike) {
      const hasBicycle = store.state.bag.keyItems.some(e => e.name === 'Bicycle');
      if (!hasBicycle) {
        store.commit('bag/PICKUP', { name: 'Bicycle', qty: 1 });
      }
    }

    const loadMap = import.meta.env.VITE_LOAD_MAP || '';
    const skipIntro = loadMap || getStartScene() || import.meta.env.VITE_SKIP_INTRO === 'true';

    if (loadMap !== '') {
      console.log('Loading map from env variable:', loadMap);
      this.scene.start(loadMap);
      this.scene.start('OverworldUI');
      this.scene.bringToTop('OverworldUI');
      return;
    }


    if (skipIntro) {
      const savedTile = store.state.game.playerTile;
      const playerLocation = (savedTile && (savedTile.x || savedTile.y))
        ? { x: savedTile.x, y: savedTile.y, charLayer: savedTile.charLayer }
        : {};
      const startScene = loadMap || getStartScene() || store.state.game.currentMap || getGameDef().overworldScene;
      this.scene.start(startScene, { playerLocation });

      if (this.game.config.debug.time) {
        this.scene.start('TimeOverlay');
        this.scene.bringToTop('TimeOverlay');
      }

      this.scene.start('OverworldUI');
      this.scene.bringToTop('OverworldUI');
    } else {
      this.scene.start('NintendoLogo');
    }
  }

  preloadTrainers() {
    if (!this.enableOWTrainers) {
      return;
    }
    if (this.game.config.debug.console.preload) {
      console.log('Preload::preloadTrainers');
    }
    Object.keys(Tileset.trainers)
      .forEach((name) => {
        console.log(name.toLowerCase(), Tileset.trainers[name]);
        this.load.spritesheet(name.toLowerCase(), Tileset.trainers[name], {
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

    Object.keys(Tileset.trainers).forEach((name) => {
      this.anims.create({
        key: name.toLowerCase() + '-spin',
        frames: this.anims.generateFrameNumbers(name.toLowerCase(), { frames: [0, 4, 12, 8] }),
        frameRate: 7,
        repeat: -1
      });
    });
  }
}
