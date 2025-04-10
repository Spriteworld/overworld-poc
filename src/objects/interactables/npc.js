import Debug from '@Data/debug.js';
import { Tile, NPC } from '@Objects';
import { getPropertyValue, remapProps } from '@Utilities';

export default class {
  constructor(scene) {
    this.scene = scene;  
  }

  init() {
    if (Debug.functions.gameMap) {
      console.log('GameMap::interactables->initNpc');
    }
    this.scene.npcs = this.scene.add.group();
    this.scene.npcs.setName('npcs');
    let npcs = this.scene.findInteractions('npc');
    if (npcs.length === 0) { return; }

    this.scene.npcs.runChildUpdate = true;
    npcs.forEach((npc) => {
      this.addNPCToScene(
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

  update() {
    if (Debug.functions.gameMap) {
      console.log('GameMap::updateNpcs');
    }
    this.scene.npcs.children.entries.forEach((npc) => {
      if (npc.update) {
        npc.update();
      }
    });
  }

  addNPCToScene(name, texture, x, y, config) {
    let npcDef = {...{
      id: 'npc_'+name,
      texture: texture,
      x: x,
      y: y,
      scene: this.scene
    }, ...config };

    if (Debug.functions.gameMap) {
      console.log('GameMap::addNPCToScene', name, texture, x, y);
    }
    let npcObj = new NPC(npcDef);
    this.scene.npcs.add(npcObj);
    this.scene.interactTile(this.scene.config.tilemap, npcDef, 0x000000);
    return npcObj;
  }
}