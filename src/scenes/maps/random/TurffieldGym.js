import Phaser from 'phaser';
import { GameMap, Tile, Items, Direction } from '@Objects';
import { TurffieldGymMap } from '@Maps';
import { generateTileCoords, Vector2 } from '@Utilities';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'TurffieldGym',
      map: TurffieldGymMap,
      active: false,
      visible: false,
    });

    this.pokemon = [];

    this.barrier = {
      area1: {
        flag: true,
        gate: [ Vector2(9, 29), 4, 1],
        spawnArea: [ Vector2(14, 31), Vector2(38, 37) ],
        objs: [],
      },
      area2: {
        flag: true,
        gate: [ Vector2(35, 20), 4, 1],
        spawnArea: [ Vector2(9, 22), Vector2(33, 28) ],
        objs: [],
      },
      area3: {
        flag: true,
        gate: [ Vector2(22, 11), 4, 1],
        spawnArea: [ Vector2(9, 14), Vector2(33, 19) ],
        objs: [],
      },
    };
  }

  init() {
    this.pokemon = [];
    this.barrier.area1.flag = true;
    this.barrier.area2.flag = true;
    this.barrier.area3.flag = true;
    this.barrier.area1.objs = [];
    this.barrier.area2.objs = [];
    this.barrier.area3.objs = [];
  }

  preload() {
    this.preloadMap();
  }

  create () {
    this.loadMap();
    this.spawnBarrier('area1');
    this.spawnBarrier('area2');
    this.spawnBarrier('area3');
    
    Object.keys(this.barrier).forEach((key) => {
      for (let i = 0; i < 2; i++) {
        // pick a random x and y within the bounds of area1
        let x = Phaser.Math.Between(this.barrier[key].spawnArea[0].x, this.barrier[key].spawnArea[1].x);
        let y = Phaser.Math.Between(this.barrier[key].spawnArea[0].y, this.barrier[key].spawnArea[1].y);
        // console.log('Spawning pokemon at:', key, i+1, x, y);

        this.pokemon.push(
          this.mapPlugins?.pokemon.addToScene(
            ['mareep', key, i+1].join('-'), 
            Math.random() > 0.1 ? 179 : 180, 
            x, 
            y, 
            {
              spin: true,
              'avoid-character': 'player',
              'track-player-radius': 2,
              'event-can-see-character': this.moveCharacterAway.bind(this)
            }
          )
        );
      }
    });

    this.createCharacters();
  }

  update(time, delta) { 
    this.updateCharacters(time, delta);
    this.pokemon.forEach((pokemon) => {
      if (typeof pokemon === 'undefined' || pokemon === null) {
        pokemon.remove();
        return;
      }
      pokemon.update(time, delta);
    });

    if (this.barrier.area1.flag) {
      let canUnlockArea1 = this.checkAreaForPokemon([ Vector2(9, 30), Vector2(12, 31) ], 2);
      if (canUnlockArea1) {
        this.removeBarrier('area1');
      }      
    }

    if (this.barrier.area2.flag) {
      let canUnlockArea2 = this.checkAreaForPokemon([ Vector2(35, 21), Vector2(38, 22) ], 4);
      if (canUnlockArea2) {
        this.removeBarrier('area2');
      }      
    }

    if (this.barrier.area3.flag) {
      let canUnlockArea3 = this.checkAreaForPokemon([ Vector2(22, 12), Vector2(25, 13) ], 6);
      if (canUnlockArea3) {
        this.removeBarrier('area3');
      }      
    }

  }

  getActiveBarrier() {
    if (this.barrier.area1.flag === true) {
      return 'area1';
    } else if (this.barrier.area2.flag === true) {
      return 'area2';
    } else if (this.barrier.area3.flag === true) {
      return 'area3';
    }

    return null;
  }

  removeBarrier(activeBarrier) {
    if (typeof activeBarrier === 'undefined' || activeBarrier === null) {
      console.warn('No active barrier specified for removal');
      return;
    }
    if (!(activeBarrier in this.barrier)) {
      console.warn('No barrier configuration found for:', activeBarrier);
      return;
    }
      
    this.barrier[activeBarrier].flag = false;
    
    // wipe out any existing barriers
    this.barrier[activeBarrier].objs.forEach((obj) => {
      obj.destroy();
      
      let char = this.characters.get(obj.name);
      if (typeof char === 'undefined') { return; }
      char.remove();
    });

    this.barrier[activeBarrier].objs = [];
  }

  spawnBarrier(activeBarrier) {
    if (activeBarrier === null) {
      console.log('No active barrier to spawn');
      activeBarrier = this.getActiveBarrier();
    }
    // console.log('Spawning barrier:', activeBarrier);
    if (typeof this.barrier[activeBarrier] === 'undefined') {
      console.warn('No barrier configuration found for:', activeBarrier);
      return;
    }

    this.barrier[activeBarrier].objs = [];
    
    // spawn new barriers
    // console.log('Spawning barrier at:', this.barrier[activeBarrier].gate);
    let barrierCoords = generateTileCoords(...this.barrier[activeBarrier].gate);
    barrierCoords.forEach((coord) => {
      this.barrier[activeBarrier].objs.push(
        this.add
          .rectangle(coord.x * Tile.WIDTH, coord.y * Tile.HEIGHT, Tile.WIDTH, Tile.HEIGHT)
          .setFillStyle(0xB81D15, 1)
          .setAlpha(0.5)
          .setOrigin(0)
          .setDepth(100)
      );
      this.barrier[activeBarrier].objs.push(
        new Items.Bush({
          scene: this,
          x: coord.x,
          y: coord.y,
        })
      );
    });
  }

  moveCharacterAway(character, direction) {
    // console.log('Character::moveCharacterAway', character, direction);
    let player = this.characters.get('player');
    let char = this.characters.get(character);
    if (char === null) {
      console.warn('Character not found:', character);
      return;
    }

    let directions = [Direction.UP, 'down', Direction.LEFT, Direction.RIGHT];
    let approachDir = player.getOppositeFacingDirection();
    // console.log('Character is approaching from:', approachDir, char.config.id);
    directions = directions.filter(dir => dir !== approachDir);
    // if ([Direction.UP, 'down'].includes(approachDir)) {
    //   // check if the character is more to the left or right
    //   let checkXSide = char.x > player.x ? Direction.LEFT : Direction.RIGHT;
    //   console.log('Character is more to the:', checkXSide);
    //   directions = directions.filter(dir => dir !== checkXSide);

    // } else {
    //   // check if the character is more above or below
    //   let checkYSide = char.y > player.y ? Direction.UP : 'down';
    //   console.log('Character is more to the:', checkYSide);
    //   directions = directions.filter(dir => dir !== checkYSide);
    // }
    // console.log('Filtered directions:', directions);

    // // if no directions left, start the list again, and just check for collisions
    // if (directions.length === 0) {
    //   console.log('No valid directions left, checking all directions');
    //   directions = [Direction.UP, 'down', Direction.LEFT, Direction.RIGHT];
    // }

    // // remove directions that the character cannot move in
    // directions.forEach((dir) => {
    //   if (!char.canMove(dir)) {
    //     console.log('Character cannot move in direction:', dir);
    //     directions = directions.filter(d => d !== dir);
    //   } 
    // });

    // console.log('Final directions:', directions);

    let randomDirection = Phaser.Math.RND.pick(directions);
    // console.log('Moving character away in direction:', randomDirection, char.config.id);
    if (typeof randomDirection === 'undefined' || randomDirection === null) {
      console.warn('No valid direction to move character away');
      return;
    }

    char.move(randomDirection);
  }

  checkAreaForPokemon(area, howManyPokemon=1) {
    if (typeof area === 'undefined' || area === null) {
      console.warn('No area specified for checking Pokemon');
      return;
    }
    if (typeof howManyPokemon !== 'number' || howManyPokemon <= 0) {
      console.warn('Invalid number of Pokemon specified:', howManyPokemon);
      return;
    }

    // for each tile in area, check if a character is present
    let coords = generateTileCoords(area[0], 4, 2);

    let charactersInArea = [];
    this.characters.forEach((character, key) => {
      if (typeof character.config === 'undefined' || character.config.type !== 'pkmn') {
        return;
      }

      let charXY = character.getPosition();
      if (coords.some(coord => coord.x === charXY.x && coord.y === charXY.y)) {
        charactersInArea.push(character);
      }
    });

    return charactersInArea.length >= howManyPokemon;
  }
}
