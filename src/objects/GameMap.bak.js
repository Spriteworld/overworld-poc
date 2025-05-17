import Phaser from 'phaser';
import { Player, NPC, PkmnOverworld, ObjectTypes, Tile, Interactables } from '@Objects';
import { random_rgba, getPropertyValue, getValue, remapProps } from '@Utilities';
import Debug from '@Data/debug.js';

export default class extends Phaser.Scene {
  constructor(config) {
    super({ key: config.mapName });
    this.config = config || {};
    this.config.x = config.x || 0;
    this.config.y = config.y || 0;
    this.config.map = config.map || {};
    this.config.mapName = config.mapName || '';
    this.config.inside = false;
    this.config.tilemap = {};
    this.config.playerLocation = {};

    this.loadedPlayer = false;
    this.cameraFade = 150;
    this.totalMon = 151;
    this.tilemaps = {};
    this.npcs = [];
    this.pkmn = [];
    this.player = {};
    this.playerMon = {};

    this.ge_init = false;
    this.ge_events_init = false;
  }

  init(data) {
    this.config = { ...this.config, ...data };
    this.player = {};
    this.playerMon = {};
    this.characters = [];
    this.mon = [];
    this.pkmn = [];
    this.warps = [];
    this.ge_init = false;
    this.ge_events_init = false;
  }

  preloadMap() {
    this.load.tilemapTiledJSONExternal(this.config.mapName, this.config.map);
  }

  loadMap() {
    if (this.game.config.debug.functions.gameMap) {
      console.log('GameMap::loadMap: '+ this.config.mapName);
    }
    var tilemap = this.make.tilemap({ key: this.config.mapName });
    this.config.tilemap = tilemap;
    this.registry.set('scene', this.config.mapName);

    // all the tilesets!
    let tilesets = [
      tilemap.addTilesetImage('gen3_inside'),
      tilemap.addTilesetImage('gen3_outside'),
      tilemap.addTilesetImage('rse_inside'),
      tilemap.addTilesetImage('rse_outside'),
    ];

    // load all the layers!
    let layers = tilemap.layers
      .forEach((layer) => {
        // console.log('[GameMap]', layer);

        this.tilemaps[layer.name] = tilemap
          .createLayer(layer.name, tilesets)
          .setName(layer.name)
          .setAlpha(layer.visible ? 1 : 0)
        ;
      });

    // map features
    this.iceTiles = this.getTilesWithProperty('sw_slide');
    this.spinTiles = this.getTilesWithProperty('sw_spin');
    this.stopTiles = this.getTilesWithProperty('sw_stop');
    this.jumpTiles = this.getTilesWithProperty('sw_jump');
    this.npcs = this.add.group();
    this.npcs.setName('npcs');
    this.pkmn = this.add.group();
    this.pkmn.setName('pkmn');

    // load ALL THE THINGSSSSS
    this.objects = tilemap.getObjectLayer('interactions');
    if (this.objects !== null) {
      if (this.game.config.debug.functions.gameMap) {
        console.log('GameMap::loadMap->objects');
      }
      this.registry.set('interactions', []);
      this.registry.set('warps', []);

      this.initSigns();
      this.initNpcs();
      this.initPkmn();
      this.initWarps();
      this.initJumps();
      this.initLights();
      this.initPlayer();

      new Interactables.Debug(this).init();
    }

    this.animatedTiles.init(tilemap);
  }

 

  initJumps() {
    if (this.game.config.debug.functions.gameMap) {
      console.log('GameMap::initJumps');
    }
    if (this.jumpTiles.length === 0) { return; }

    this.jumpTiles.forEach(tile => this.tintTile(this.config.tilemap, tile[0], tile[1], 0x00afe4));

  }

  initLights() {
    if (this.game.config.debug.functions.gameMap) {
      console.log('GameMap::initLights');
    }
    let lights = this.findInteractions('light');
    if (lights.length === 0) { return; }

    lights.forEach(obj => {
      let props = remapProps(obj.properties)
      this.add
        .pointlight(
          obj.x + (Tile.WIDTH / 2),
          obj.y + (Tile.HEIGHT / 4),
          '0x'+getPropertyValue(obj.properties, 'color', '#ffffff').substr(1),
          getPropertyValue(obj.properties, 'radius', 100),
          getPropertyValue(obj.properties, 'intensity', 0.2),
          getPropertyValue(obj.properties, 'attenuation', 0.06)
        )
        .setDepth(9999)
        .setName(obj.name)
      ;
    });
  }

