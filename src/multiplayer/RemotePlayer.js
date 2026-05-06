import NPC from '@Objects/characters/NPC.js';

const LABEL_STYLE = {
  fontFamily: 'Gen3',
  fontSize:   '10px',
  color:      '#ffffff',
  stroke:     '#000000',
  strokeThickness: 2,
  padding:    { y: 2 },
};

export default class RemotePlayer extends NPC {
  /**
   * @param {object} config
   * @param {string} config.playerName - Display name shown above the sprite.
   */
  constructor(config) {
    super({
      spin:            false,
      move:            false,
      collides:        true,
      'seen-radius':   0,
      'seen-character':'',
      ...config,
      reflect: true,
      type: 'remote-player',
    });

    this._nameLabel = this.config.scene.add.text(0, 0, config.playerName ?? '', LABEL_STYLE)
      .setOrigin(0.5, 1);

    this._updateLabelPos();
    this.once('destroy', () => {
      // Skip the label destroy during scene shutdown: Phaser's DisplayList
      // sweep iterates backwards with a cached index, and destroying the
      // label here would splice a sibling out of the same list mid-sweep,
      // leaving a hole that crashes the next `list[i].destroy()`. Phaser
      // destroys every DisplayList child on shutdown anyway.
      const status = this.config.scene?.sys?.settings?.status;
      const sceneDown = typeof status === 'number' && status >= 8;
      if (sceneDown) return;
      this._nameLabel?.destroy();
    });
  }

  update(time, delta) {
    super.update(time, delta);
    this.reflection?.update();
    this._updateLabelPos();
  }

  /** Live-update the overhead label (e.g. peer renamed mid-session). */
  setPlayerName(name) {
    if (!this._nameLabel) return;
    this._nameLabel.setText(name ?? '');
    this._updateLabelPos();
  }

  _updateLabelPos() {
    if (!this._nameLabel?.active) return;
    const b = this.getBounds();
    this._nameLabel.setPosition(b.x + b.width / 2, b.y - 2);
    this._nameLabel.setDepth(this.depth + 1);
  }
}
