import {GameMap, Items, Tile} from '@Objects';
import {ForestMap} from '@Maps';

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
      1:  { x: 26, y: 45 },
      2:  { x: 26, y: 35 },
      3:  { x: 34, y: 35 },
      4:  { x: 48, y: 32 },
      5:  { x: 46, y: 44 },
      6:  { x: 37, y: 44 },
      7:  { x: 40, y: 49 },
      8:  { x: 27, y: 41 },
      9:  { x: 21, y: 48 },
      10: { x: 14, y: 40 },
    };
    this.cutTree = {};
  }

  preload() {
    this.preloadMap();
  }

  create () {
    this.loadMap();

    this.farfetchd = this.mapPlugins?.pokemon.addToScene('farfetchd', 83, 26, 45, {
    // this.farfetchd = this.mapPlugins?.pokemon.addToScene('farfetchd', 83, 34, 35, {
      text: 'FARFETCH\'D: kwaaaa!',
      spin: true,
      'spin-rate': 1000,
      'track-player': true,
      'track-player-radius': 1,
    });

    this.game.events.on('textbox-disable', () => {
      this.moveFarfetchd();
    });

    this.cutTree = new Items.CutTree({
      scene: this,
      x: 17,
      y: 36,
    });

    this.createCharacters();


  }

  update(time, delta) {
    this.updateCharacters(time, delta);
    this.farfetchd.update(time);
    this.cutTree.update(time);
  }

  moveFarfetchd() {
    let farfetchd = this.farfetchd;
    let currentLocation = farfetchd.getPosition();
    let playerLookingDirection = this.registry.get('player').getFacingDirection();

    // console.group('currentLocation');
    // Object.values(this.farfetchdLocations).forEach((loc, index) => {
    //   console.log(currentLocation, loc, index, JSON.stringify(currentLocation) === JSON.stringify(loc));
    // });
    // console.groupEnd('currentLocation');
    let sendFarfetchdTo = {};
    switch (true) {
      case (JSON.stringify(currentLocation) === JSON.stringify(this.farfetchdLocations[1])):
        // console.log('Farfetch\'d is at location 1');
        sendFarfetchdTo = this.farfetchdLocations[2];
      break;

      case (JSON.stringify(currentLocation) === JSON.stringify(this.farfetchdLocations[2])):
        // console.log('Farfetch\'d is at location 2');
        if (['left', 'up'].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[3];
        }
        if (['down'].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[8];
        }
      break;

      case (JSON.stringify(currentLocation) === JSON.stringify(this.farfetchdLocations[3])):
        // console.log('Farfetch\'d is at location 3');
        if (['left'].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[2];
        }
        if (['down'].includes(playerLookingDirection)) {
          farfetchd.moveTo(48, 35, { noPathFoundStrategy: 'RETRY' });
          sendFarfetchdTo = this.farfetchdLocations[4];
        }
      break;

      case (JSON.stringify(currentLocation) === JSON.stringify(this.farfetchdLocations[4])):
        // console.log('Farfetch\'d is at location 4');
        if (['right'].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[5];
        }
        if (['up'].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[3];
        }
      break;

      case (JSON.stringify(currentLocation) === JSON.stringify(this.farfetchdLocations[5])):
        // console.log('Farfetch\'d is at location 5');
        if (['left'].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[6];
        }
        if (['right', 'up'].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[4];
        }
        if (['down'].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[7];
        }
      break;

      case (JSON.stringify(currentLocation) === JSON.stringify(this.farfetchdLocations[6])):
        // console.log('Farfetch\'d is at location 6');
        if (['down'].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[7];
        }
        if (['up', 'left'].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[8];
        }
      break;

      case (JSON.stringify(currentLocation) === JSON.stringify(this.farfetchdLocations[7])):
        // console.log('Farfetch\'d is at location 7');
        if (['left'].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[6];
        }
        if (['right'].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[5];
        }
      break;

      case (JSON.stringify(currentLocation) === JSON.stringify(this.farfetchdLocations[8])):
        // console.log('Farfetch\'d is at location 8');
        if (['left'].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[2];
        }
        if (['right'].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[6];
        }
        if (['down'].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[9];
        }
        if (['up'].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[2];
        }
      break;

      case (JSON.stringify(currentLocation) === JSON.stringify(this.farfetchdLocations[9])):
        // console.log('Farfetch\'d is at location 9');
        if (['left'].includes(playerLookingDirection)) {
          sendFarfetchdTo = this.farfetchdLocations[10];
        }
        if (['right'].includes(playerLookingDirection)) {
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

    farfetchd.moveTo(sendFarfetchdTo.x, sendFarfetchdTo.y, { noPathFoundStrategy: 'RETRY' });
  }
}
