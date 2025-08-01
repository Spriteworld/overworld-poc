import { GameMap, Flock, Direction, Items } from '@Objects';
import { TestMap } from '@Maps';
import { Vector2 } from '@Utilities';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Test',
      map: TestMap,
      active: false,
      visible: false,
    });

    this.npc1 = {};
    this.npc2 = {};
    this.hasFlock = Math.random() < 0.1;
    this.strengthb1 = {};
    this.item1 = {};
  }

  preload() {
    this.preloadMap();
  }

  create () {
    this.loadMap();
    // this.game.events.emit('toast', 'testing toast');
    this.npc1 = this.mapPlugins?.npc.addToScene('bob', 'police_man', Vector2(7, 21));
    this.npc2 = this.mapPlugins?.pokemon.addToScene('pika', 25, Vector2(31, 20));

    // make 10% chance to run this function
    if (this.hasFlock) {
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
    }

    this.item1 = new Items.Pokeball({
      scene: this,
      x: 35,
      y: 28,
      item: 'Rare Candy'
    });

    this.strengthb1 = new Items.StrengthBoulder({
      scene: this,
      x: 35,
      y: 30,
    });

    this.createCharacters();

    this.gridEngine
      .positionChangeFinished()
      .subscribe(({ charId, exitTile, enterTile }) => {
        if ([this.npc1.config.id].includes(charId)) {
          let npc1Pos = this.npc1.getPosition();
          if (npc1Pos.x == 10 && npc1Pos.y == 21) {
            this.npc1.moveTo(Vector2(4, 20), {
              noPathFoundStrategy: 'RETRY'
            });
          }
        }

        if ([this.npc2.config.id].includes(charId)) {
          let npc2Pos = this.npc2.getPosition();
          if (npc2Pos.x == 41 && npc2Pos.y == 22) {
            this.npc2.moveTo(Vector2(41, 20), {
              noPathFoundStrategy: 'RETRY'
            });
          }
          if (npc2Pos.x == 33 && npc2Pos.y == 20) { this.npc2.move(Direction.DOWN);}
          if (npc2Pos.x == 31 && npc2Pos.y == 24) { 
            this.npc2.moveTo(Vector2(32, 22), {
              noPathFoundStrategy: 'RETRY'
            });
          }
          if (npc2Pos.x == 36 && npc2Pos.y == 22) { this.npc2.move(Direction.DOWN); }
          if (npc2Pos.x == 36 && npc2Pos.y == 24) { this.npc2.move(Direction.RIGHT); }
          if (npc2Pos.x == 39 && npc2Pos.y == 24) { this.npc2.move(Direction.UP); }
          if (npc2Pos.x == 39 && npc2Pos.y == 22) { this.npc2.move(Direction.RIGHT); }
        }
      });
  }

  update(time, delta) {
    this.updateCharacters(time, delta);
    if (this.hasFlock) this.flock.update(time, delta);
    this.npc1.update(time);
    this.npc2.update(time);

    let npcPos = this.npc1.getPosition();
    if (npcPos.x == 7 && npcPos.y == 21) {
      this.npc1.moveTo(Vector2(4, 20));
    }

    npcPos = this.npc2.getPosition();
    if (npcPos.x == 31 && npcPos.y == 20) {
      this.npc2.moveTo(Vector2(32, 22));
    }
  }

}
