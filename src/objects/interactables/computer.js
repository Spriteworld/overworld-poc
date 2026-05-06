const COMPUTER_TYPES = new Set(['personalComputer', 'pokecenterComputer']);

export default class {
  constructor(scene) {
    this.scene = scene;
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::computer');
    }
  }

  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::computer::event', this.scene]);
    }

    this._onInteract = (tile) => {
      if (!COMPUTER_TYPES.has(tile.obj.type)) { return; }

      this.scene.game.events.emit('computer-open', { type: tile.obj.type });
    };
    this.scene.game.events.on('interact-with-obj', this._onInteract);
  }

  destroy() {
    this.scene.game.events.off('interact-with-obj', this._onInteract);
  }
}
