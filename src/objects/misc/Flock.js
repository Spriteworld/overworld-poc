import Phaser from 'phaser';
import { Direction } from '@Objects';
import { Vector2 } from '@Utilities';

export default class extends Phaser.GameObjects.Container {
  constructor(scene, name, pokeId, x, y, dir, grid) {
    super(scene, x, y);
    this.scene = scene;
    this.name = name;
    this.pokeId = pokeId;
    this.direction = dir;
    this.grid = grid;

    this.active = true;

    console.log('Creating flock', this.name, 'with direction', this.direction);
    let pkmnObj = {
      scene: this.scene,
      'facing-direction': this.direction.toLowerCase(),
      'spin': false,
      'char-layer': 'top',
      'can-run': false,
      collides: false,
    };

    if (pkmnObj['char-layer'] === 'top') {
      this.setDepth(10000);
    }

    this.generateMon(pkmnObj);
    this.sortMon();

    this.scene.add.existing(this);
  }

  update(time, delta) {
    if (!this.scene.ge_init) { return; }

    const w = this.scene.config.tilemap.width;
    const h = this.scene.config.tilemap.height;
    // Only hide at the edge the flock is travelling *toward* — otherwise
    // a flock spawned near the opposite edge would hide on frame 1.
    const atExitEdge = (pos) => {
      switch (this.direction) {
        case Direction.RIGHT: return pos.x >= w - 1;
        case Direction.LEFT:  return pos.x <= 0;
        case Direction.DOWN:  return pos.y >= h - 1;
        case Direction.UP:    return pos.y <= 0;
        default:              return false;
      }
    };
    const firstTick = !this._ticked;
    this._ticked = true;

    Object.values(this.list)
      .forEach(mon => {
        if (!mon.visible) { return; }

        if (!firstTick && atExitEdge(mon.getPosition())) {
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
    switch(this.direction) {
      case Direction.LEFT:
      case Direction.RIGHT:
        this.list = this.list.sort((a, b) => a.x == b.x ? a.y - b.y : a.x - b.x);
        if (this.direction === Direction.RIGHT) { this.list = this.list.reverse(); }
      break;
      case Direction.DOWN:
      case Direction.UP:
        this.list = this.list.sort((a, b) => a.y == b.y ? a.x - b.x : a.y - b.y);
        if (this.direction === Direction.DOWN) { this.list = this.list.reverse(); }
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
            Vector2(x_counter, y_counter),
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
