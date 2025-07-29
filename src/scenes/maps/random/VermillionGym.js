import { GameMap, Tile, Direction } from '@Objects';
import { VermillionGymMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'VermillionGym',
      map: VermillionGymMap,
      active: false,
      visible: false,
    });

    this.rect = null;
    this.switches = {
      1: { x: 1, y: 9 },
      2: { x: 3, y: 9 },
      3: { x: 5, y: 9 },
      4: { x: 7, y: 9 },
      5: { x: 9, y: 9 },
      6: { x: 1, y: 11 },
      7: { x: 3, y: 11 },
      8: { x: 5, y: 11 },
      9: { x: 7, y: 11 },
      10: { x: 9, y: 11 },
      11: { x: 1, y: 13 },
      12: { x: 3, y: 13 },
      13: { x: 5, y: 13 },
      14: { x: 7, y: 13 },
      15: { x: 9, y: 13 },
    };
    this.switch1 = false;
    this.switch1Rect = null;
    this.switch2 = false;
    this.switch2Rect = null;
    this.stopBinEvent = false;
  }

  preload() {
    this.preloadMap();
  }

  create () {
    this.loadMap();
    this.createCharacters();

    // the door lock
    this.rect = this.add
        .rectangle(4 * Tile.WIDTH, 5 * Tile.HEIGHT, Tile.WIDTH * 3, Tile.HEIGHT)
        .setFillStyle(0xB81D15, 1)
        .setAlpha(0.5)
        .setOrigin(0)
        .setDepth(100);

    // the switches
    this.switch1Rect = this.add
      .rectangle(0, 0, Tile.WIDTH, Tile.HEIGHT)
      .setFillStyle(0xED1C24, 1)
      .setOrigin(0,0)
      .setDepth(9999999)
      .setName('switch1')
      .setAlpha(0)
    ;
    this.switch2Rect = this.add
      .rectangle(0, 0, Tile.WIDTH, Tile.HEIGHT)
      .setFillStyle(0x3282F6, 1)
      .setOrigin(0,0)
      .setDepth(9999999)
      .setName('switch2')
      .setAlpha(0)
    ;

    // the bins
    Object.entries(this.switches).forEach(([idx, binSwitch]) => {
      this.interactTile(undefined, {
        id: `binSwitch-${idx}`,
        type: 'bin-switch',
        x: binSwitch.x,
        y: binSwitch.y,
      }, undefined);
    });
    this.rngSwitch1();

    this.game.events.on('interact-with-obj', (tile) => {
      if (tile.obj.type !== 'bin-switch') {
        return;
      }

      this.handleInteractWithBinSwitch(tile);
    });
  }

  update(time, delta) {
    this.updateCharacters(time, delta);

    let player = this.mapPlugins['player'].player;
    let isInside = [ [4,5], [5,5], [6,5] ].some((point) => parseInt(player.x / Tile.WIDTH) === point[0] && parseInt(player.y / Tile.HEIGHT) === point[1]);
    if (isInside && this.stopBinEvent === false) {
      this.game.events.emit(
        'textbox-changedata', 
        'Theres a door here, but it is locked.', 
      );
      player.move('down');
    }

  }

  handleInteractWithBinSwitch(tile) {
    let switchId = tile.obj.id.split('-')[1];
    if (this.stopBinEvent) {
      return;
    }

    if ([this.switch1, this.switch2].includes(switchId)) {
      if (this.switch1 === switchId && this.switch2 === false) {
        this.rngSwitch2();
        this.game.events.emit(
          'textbox-changedata', 
          'You found the first switch. Theres a second switch somewhere...',
        );
        return;
      }
      
      if (this.switch1 !== switchId && this.switch2 === false) {
        this.resetSwitches();
        this.game.events.emit(
          'textbox-changedata', 
          'Nothing here! Try another bin.',
        );
        return;
      }
      
      if (this.switch2 !== false && this.switch2 === switchId) {
        this.rect.setAlpha(0);
        this.rect.setPosition(
          0 * Tile.WIDTH, 
          5 * Tile.HEIGHTz
        );
        this.game.events.emit(
          'textbox-changedata', 
          'You found the second switch. The door is now unlocked!',
        );
        this.switch1Rect.setAlpha(0);
        this.switch2Rect.setAlpha(0);
        this.stopBinEvent = true;
        return;
      }
    } else {
      if (this.switch2 !== false) {
        this.resetSwitches();
        this.game.events.emit(
          'textbox-changedata', 
          'Nothing here! Oh no, the switch reset.',
        );
      } else {
        this.game.events.emit(
          'textbox-changedata', 
          'Nothing here! Try another bin.',
        );        
      }
    }
  }

  resetSwitches() { 
    this.switch1 = false;
    this.switch2 = false;
    this.switch1Rect.setAlpha(0);
    this.switch2Rect.setAlpha(0);
    this.rngSwitch1();
  }

  rngSwitch1() {
    this.switch1 = false;
    let keys = Object.keys(this.switches);
    let randomKey = keys[Math.floor(Math.random() * keys.length)];

    this.switch1 = randomKey;
    this.switch1Rect.setPosition(
      this.switches[randomKey].x * Tile.WIDTH,
      this.switches[randomKey].y * Tile.HEIGHT
    );
    this.switch1Rect.setAlpha(0.5);
  }

  rngSwitch2() {
    this.switch2 = false;

    let directions = [Direction.UP, 'down', 'left', 'right'];

    let binIdx = -1;
    let bin = null;
    do {
      let direction = directions[Math.floor(Math.random() * directions.length)];
      bin = {...this.switches[this.switch1]};

      switch (direction) {
        case Direction.UP:
          bin.y -= 2;
          break;
        case 'down':
          bin.y += 2;
          break;
        case 'left':
          bin.x -= 2;
          break;
        case 'right':
          bin.x += 2;
          break;
      }

      binIdx = Object.values(this.switches).findIndex((value) => {
        return value.x === bin.x && value.y === bin.y;
      });
      if (binIdx !== -1) {
        binIdx += 1; // because the keys are 1-indexed
      }
    } while(binIdx === -1);

    this.switch2 = binIdx.toString();
    // this.switch2Rect.setPosition(
    //   bin.x * Tile.WIDTH,
    //   bin.y * Tile.HEIGHT
    // );
    // this.switch2Rect.setAlpha(0.5);
  }
}
