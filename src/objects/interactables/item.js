import { Items, Tile } from '@Objects';
import { getPropertyValue, checkOnlyIf } from '@Utilities';
import store from '../../store/index.js';

export default class {
  constructor(scene) {
    this.scene = scene;
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::item');
    }
    const collected = store.state.overworld.collectedItems;
    const itemObjs = this.scene.findInteractions('item');
    itemObjs.forEach(obj => {
      if (collected.includes(obj.name)){
        return;
      }

      if (!checkOnlyIf(getPropertyValue(obj.properties, 'only_if'), store.state.game.gameFlags, this.scene.config.variant ?? null, this.scene.mapVars ?? {})) return;

      const itemName = getPropertyValue(obj.properties, 'item');
      if (!itemName){
        return;
      }

      // Tiled tile objects (gid) anchor at bottom-left, so subtract height to
      // get the top-left tile coord that Items.Pokeball positions from.
      let item = new Items.Pokeball({
        scene: this.scene,
        x: obj.x / Tile.WIDTH,
        y: (obj.y - obj.height) / Tile.HEIGHT,
        item: itemName,
        overworldKey: obj.name,
      });
      if (getPropertyValue(obj.properties, 'hidden')) {
        item.setVisible(false);
      }
    });
  }

  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::item::event', this.scene]);
    }

    this._onInteract = (tile) => {
      if (tile.obj.type !== 'item') { return; }

      let item = this.scene.getPropertyFromTile(tile.obj, 'item');
      if (!item) { return; }
      const qty = this.scene.getPropertyFromTile(tile.obj, 'quantity') ?? 1;

      // Remove immediately so a second Z-press (to dismiss the textbox)
      // doesn't re-trigger interact-with-obj for the same tile.
      this.scene.removeInteraction(tile.obj.id);

      // Mark collected so it won't reappear after reload.
      if (tile.obj.overworldKey) {
        store.commit('overworld/COLLECT_ITEM', tile.obj.overworldKey);
      }

      this.scene.game.events.emit('textbox-changedata', `You found a ${item}!`, tile.obj);
      this.scene.game.events.once('textbox-disable', () => {
        this.scene.game.events.emit('item-pickup', item);
        let char = this.scene.characters.get(tile.obj.id);
        if (typeof char === 'undefined') { return; }
        char.remove();
      });
    };
    this.scene.game.events.on('interact-with-obj', this._onInteract);
  }

  destroy() {
    this.scene.game.events.off('interact-with-obj', this._onInteract);
  }
}