import Debug from '@Data/debug.js';
import { Tile, NPC } from '@Objects';
import { getPropertyValue, remapProps } from '@Utilities';

export default class {
  constructor(scene) {
    this.scene = scene;  
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::npc');
    }
    this.scene.npcs = this.scene.add.group();
    this.scene.npcs.setName('npcs');
    let npcs = this.scene.findInteractions('npc');
    if (npcs.length === 0) { 
      //console.log(['Interactables::npc', 'No NPCs found']);
      return; 
    }
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::npc', npcs]);
    }

    this.scene.npcs.runChildUpdate = true;
    npcs.forEach((npc) => {
      this.addToScene(
        npc.name,
        getPropertyValue(npc.properties, 'texture'),
        npc.x / Tile.WIDTH,
        npc.y / Tile.HEIGHT,
        {
          id: npc.name,
          scene: this.scene,
          ...remapProps(npc.properties)
        }
      );
    });
  }

  addToScene(name, texture, x, y, config) {
    let npcDef = {...{
      id: 'npc_'+name,
      texture: texture,
      x: x,
      y: y,
      scene: this.scene
    }, ...config };

    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::npc::addToScene', name, texture, x, y);
    }
    let npcObj = new NPC(npcDef);
    this.scene.npcs.add(npcObj);
    this.scene.interactTile(this.scene.game.config.tilemap, npcDef, 0x000000);
    return npcObj;
  }

  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::pokemon::event', this.scene]);
    }

    this.scene.game.events.on('interact-with-obj', (tile) => {
      if (tile.obj.type !== 'npc') { return; }

      let text = this.scene.getPropertyFromTile(tile.obj, 'text');
      if (!text) { return; }
      let player = this.scene.characters.get('player');
      let char = this.scene.characters.get(tile.obj.id);
      char.look(player.getOppositeFacingDirection());
      char.stopSpin(true);
      
      this.scene.game.events.emit(
        'textbox-changedata', 
        text, 
        tile.obj
      );
    });
  }
}