import { Items, Tile } from '@Objects';
import { playSfx } from '@Utilities/AudioManager.js';
import store from '../../store/index.js';

export default class {
  constructor(scene) {
    this.scene = scene;
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::cutTree');
    }
    const trees = this.scene.findInteractions('cutTree');
    trees.forEach(obj => {
      // Tiled tile objects (gid) anchor at bottom-left, so subtract height to
      // get the top-left tile coord that Items.CutTree positions from.
      new Items.CutTree({
        scene: this.scene,
        x: obj.x / Tile.WIDTH,
        y: (obj.y - obj.height) / Tile.HEIGHT,
      });
    });
  }

  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::cutTree::event', this.scene]);
    }

    this._onInteract = (tile) => {
      if (tile.obj.type !== 'cut-tree') { return; }

      const hasCut = !!store.state.game.gameFlags.has_cut;
      const text = hasCut
        ? 'This tree can be CUT.'
        : 'You need the CUT ability to cut this tree.';

      this.scene.game.events.emit('textbox-changedata', text, tile.obj);

      if (!hasCut) { return; }

      this.scene.game.events.once('textbox-disable', () => {
        playSfx(this.scene, 'cut');
        this.scene.removeInteraction(tile.obj.id);
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
};