import { Tile, NPC } from '@Objects';
import { getPropertyValue, remapProps, Vector2 } from '@Utilities';
import Tileset from '@Tileset';
import store from '../../store/index.js';

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
        getPropertyValue(npc.properties, 'overworld-sprite'),
        Vector2(npc.x / Tile.WIDTH, npc.y / Tile.HEIGHT),
        {
          id: npc.name,
          scene: this.scene,
          properties: npc.properties,
          ...remapProps(npc.properties)
        }
      );
    });
  }

  addToScene(name, texture, coords, config) {
    let npcDef = {
      id: 'npc_'+name,
      type: 'npc',
      texture: texture,
      x: coords.x,
      y: coords.y,
      scene: this.scene,
      collides: { enabled: true },
      ...config,
      'seen-character': '',
      'seen-radius': 0,
    };

    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::npc::addToScene', name, texture, coords.x, coords.y);
    }

    // Always create immediately so GridEngine can manage this character from scene init.
    // If the texture isn't loaded yet it will show a placeholder; setTexture() fixes it once loaded.
    let npcObj = new NPC(npcDef);
    this.scene.npcs.add(npcObj);
    this.scene.interactTile(this.scene.game.config.tilemap, npcDef, 0x000000);

    if (this.scene.textures.exists(texture)) {
      this._ensureAnim(texture);
      // If GridEngine is already initialised (dynamic spawn mid-game), register now
      if (this.scene.ge_init) {
        this.scene.gridEngine.addCharacter(npcObj.characterDef());
      }
    } else {
      const path = texture ? Tileset.trainers[texture] : null;
      if (!path) {
        if (texture) console.warn('Interactables::npc: no sprite path for texture', texture);
        // Fall back to placeholder so GridEngine can still manage this character.
        npcObj.setTexture('red');
        if (this.scene.ge_init) {
          this.scene.gridEngine.addCharacter(npcObj.characterDef());
        }
        return npcObj;
      }

      // Use the already-loaded 'red' spritesheet as a placeholder so GridEngine can
      // manage frames normally without __MISSING frame warnings.
      npcObj.setTexture('red');

      if (this.scene.ge_init) {
        this.scene.gridEngine.addCharacter(npcObj.characterDef());
      }

      this.scene.load.spritesheet(texture, path, {
        frameWidth: Tile.WIDTH,
        frameHeight: 42
      });
      this.scene.load.once('filecomplete-spritesheet-' + texture, () => {
        this._ensureAnim(texture);
        this.scene.npcs.getChildren()
          .filter(n => n.config?.texture === texture)
          .forEach(n => n.setTexture(texture));
      });
      this.scene.load.start();
    }

    return npcObj;
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
      if (tile.obj.type !== 'npc') { return; }

      const npcName = tile.obj.name || tile.obj.id;
      const gaveFlag = 'npc_gave_' + npcName;
      const gaveAlready = !!store.state.game.gameFlags[gaveFlag];

      // Use text-given on repeat interactions if provided, otherwise fall back to text.
      const textGiven = this.scene.getPropertyFromTile(tile.obj, 'text-given');
      const text = (gaveAlready && textGiven)
        ? textGiven
        : this.scene.getPropertyFromTile(tile.obj, 'text');
      if (!text) { return; }

      let player = this.scene.characters.get('player');
      let char = this.scene.characters.get(tile.obj.id);
      char.look(player.getOppositeFacingDirection());
      char.stopSpin(true);
      char.stopMove(true);

      this.scene.game.events.emit(
        'textbox-changedata',
        text,
        tile.obj
      );

      const onComplete = this.scene.getPropertyFromTile(tile.obj, 'text-onComplete');
      const [action, data] = onComplete.split(':');
      if (action === 'item' && !gaveAlready) {
        this.scene.game.events.once('textbox-disable', () => {
          this.scene.game.events.emit('item-pickup', data);
          store.commit('game/PATCH_FLAGS', { [gaveFlag]: true });
        });
      }

      if (action === 'heal') {
        this.scene.game.events.once('textbox-disable', () => {
          store.commit('party/RESTORE_ALL');
          const player = this.scene.characters.get('player');
          const pos = player?.getPosition() ?? { x: 0, y: 0 };
          store.commit('game/SET_HEAL_LOCATION', {
            map:       this.scene.scene.key,
            x:         pos.x,
            y:         pos.y,
            charLayer: player?.getCharLayer?.() ?? 'ground',
          });
        });
      }
    };
    this.scene.game.events.on('interact-with-obj', this._onInteract);
  }

  destroy() {
    this.scene.game.events.off('interact-with-obj', this._onInteract);
  }
}
