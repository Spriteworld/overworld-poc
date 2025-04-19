import Phaser from 'phaser';
import { Tile } from '@Objects';

export default class extends Phaser.GameObjects.Container {
  constructor(scene, name, pokeId, x, y, dir, grid) {
    super(scene, x, y);
    this.scene = scene;
    this.name = name;
    this.pokeId = pokeId;
    this.direction = dir;
    this.grid = grid;

    this.active = true;

    let pkmnObj = {
      scene: this.scene,
      'facing-direction': this.direction.toLowerCase(),
      'spin': false,
      'char-layer': 'sky',
      'can-run': false,
      collides: false,
    };

    if (pkmnObj['char-layer'] === 'sky') {
      this.setDepth(10000);
    }

    this.generateMon(pkmnObj);
    this.sortMon();

    this.scene.add.existing(this);
  }

  update(time, delta) {
    if (!this.scene.ge_init) { return; }

    Object.values(this.list)
      .forEach(mon => {
        if (!mon.visible) { return; }

        let pos = mon.getPosition();

        if ([0, this.scene.config.tilemap.width-1].includes(pos.x)
          || [0, this.scene.config.tilemap.height-1].includes(pos.y)) {

          mon.setVisible(false);
          mon.move(this.direction);

          // no mon are visible, disable this flock
          if (this.list.every(mon => !mon.visible)) {
            this.active = false;
          }
        } else {
          mon.move(this.direction);
        }
      });
  }

  sortMon() {
    switch(this.direction.toLowerCase()) {
      case 'left':
      case 'right':
        this.list = this.list.sort((a, b) => a.x == b.x ? a.y - b.y : a.x - b.x);
        if (this.direction === 'right') { this.list = this.list.reverse(); }
      break;
      case 'down':
      case 'up':
        this.list = this.list.sort((a, b) => a.y == b.y ? a.x - b.x : a.y - b.y);
        if (this.direction === 'down') { this.list = this.list.reverse(); }
      break;
    }
  }

  generateMon(pkmnObj) {
    var counter = 0;

    var y_counter = this.y;
    this.grid.forEach(row => {
      var x_counter = this.x;
      row.forEach(enabled => {
        if (enabled) {
          let mon = this.scene.mapPlugins?.pokemon.addToScene(
            'flock_'+this.name+'_'+counter,
            this.pokeId,
            x_counter,
            y_counter,
            {
              ...pkmnObj,
              'ignore-warp': true,
            }
          );
          mon.setState(mon.stateDef.MOVE);
          this.add(mon);

          counter++;
        }
        x_counter++;
      });
      y_counter++;
    });
  }

}
