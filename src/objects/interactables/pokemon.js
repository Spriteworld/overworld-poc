import Debug from '@Data/debug.js';
import { Tile, PkmnOverworld } from '@Objects';
import { getValue, getPropertyValue, remapProps } from '@Utilities';

export default class {
  constructor(scene) {
    this.scene = scene;
  }

  init() {
    if (Debug.functions.interactables.pokemon || Debug.functions.interactableShout) {
      console.log('Interactables::pokemon');
    }
    this.scene.pkmn = this.scene.add.group();
    this.scene.pkmn.setName('pkmn');

    let pkmn = this.scene.findInteractions('pkmn');
    if (pkmn.length === 0) { return; }

    this.scene.pkmn.runChildUpdate = true;
    pkmn.forEach((pokemon) => {
      if (Debug.functions.interactables.pokemon) {
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
        pokemon.x / Tile.WIDTH,
        pokemon.y / Tile.HEIGHT,
        {
          ...remapProps(pokemon.properties)
        }
      );
    });
  }

  addToScene(name, monId, x, y, config) {
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

    if (Debug.functions.interactables.pokemon) {
      console.log('Interactables::pokemon::addToScene', {
        id: name || 'pkmn_' + (this.scene.pkmn.length || monId),
        monId: monId, 
        texture: texture, 
        x: x, 
        y: y
      });
    }
    
    let pkmnDef = {...{
      id: name || 'pkmn_' + (this.scene.pkmn.length || monId),
      texture: texture,
      x: x,
      y: y,
      scene: this.scene,
      'char-layer': 'ground'
    }, ...config };

    let pkmn = new PkmnOverworld(pkmnDef);
    this.scene.pkmn.add(pkmn);
    this.scene.interactTile(this.scene.config.tilemap, pkmnDef, 0xff0000);
    return pkmn;
  }
};