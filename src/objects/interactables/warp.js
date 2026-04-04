import Phaser from 'phaser';
import { Tile, Interactables, GameMap, Direction } from '@Objects';
import { getPropertyValue } from '@Utilities';

export default class {
  /**
   * @param {GameMap} scene - The map scene that owns this plugin.
   */
  constructor(scene) {
    /** @type {GameMap} */
    this.scene = scene;
    this.warps = [];
    this.player = {};
  }

  /**
   * Discover all warp objects on the map and expand multi-tile warps into
   * individual single-tile warp entries in the scene registry.
   */
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
          objCopy.x = objCopy.x + (x * Tile.WIDTH);

          let targetYIdx = objCopy.properties.findIndex(w => w.name === 'warp-y');
          objCopy.properties[targetYIdx].value = obj.properties[targetYIdx].value + y;
          objCopy.y = objCopy.y + (y * Tile.HEIGHT);

          this.addWarp(objCopy);
        }
      }
    });
    this.warps = this.scene.registry.get('warps');
  }

  /**
   * Register a single tile-sized warp object into the scene's warp registry.
   * @param {object} obj - A Tiled object with warp-x and warp-y properties.
   */
  addWarp(obj) {
    let warpxIdx = obj.properties.findIndex(w => w.name === 'warp-x');
    let warpyIdx = obj.properties.findIndex(w => w.name === 'warp-y');
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::warp::addWarp', parseInt(obj.x), parseInt(obj.y), obj.properties[warpxIdx].value, obj.properties[warpyIdx].value]);
    }
    this.scene.registry.get('warps').push({
      name: obj.id,
      x: parseInt(obj.x / Tile.WIDTH),
      y: parseInt(obj.y / Tile.HEIGHT),
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

  /**
   * Subscribe to GridEngine position-change events and route characters
   * through any warp tile they step on.
   */
  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::warp::event', this.scene])
    }

    // handle warp tiles
    this._sub = this.scene.gridEngine
      .positionChangeStarted()
      .subscribe(({ charId, exitTile, enterTile }) => {
        let char = this.scene.characters.get(charId);
        if (typeof char === 'undefined') { return; }
        if (char.config['ignore-warp'] === true) { return; }

        this.handleWarps(char, exitTile, enterTile);
      });
  }

  /** Unsubscribe from GridEngine events to prevent memory leaks. */
  destroy() {
    this._sub?.unsubscribe();
  }

  /**
   * Check whether a character has stepped onto a warp tile and, if so,
   * initiate the appropriate warp action.
   * @param {Character} char - The character that moved.
   * @param {{x:number,y:number}} exitTile - The tile the character left.
   * @param {{x:number,y:number}} enterTile - The tile the character entered.
   */
  handleWarps(char, exitTile, enterTile) {
    if (this.warps.length === 0) { return; }

    let warp = this.warps.find(p => p.x === enterTile.x && p.y === enterTile.y);
    if (typeof warp === 'undefined') { return; }

    let warpProps = warp.obj.properties;
    let warpLocation = getPropertyValue(warpProps, 'warp', null);
    if (warpLocation === null || warpLocation === ''){ return; }
    let playerLocation = {
      x: getPropertyValue(warpProps, 'warp-x', 0),
      y: getPropertyValue(warpProps, 'warp-y', 0),
      dir: getPropertyValue(warpProps, 'warp-dir', Direction.DOWN),
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

  /**
   * Teleport a character to a new position within the current map.
   * @param {Character} char - The character to teleport.
   * @param {{x:number,y:number,dir:string,layer:string}} playerLocation - Target tile and direction.
   */
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

  /**
   * Fade out the camera then switch to a different map scene, placing the
   * character at the given location on arrival.
   * @param {Character} char - The character to warp.
   * @param {string} warpLocation - Scene key of the destination map.
   * @param {{x:number,y:number,dir:string,layer:string}} playerLocation - Spawn position on the new map.
   */
  warpPlayerToMap(char, warpLocation, playerLocation) {
    // Same map — just teleport in place
    if (this.scene.config.mapName === warpLocation && playerLocation) {
      char.disableMovement();
      this.scene.cameras.main.fadeOut(500, 0, 0, 0);
      this.scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.warpPlayerInMap(char, playerLocation);
        this.scene.cameras.main.fadeIn(500, 0, 0, 0);
        char.enableMovement();
      });
      return;
    }

    // Normal fade transition to a cold-start scene
    char.disableMovement();
    this.scene.cameras.main.fadeOut(500, 0, 0, 0);
    this.scene.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => {
        this.scene.registry.set('map', warpLocation);
        if (typeof playerLocation === 'undefined') {
          this.scene.scene.start(warpLocation);
        } else {
          this.scene.scene.start(warpLocation, { playerLocation });
        }
      }
    );
  }

  /**
   * Immediately switch to a different map scene without a camera fade.
   * @param {Character} char - The character to warp.
   * @param {string} warpLocation - Scene key of the destination map.
   * @param {{x:number,y:number,dir:string,layer:string}} [playerLocation] - Spawn position on the new map.
   */
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