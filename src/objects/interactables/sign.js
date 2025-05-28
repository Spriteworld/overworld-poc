export default class {
  constructor(scene) {
    this.scene = scene;  
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::sign');
    }
    let signs = this.scene.findInteractions('sign');
    if (signs.length === 0) { return; }

    signs.forEach((sign) => {
      // sign.x /= Tile.WIDTH;
      // sign.y /= Tile.HEIGHT;
      this.scene.interactTile(this.scene.game.config.tilemap, sign, 0x00afe4);
    });
  }

  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::sign::event', this.scene]);
    }

    this.scene.game.events.on('interact-with-obj', (tile) => {
      if (tile.obj.type !== 'sign') { return; }

      let signProps = this.scene.getPropertiesFromTile(tile.obj);
      if (signProps.size === 0) { return; }

      this.scene.game.events.emit(
        'textbox-changedata', 
        this.scene.getPropertyFromTile(tile.obj, 'text'), 
        tile.obj
      );
    });
  }
}