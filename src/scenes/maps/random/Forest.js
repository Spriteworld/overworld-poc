import { GameMap, Items, Direction } from '@Objects';
import { ForestMap } from '@Maps';
import { Vector2 } from '@Utilities';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'Forest',
      map: ForestMap,
      active: false,
      visible: false,
    });

    this.farfetchd = {};
    this.farfetchdLocations = {
      1:  Vector2(26, 45),
      2:  Vector2(26, 35),
      3:  Vector2(34, 35),
      4:  Vector2(48, 32),
      5:  Vector2(46, 44),
      6:  Vector2(37, 44),
      7:  Vector2(40, 49),
      8:  Vector2(27, 41),
      9:  Vector2(21, 48),
      10: Vector2(14, 40),
    };
    this.cutTree = {};
    this.cutTree2 = {};
  }

  preload() {
    this.preloadMap();
  }

  create () {
    this.loadMap();

    this.farfetchd = this.mapPlugins?.pokemon.addToScene(
      'farfetchd', 
      83, 
      Vector2(26, 45), 
      {
        text: 'FARFETCH\'D: kwaaaa!',
        spin: true,
        'spin-rate': 1000,
        'track-player': true,
        'track-player-radius': 1,
      }
    );

    this.game.events.on('textbox-disable', () => {
      if (this.registry.get('last-spoke-to') === this.farfetchd.config.id) {
        this.moveFarfetchd();
      }
    });

    this.cutTree = new Items.CutTree({
      scene: this,
      coords: Vector2(17, 36),
    });

    this.cutTree2 = new Items.CutTree({
      scene: this,
      coords: Vector2(17, 37),
    });

    this.createCharacters();

    this.gridEngine
      .movementStopped()
      .subscribe(({ charId }) => {
        if ([this.farfetchd.config.id].includes(charId)) {
          let player = this.registry.get('player');
          player.enableMovement();
        } 
      });

    this.gridEngine
      .movementStarted()
      .subscribe(({ charId }) => {
        if ([this.farfetchd.config.id].includes(charId)) {
          let player = this.registry.get('player');
          player.disableMovement();
        } 
      });
  }

  update(time, delta) {
    this.updateCharacters(time, delta);
    this.farfetchd.update(time, delta);
  }

  moveFarfetchd() {
    let farfetchd = this.farfetchd;
    let currentLocation = farfetchd.getPosition();
    let playerLookingDirection = this.registry.get('player').getFacingDirection();

    let sendFarfetchdTo = {};
    switch (true) {
      case this.#checkFarfetchdLocation(currentLocation, 1):
        sendFarfetchdTo = this.farfetchdLocations[2];
      break;

      case this.#checkFarfetchdLocation(currentLocation, 2):
        if ([Direction.LEFT, Direction.UP].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[3];
        }
        if ([Direction.DOWN].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[8];
        }
      break;

      case this.#checkFarfetchdLocation(currentLocation, 3):
        if ([Direction.LEFT].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[2];
        }
        if ([Direction.DOWN].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[4];
        }
      break;

      case this.#checkFarfetchdLocation(currentLocation, 4):
        if ([Direction.RIGHT].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[5];
        }
        if ([Direction.UP].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[3];
        }
      break;

      case this.#checkFarfetchdLocation(currentLocation, 5):
        if ([Direction.LEFT].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[6];
        }
        if ([Direction.RIGHT, Direction.UP].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[4];
        }
        if ([Direction.DOWN].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[7];
        }
      break;

      case this.#checkFarfetchdLocation(currentLocation, 6):
        if ([Direction.DOWN].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[7];
        }
        if ([Direction.UP, Direction.LEFT].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[8];
        }
      break;

      case this.#checkFarfetchdLocation(currentLocation, 7):
        if ([Direction.LEFT].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[6];
        }
        if ([Direction.RIGHT].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[5];
        }
      break;

      case this.#checkFarfetchdLocation(currentLocation, 8):
        if ([Direction.LEFT].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[2];
        }
        if ([Direction.RIGHT].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[6];
        }
        if ([Direction.DOWN].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[9];
        }
        if ([Direction.UP].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[2];
        }
      break;

      case this.#checkFarfetchdLocation(currentLocation, 9):
        if ([Direction.LEFT].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[10];
        }
        if ([Direction.RIGHT].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[8];
        }
      break;
    }

    if (Object.keys(sendFarfetchdTo).length === 0) {
      console.warn('No valid location found for Farfetch\'d to move to.');
      return;
    }
    this.removeInteraction(this.farfetchd.config.id);
    this.interactTile(undefined, {
      ...this.farfetchd.config,
      x: sendFarfetchdTo.x,
      y: sendFarfetchdTo.y,
    }, undefined);

    farfetchd.moveTo(sendFarfetchdTo, { noPathFoundStrategy: 'RETRY' });
  }

  #checkFarfetchdLocation(currentLocation, locationIdx) {
    return JSON.stringify(currentLocation) === JSON.stringify(this.farfetchdLocations[locationIdx]);
  }
}
