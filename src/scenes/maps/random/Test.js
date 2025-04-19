import {GameMap, Flock, Direction, Tile, Interactables} from '@Objects';
import {TestMap} from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Test',
      map: TestMap,
      active: false,
      visible: false,
    });
    this.config['char-layer'] = 'ground';

    this.npc1 = {};
    this.npc2 = {};
    this.pokemon = [3, 6, 9, 22, 25, 197, '197s'];
  }

  preload() {
    this.preloadMap();
  }

  create () {
    this.loadMap();
    this.npc1 = this.mapPlugins?.npc.addToScene('bob', 'police_man', 7, 21);
    this.npc2 = this.mapPlugins?.pokemon.addToScene('pika', 25, 31, 20);

    // this.flock = new Flock(
    //   this,
    //   'fearow',
    //   '022',
    //   1,
    //   14,
    //   Direction.RIGHT,
    //   [
    //     [1,0,0],
    //     [0,1,0],
    //     [0,0,1],
    //     [0,1,0],
    //     [1,0,0],
    //   ]
    // );

    this.createCharacters();

    this.gridEngine
      .positionChangeFinished()
      .subscribe(({ charId, exitTile, enterTile }) => {
        if ([this.npc1.config.id].includes(charId)) {
          // console.log('npc1', charId, exitTile, enterTile);
          let npc1Pos = this.npc1.getPosition();
          if (npc1Pos.x == 10 && npc1Pos.y == 21) {
            this.npc1.moveTo(4, 20, {
              noPathFoundStrategy: 'RETRY'
            });
          }
        }
        if ([this.npc2.config.id].includes(charId)) {
          // console.log('npc2', charId, exitTile, enterTile);
          let npc2Pos = this.npc2.getPosition();
          if (npc2Pos.x == 41 && npc2Pos.y == 22) {
            this.npc2.moveTo(41, 20, {
              noPathFoundStrategy: 'RETRY'
            });
          }
          if (npc2Pos.x == 33 && npc2Pos.y == 20) { this.npc2.move('down');}
          if (npc2Pos.x == 31 && npc2Pos.y == 24) { 
            this.npc2.moveTo(32, 22, {
              noPathFoundStrategy: 'RETRY'
            });
          }
          if (npc2Pos.x == 36 && npc2Pos.y == 22) { this.npc2.move('down'); }



          if (npc2Pos.x == 36 && npc2Pos.y == 24) { this.npc2.move('right'); }
          if (npc2Pos.x == 39 && npc2Pos.y == 24) { this.npc2.move('up'); }
          if (npc2Pos.x == 39 && npc2Pos.y == 22) { this.npc2.move('right'); }
        }

      });

  }

  update(time, delta) {
    this.updateCharacters(time, delta);
    // this.flock.update(time, delta);
    this.npc1.update(time);
    this.npc2.update(time);

    let npcPos = this.npc1.getPosition();
    if (npcPos.x == 7 && npcPos.y == 21) {
      this.npc1.moveTo(4, 20);
    }

    npcPos = this.npc2.getPosition();
    if (npcPos.x == 31 && npcPos.y == 20) {
      this.npc2.moveTo(32, 22);
    }
  }

}
