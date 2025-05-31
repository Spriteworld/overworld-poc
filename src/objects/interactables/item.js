export default class {
  constructor(scene) {
    this.scene = scene;  
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::item');
    }
    
  }

  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::sign::event', this.scene]);
    }

    this.scene.game.events.on('interact-with-obj', (tile) => {
      if (tile.obj.type !== 'item') { return; }

      let item = this.scene.getPropertyFromTile(tile.obj, 'item');
      if (!item) { return; }
      
      this.scene.game.events.emit(
        'textbox-changedata', 
        `You found a ${item}!`, 
        tile.obj
      );
      this.scene.game.events.once('textbox-disable', () => {
        this.scene.game.events.emit('item-pickup', item);

        this.scene.removeInteraction(tile.obj.id);
        
        let char = this.scene.characters.get(tile.obj.id);
        if (typeof char === 'undefined') { return; }
        char.remove();
      });
    });
  }
}