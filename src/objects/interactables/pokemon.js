import Debug from '@Data/debug.js';
import { Tile, PkmnOverworld } from '@Objects';
import { getValue, getPropertyValue, remapProps, Vector2 } from '@Utilities';
import Tileset from '@Tileset';

export default class {
  constructor(scene) {
    this.scene = scene;
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::pokemon');
    }
    this.scene.pkmn = this.scene.add.group();
    this.scene.pkmn.setName('pkmn');

    let pkmn = this.scene.findInteractions('pkmn');
    if (pkmn.length === 0) { return; }

    this.scene.pkmn.runChildUpdate = true;
    pkmn.forEach((pokemon) => {
      if (this.scene.game.config.debug.console.interactableShout) {
        console.log(
          'Interactables::pokemon::each',
          pokemon.name,
          getPropertyValue(pokemon.properties, 'texture'),
          pokemon.x, pokemon.y
        );
      }
      this.addToScene(
        pokemon.name,
        getPropertyValue(pokemon.properties, 'texture'),
        Vector2(pokemon.x / Tile.WIDTH, pokemon.y / Tile.HEIGHT),
        {
          ...remapProps(pokemon.properties)
        }
      );
    });
  }

  addToScene(name, monId, coords, config) {
    if (config && config.texture) { delete config.texture; }

    let rng = false;
    if (monId == 'RNG') {
      monId = Math.floor(Math.random() * this.scene.totalMon);
      rng = true;
    }
    if (typeof monId === 'number') {
      monId = monId.toString();
    }
    monId = monId.padStart(3, '0');

    if (rng) {
      console.info('mon got RNGd', monId, config.id, config);
    }

    // check for shiny
    let texture = monId.toString();
    if (getValue(config, 'shiny', false)) {
      texture += 's';
    }

    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::pokemon::addToScene', {
        id: name || 'pkmn_' + (this.scene.pkmn.length || monId),
        monId: monId,
        texture: texture,
        x: coords.x,
        y: coords.y
      });
    }

    let pkmnDef = {...{
      id: name || 'pkmn_' + (this.scene.pkmn.length || monId),
      texture: texture,
      x: coords.x,
      y: coords.y,
      scene: this.scene,
      'char-layer': 'ground'
    }, ...config };

    // Always create immediately so GridEngine can manage this character from scene init.
    // If the texture isn't loaded yet it will show a placeholder; setTexture() fixes it once loaded.
    let pkmn = new PkmnOverworld(pkmnDef);
    this.scene.pkmn.add(pkmn);
    this.scene.interactTile(this.scene.game.config.tilemap, pkmnDef, 0xff0000);

    if (this.scene.textures.exists(texture)) {
      this._ensureAnim(texture);
      // If GridEngine is already initialised (dynamic spawn mid-game), register now
      if (this.scene.ge_init) {
        this.scene.gridEngine.addCharacter(pkmn.characterDef());
      }
    } else {
      const isShiny = texture.endsWith('s');
      const path = isShiny ? Tileset.pokemon_shiny[texture] : Tileset.pokemon[texture];
      const dimSource = isShiny ? Tileset.ow_pokemon_shiny_dimensions : Tileset.ow_pokemon_dimensions;
      const dims = dimSource.default[texture];

      if (!path || !dims) {
        console.error('Interactables::pokemon: missing sprite data for', texture);
        return pkmn;
      }

      // Use the already-loaded 'red' spritesheet as a placeholder so GridEngine can
      // manage frames normally without __MISSING frame warnings.
      pkmn.setTexture('red');

      if (this.scene.ge_init) {
        this.scene.gridEngine.addCharacter(pkmn.characterDef());
      }

      this.scene.load.spritesheet(texture, path, {
        frameWidth: dims.width / 4,
        frameHeight: dims.height / 4
      });
      this.scene.load.once('filecomplete-spritesheet-' + texture, () => {
        this._ensureAnim(texture);
        this.scene.pkmn.getChildren()
          .filter(p => p.config?.texture === texture)
          .forEach(p => p.setTexture(texture));
      });
      this.scene.load.start();
    }

    return pkmn;
  }

  _ensureAnim(texture) {
    if (!this.scene.anims.exists(texture + '-spin')) {
      this.scene.anims.create({
        key: texture + '-spin',
        frames: this.scene.anims.generateFrameNumbers(texture, { frames: [0, 4, 12, 8] }),
        frameRate: 7,
        repeat: -1
      });
    }
  }

  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::pokemon::event', this.scene]);
    }

    this._onInteract = (tile) => {
      if (tile.obj.type !== 'pkmn') { return; }

      let text = this.scene.getPropertyFromTile(tile.obj, 'text');
      if (!text) { return; }
      let player = this.scene.characters.get('player');
      let char = this.scene.characters.get(tile.obj.id);
      char?.look(player.getOppositeFacingDirection());
      char?.stopSpin(true);

      this.scene.game.events.emit(
        'textbox-changedata',
        text,
        tile.obj
      );
    };
    this.scene.game.events.on('interact-with-obj', this._onInteract);
  }

  destroy() {
    this.scene.game.events.off('interact-with-obj', this._onInteract);
  }
};