  initGEEvents() {
    // handle ice & spin tiles
    this.gridEngine
      .positionChangeStarted()
      .subscribe(({ charId, exitTile, enterTile }) => {
        let char = this.characters.find(char => {
          return charId === char.config.id;
        });
        if (typeof char === 'undefined') { return; }

        // check for ice tiles
        this.handleIceTiles(char, exitTile, enterTile);

        // check for spin tiles
        this.handleSpinTiles(char, exitTile, enterTile);

        // check for spin tiles
        this.handleJumps(char, exitTile, enterTile);

        // check for warp tiles
        if (![this.player.config.id].includes(charId)) { return; }
        this.handleWarps(char, exitTile, enterTile);
      });

    this.gridEngine
      .movementStopped()
      .subscribe(({ charId, direction }) => {
        let char = this.characters.find(char => {
          return charId === char.config.id;
        });
        if (typeof char === 'undefined') { return; }

        if (char.slidingDir !== null) {
          char.stateMachine.setState(char.stateDef.IDLE);
        }
      });

    this.gridEngine
      .positionChangeFinished()
      .subscribe(({ charId, exitTile, enterTile, exitLayer }) => {
        if (!this.loadedPlayer) {
          return;
        }
        if (![this.player.config.id].includes(charId)) {
          return;
        }

        // make the playerMon follow the player
        if (this.scene.get('Preload').enablePlayerOWPokemon) {
          this.playerMon.moveTo(exitTile.x, exitTile.y, {
            targetLayer: exitLayer
          });
        }
      });
  }



  createCharacters() {
    this.gridEngine.create(this.config.tilemap, {
      characters: this.characters.map(char => {
        return char.characterDef();
      })
    });
    this.ge_init = true;
  }

  updateCharacters(time, delta) {
    if (this.loadedPlayer) {
      this.player.update(time, delta);
      if (this.scene.get('Preload').enablePlayerOWPokemon) {
        this.playerMon.update(time, delta);
      }
    }

    if (this.mon.length > 0) {
      this.mon.forEach((mon) => mon.update(time, delta));
    }

    if (this.ge_init && !this.ge_events_init) {
      this.initGEEvents();
      this.ge_events_init = true;
    }
  }



  getTilesWithProperty(property) {
    var tiles = []
    this.config.tilemap.getTileLayerNames().forEach(layer => {
      let layerTiles = this.config.tilemap.getTilesWithin(
        0,
        0,
        this.config.tilemap.width,
        this.config.tilemap.height,
        {},
        layer
      );

      layerTiles.forEach(layerTile => {
        if (layerTile && getValue(layerTile.properties, property, false)) {
          tiles.push([layerTile.x, layerTile.y]);
          return;
        }
      });
    });

    return tiles;
  }


  handleIceTiles(char, exitTile, enterTile) {
    let hasIceTiles = this.iceTiles.length;
    if (hasIceTiles > 0) {
      let isIceTile = this.iceTiles.some(tile => {
        return tile[0] == enterTile.x && tile[1] == enterTile.y;
      });
      if (isIceTile && !char.isSliding()) {
        char.stateMachine.setState(char.stateDef.SLIDE);
      }
      if (!isIceTile && char.isSliding()) {
        char.stateMachine.setState(char.stateDef.IDLE);
      }
    }
  }

  handleSpinTiles(char, exitTile, enterTile) {
    let hasSpinTiles = this.spinTiles.length;
    if (hasSpinTiles <= 0) {
      return;
    }

    let isSpinTile = this.spinTiles.some(tile => {
      return tile[0] == enterTile.x && tile[1] == enterTile.y;
    });
    if (isSpinTile) {
      let props = this.getTileProperties(enterTile.x, enterTile.y);
      let dir = getValue(props, 'sw_spin', false);
      if (!char.isSpinning() && dir !== false) {
        char.stateMachine.setState(char.stateDef.SPIN);
      }
      if (dir !== char.getSlidingDirection()) {
        char.setSpinDirection(dir);
      }
    }

    let isStopTile = this.stopTiles.some(tile => {
      return tile[0] == enterTile.x && tile[1] == enterTile.y;
    });
    if (isStopTile && char.isSpinning()) {
      char.stateMachine.setState(char.stateDef.IDLE);
    }
  }

  handleJumps(char, exitTile, enterTile) {
    if (this.jumpTiles.length === 0) { return; }

    let isJumpTile = this.jumpTiles.some(tile => {
      return tile[0] == enterTile.x && tile[1] == enterTile.y;
    });
    if (isJumpTile) {
      char.stateMachine.setState(char.stateDef.JUMP_LEDGE);
    }
  }

  handleWarps(char, exitTile, enterTile) {
    let warps = this.registry.get('warps');
    if (warps.length === 0) { return; }

    let warp = warps.find(p => p.x === enterTile.x && p.y === enterTile.y);
    if (typeof warp === 'undefined') { return; }

    let warpProps = warp.obj.properties;
    let warpLocation = getPropertyValue(warpProps, 'warp', null);
    if (warpLocation === null || warpLocation === ''){ return; }

    // this.player.disableMovement();
    this.cameras.main.fadeOut(this.cameraFade, 0, 0, 0);
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      (cam, effect) => {
        let playerLocation = {
          x: getPropertyValue(warpProps, 'warp-x', 0),
          y: getPropertyValue(warpProps, 'warp-y', 0),
          dir: getPropertyValue(warpProps, 'warp-dir', 'down'),
          charLayer: getPropertyValue(warpProps, 'layer', 'ground')
        };

        // same map, we dont need to move scene
        if (this.registry.get('map') === warpLocation) {
          this.warpPlayerInMap(playerLocation);
          this.cameras.main.fadeIn(this.cameraFade, 0, 0, 0);
          // this.player.enableMovement();
          return;
        }

        // new map!
        this.scene.start(warpLocation, {
          playerLocation: playerLocation
        });
        // this.player.enableMovement();
      }
    );
  }

}
