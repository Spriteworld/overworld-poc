import Phaser from 'phaser';
import { Tile, GameMap } from '@Objects';
import Tileset from '@Tileset';
import Scenes from '@Scenes';
import { getPropertyValue } from '@Utilities';
import Debug from '@Data/debug.js';

export default class extends Phaser.Scene {
  constructor() {
    super({ key: 'Preload' });
    this.loadOverworld = true;
    this.enableOWTrainers = true;
    this.enableOWPokemon = true;
    this.enablePlayerOWPokemon = true;
    this.enableAnimations = true;
  }

  preload () {
    console.group('Preload::start');

    this.load.scripts('inspector', [
      'https://cdn.jsdelivr.net/npm/tweakpane@3.1.0/dist/tweakpane.js',
      'https://cdn.jsdelivr.net/npm/phaser-plugin-inspector@2.0.0-1/dist/phaser-plugin-inspector.umd.js'
    ]);
    this.load.once('complete', () => {
      PhaserPluginInspector.Install(this.plugins);
    });

    var progress = this.add.graphics();

    this.load.on('progress', (value) => {
      progress.clear();
      progress.fillStyle(0xffffff, 1);
      progress.fillRect(0, 270, 800 * value, 60);
    });

    this.load.on('complete', () => progress.destroy());

    this.load.image('blank', Tileset.blank);
    this.load.image('gen3_inside', Tileset.gen3inside);
    this.load.image('gen3_outside', Tileset.gen3outside);
    this.load.image('rse_inside', Tileset.rse_inside);
    this.load.image('rse_outside', Tileset.rse_outside);
    this.load.spritesheet('red', Tileset.red, {
      frameWidth: Tile.WIDTH,
      frameHeight: 40
    });

    this.preloadTrainers();
    this.preloadPokemon();

    // console.log(Scenes);
    Object.keys(Scenes)
      .filter(scene => scene !== 'Preload')
      .forEach((scene) => {
        this.scene.add(Scenes[scene].name, Scenes[scene], false);
      })
    ;

    // console.tablogle(spriteworld.textures.list);
    console.groupEnd();
    console.log('Preload::complete');
  }

  create () {
    this.scene.start('Test');

    if (Debug.time) {
      this.scene.start('TimeOverlay');
      this.scene.bringToTop('TimeOverlay');
    }

    this.scene.start('OverworldUI');
    this.scene.bringToTop('OverworldUI');
    this.createTrainerAnimations();
    // this.createPokemonAnimations();
  }

  preloadTrainers() {
    if (!this.enableOWTrainers) {
      return;
    }

    Object.keys(Tileset.trainers)
      .forEach((name) => {
        console.log(name.toLowerCase(), Tileset.trainers[name]);
        this.load.spritesheet(name.toLowerCase(), Tileset.trainers[name], {
          frameWidth: Tile.WIDTH,
          frameHeight: 42
        });
      });
  }

  createTrainerAnimations() {
    if (!this.enableOWTrainers) {
      return;
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

  preloadPokemon() {
    if (!this.enableOWPokemon) {
      return;
    }
    console.log('Preload::preloadPokemon');

    Object.keys(Tileset.pokemon)
      .forEach(name => {
        let pkmn_dimensions = Tileset.ow_pokemon_dimensions.default[name];
        this.load.spritesheet(name, Tileset.pokemon[name], {
          frameWidth: pkmn_dimensions.width / 4,
          frameHeight: pkmn_dimensions.height / 4
        });
      })
    ;

    Object.keys(Tileset.pokemon_shiny)
      .forEach(name => {
        let pkmn_dimensions = Tileset.ow_pokemon_shiny_dimensions.default[name];
        this.load.spritesheet(name, Tileset.pokemon_shiny[name], {
          frameWidth: pkmn_dimensions.width / 4,
          frameHeight: pkmn_dimensions.height / 4
        });
      })
    ;
  }

  preloadPokemonAnimations() {
    if (!this.enableOWPokemon) {
      return;
    }
    console.log('Preload::loadPokemonAnimations');
    Object.keys(Tileset.pokemon)
      .forEach(name => {
        this.anims.create({
          key: name+'-spin',
          frames: this.anims.generateFrameNumbers(name, { frames: [0, 4, 12, 8] }),
          frameRate: 7,
          repeat: -1
        });
        this.anims.create({
          key: name+'s-spin',
          frames: this.anims.generateFrameNumbers(name + 's', { frames: [0, 4, 12, 8] }),
          frameRate: 7,
          repeat: -1
        });
      })
    ;
  }
}
