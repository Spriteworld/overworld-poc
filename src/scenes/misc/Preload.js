import Phaser from 'phaser';
import { Tile } from '@Objects';
import Tileset from '@Tileset';

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

    // this.load.scripts('inspector', [
    //   'https://cdn.jsdelivr.net/npm/tweakpane@3.1.0/dist/tweakpane.js',
    //   'https://cdn.jsdelivr.net/npm/phaser-plugin-inspector@1.9.1/dist/phaser-plugin-inspector.umd.js',
    // ]);
    // this.load.once('complete', () => {
    //   PhaserPluginInspector.Install(this.plugins);
    // });

    var progress = this.add.graphics();

    this.load.on('progress', function (value) {
      progress.clear();
      progress.fillStyle(0xffffff, 1);
      progress.fillRect(0, 270, 800 * value, 60);
    });

    this.load.on('complete', function () {
      progress.destroy();
    });

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
    // console.log(spriteworld.textures.list);
    console.groupEnd();
    console.log('Preload::complete');
  }

  create () {
    this.scene.start('Test');
    // this.scene.start('TimeOverlay');
    // this.scene.bringToTop('TimeOverlay');
    this.scene.start('OverworldUI');
    this.scene.bringToTop('OverworldUI');
    this.createTrainerAnimations();
    this.createPokemonAnimations();
  }

  preloadTrainers() {
    if (!this.enableOWTrainers) {
      return;
    }

    Object.keys(Tileset.trainers).forEach((name) => {
      console.log(name.toLowerCase(), Tileset.trainers[name]);
      this.load.spritesheet(name.toLowerCase(), Tileset.trainers[name], {
        frameWidth: Tile.WIDTH,
        frameHeight: 42
      });
    });
  }

  preloadPokemon() {
    if (!this.enableOWPokemon) {
      return;
    }

    Object.keys(Tileset.pokemon).forEach((name) => {
      this.load.spritesheet(name, Tileset.pokemon[name], {
        frameWidth: Tileset.ow_pokemon_dimensions.default[name].width / 4,
        frameHeight: Tileset.ow_pokemon_dimensions.default[name].height / 4
      });
    });

    Object.keys(Tileset.pokemon_shiny).forEach((name) => {
      this.load.spritesheet(name, Tileset.pokemon_shiny[name], {
        frameWidth: Tileset.ow_pokemon_shiny_dimensions.default[name].width / 4,
        frameHeight: Tileset.ow_pokemon_shiny_dimensions.default[name].height / 4
      });
    });
  }

  createTrainerAnimations() {
    if (!this.enableOWTrainers) {
      return;
    }

    Object.keys(Tileset.trainers).forEach((name) => {
      this.anims.create({
        key: name+'-spin',
        frames: this.anims.generateFrameNumbers(name, { frames: [0, 4, 12, 8] }),
        frameRate: 7,
        repeat: -1
      });
    });
  }

  createPokemonAnimations() {
    if (!this.enableOWPokemon) {
      return;
    }

    Object.keys(Tileset.pokemon).forEach((name) => {
      this.anims.create({
        key: name+'-spin',
        frames: this.anims.generateFrameNumbers(name, { frames: [0, 4, 12, 8] }),
        frameRate: 7,
        repeat: -1
      });
    });

    Object.keys(Tileset.pokemon_shiny).forEach((name) => {
      this.anims.create({
        key: name+'-spin',
        frames: this.anims.generateFrameNumbers(name, { frames: [0, 4, 12, 8] }),
        frameRate: 7,
        repeat: -1
      });
    });
  }
}
