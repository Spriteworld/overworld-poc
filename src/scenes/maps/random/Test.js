import {GameMap, Flock, Direction, Tile} from '@Objects';
import {TestMap} from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Test',
      map: TestMap,
      active: false,
      visible: false,
    });

    this.pokemon = [3, 6, 9, 22, 25, 197, '197s'];
  }

  preload() {
    this.preloadMap();
  }

  create () {
    this.loadMap();
    this.npc1 = this.addNPCToScene('bob', 'police_man', 7, 21);

    this.flock = new Flock(
      this,
      'fearow',
      '022',
      1,
      14,
      Direction.RIGHT,
      [
        [1,0,0],
        [0,1,0],
        [0,0,1],
        [0,1,0],
        [1,0,0],
      ]
    );

    this.createCharacters();

    this.gridEngine
      .positionChangeFinished()
      .subscribe(({ charId, exitTile, enterTile }) => {
        if (![this.npc1.config.id].includes(charId)) {
          return;
        }

        let npcPos = this.npc1.getPosition();
        if (npcPos.x == 10 && npcPos.y == 21) {
          this.npc1.moveTo(4, 20, {
            noPathFoundStrategy: 'RETRY'
          });
        }
      });

  }

  update(time, delta) {
    this.updateCharacters(time, delta);
    this.flock.update(time, delta);
    this.npc1.update(time);

    let npcPos = this.npc1.getPosition();
    if (npcPos.x == 7 && npcPos.y == 21) {
      this.npc1.moveTo(4, 20);
    }
  }

}
