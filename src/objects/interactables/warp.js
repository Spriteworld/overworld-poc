import Phaser from 'phaser';
import { Tile, Interactables, GameMap, Direction } from '@Objects';
import { getPropertyValue } from '@Utilities';

export default class {
  constructor(scene) {
    /** @type {GameMap} */
    this.scene = scene;
    this.warps = [];
    this.player = {};
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::warp', this.scene.game.config.mapName);
    }

    let warps = this.scene.findInteractions('warp');
    if (warps.length === 0) { return; }

    // empty the warps, and reset them to the current maps warps
    this.scene.registry.set('warps', []);
    warps.forEach((obj) => {
      let width = parseInt(obj.width / Tile.WIDTH);
      let height = parseInt(obj.height / Tile.HEIGHT);

      if (width === 1 && height === 1) {
        this.addWarp(obj);
        return;
      }

      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          let objCopy = JSON.parse(JSON.stringify(obj));
          
          let targetXIdx = objCopy.properties.findIndex(w => w.name === 'warp-x');
          objCopy.properties[targetXIdx].value = obj.properties[targetXIdx].value + x;
          objCopy.x = (objCopy.x / Tile.WIDTH) + x;
            
          let targetYIdx = objCopy.properties.findIndex(w => w.name === 'warp-y');
          objCopy.properties[targetYIdx].value = obj.properties[targetYIdx].value + y;
          objCopy.y = (objCopy.y / Tile.HEIGHT) + y;

          this.addWarp(objCopy);
        }
      }
    });
    this.warps = this.scene.registry.get('warps');
  }

  addWarp(obj) {
    let warpxIdx = obj.properties.findIndex(w => w.name === 'warp-x');
    let warpyIdx = obj.properties.findIndex(w => w.name === 'warp-y');
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::warp::addWarp', parseInt(obj.x), parseInt(obj.y), obj.properties[warpxIdx].value, obj.properties[warpyIdx].value]);
    }
    this.scene.registry.get('warps').push({
      name: obj.id,
      x: parseInt(obj.x),
      y: parseInt(obj.y),
      obj: obj
    });
    if (this.scene.game.config.debug.console.interactableShout) {
      let rect = this.scene.add.rectangle(
        obj.x * Tile.WIDTH, obj.y * Tile.HEIGHT,
        Tile.WIDTH, Tile.HEIGHT,
        0x000000, 0.5
      ).setOrigin(0,0);

      /** @type {Interactables.Debug} */
      this.scene.mapPlugins['debug'].debugObject(rect, [
        obj.properties[warpxIdx].value,
        obj.properties[warpyIdx].value,
      ].join(','));
    }
  }

  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::warp::event', this.scene])
    }

    // handle warp tiles
    this.scene.gridEngine
      .positionChangeStarted()
      .subscribe(({ charId, exitTile, enterTile }) => {
        let char = this.scene.characters.get(charId);
        if (typeof char === 'undefined') { return; }
        if (char.config['ignore-warp'] === true) { return; }

        this.handleWarps(char, exitTile, enterTile);
      });
  }

  handleWarps(char, exitTile, enterTile) {
    if (this.warps.length === 0) { return; }

    let warp = this.warps.find(p => p.x / Tile.WIDTH === enterTile.x && p.y / Tile.HEIGHT === enterTile.y);
    if (typeof warp === 'undefined') { return; }

    let warpProps = warp.obj.properties;
    let warpLocation = getPropertyValue(warpProps, 'warp', null);
    if (warpLocation === null || warpLocation === ''){ return; }
    let playerLocation = {
      x: getPropertyValue(warpProps, 'warp-x', 0),
      y: getPropertyValue(warpProps, 'warp-y', 0),
      dir: getPropertyValue(warpProps, 'warp-dir', 'down'),
      charLayer: getPropertyValue(warpProps, 'layer', 'ground')
    };

    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::warp::handleWarps', 'char is trying to warp', char.name, 'to', warpLocation]);
    }
    if (char.config.type !== 'player') {
      if (this.scene.registry.get('map') === warpLocation) {
        this.warpPlayerInMap(char, playerLocation);
      }
      char.visible = false;
      return;
    }

    this.warpPlayerToMap(char, warpLocation, playerLocation);
  }

  warpPlayerInMap(char, playerLocation) {
    let pos = {
      x: playerLocation.x,
      y: playerLocation.y
    };

    // move the player
    this.scene.gridEngine.setPosition(char.name, pos, playerLocation.layer);
    char.look(playerLocation.dir);

    if (this.scene.mapPlugins['player'].hasPlayerMon) {
      // get the pokemon to be in the right spot
      this.scene.gridEngine.setPosition(
        this.playerMon.config.id,
        char.getPosInBehindDirection(),
        playerLocation.layer
      );
    }
  }

  warpPlayerToMap(char, warpLocation, playerLocation) {
    char.disableMovement();
    this.scene.cameras.main.fadeOut(this.cameraFade, 0, 0, 0);
    this.scene.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      (cam, effect) => {
        // this.scene.scene.events.emit('toast', warpLocation);
        // same map, we dont need to move scene
        if (this.scene.registry.get('map') === warpLocation && playerLocation) {
          this.warpPlayerInMap(char, playerLocation);
          this.scene.cameras.main.fadeIn(this.cameraFade, 0, 0, 0);
          char.enableMovement();
          return;
        }

        // new map!
        this.scene.registry.set('map', warpLocation);
        if (typeof playerLocation === 'undefined') {
          this.scene.scene.start(warpLocation);
        }else {
          this.scene.scene.start(warpLocation, {
            playerLocation: playerLocation
          });
        }
        char.enableMovement();
      }
    );
  }

  warpPlayerToMapWithoutFade(char, warpLocation, playerLocation) {
    this.scene.registry.set('map', warpLocation);
    if (typeof playerLocation === 'undefined') {
      this.scene.scene.start(warpLocation);
    }else {
      this.scene.scene.start(warpLocation, {
        playerLocation: playerLocation
      });
    }
  }
}