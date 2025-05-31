export default class {
  constructor(scene) {
    this.scene = scene;
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::cutTree');
    }
  }

  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::cutTree::event', this.scene]);
    }

    this.scene.game.events.on('interact-with-obj', (tile) => {
      if (tile.obj.type !== 'cut-tree') { return; }

      let text = this.scene.getPropertyFromTile(tile.obj, 'text');
      if (!text) { return; }
      
      this.scene.game.events.emit(
        'textbox-changedata', 
        text, 
        tile.obj
      );
      this.scene.game.events.once('textbox-disable', () => {
        this.scene.removeInteraction(tile.obj.id);
        let char = this.scene.characters.get(tile.obj.id);
        if (typeof char === 'undefined') { return; }
        char.remove();
      });
    });
  }
};