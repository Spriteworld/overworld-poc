const PAD = 20;
const RADIUS = 10;

class Toast {
  constructor(scene, x, y) {
    this.scene = scene;
    this.ox    = x;
    this.oy    = y;

    this._tween = null;
    this._timer = null;

    const depth = Number.MAX_SAFE_INTEGER;
    this._bg   = scene.add.graphics().setDepth(depth - 1).setAlpha(0);
    this._text = scene.add.text(0, 0, '', { fontSize: '20px', color: '#ffffff' })
      .setDepth(depth)
      .setAlpha(0);
  }

  showMessage(msg) {
    // Cancel in-progress animation
    this._tween?.stop();
    this._timer?.remove();

    this._text.setText(msg);

    const bw = this._text.width  + PAD * 2;
    const bh = this._text.height + PAD * 2;

    this._text.setPosition(this.ox + PAD, this.oy + PAD);

    this._bg.clear();
    this._bg.fillStyle(0x000000, 1);
    this._bg.fillRoundedRect(this.ox, this.oy, bw, bh, RADIUS);
    this._bg.lineStyle(2, 0xffffff, 1);
    this._bg.strokeRoundedRect(this.ox, this.oy, bw, bh, RADIUS);

    this._bg.setAlpha(0);
    this._text.setAlpha(0);

    this._tween = this.scene.tweens.add({
      targets:  [this._bg, this._text],
      alpha:    1,
      duration: 450,
      onComplete: () => {
        this._timer = this.scene.time.delayedCall(1500, () => {
          this._tween = this.scene.tweens.add({
            targets:  [this._bg, this._text],
            alpha:    0,
            duration: 450,
            onComplete: () => { this._tween = null; },
          });
        });
      },
    });
  }
}

var toast = function (scene, x, y, _config) {
  return new Toast(scene, x, y);
};

export { toast };
