import Phaser from 'phaser';
import { Player, NPC, PkmnOverworld, ObjectTypes, Tile } from '@Objects';
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
    if (Debug.functions.gameMap) {
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
    this.pkmn = this.add.group();

    // load ALL THE THINGSSSSS
    this.objects = tilemap.getObjectLayer('interactions');
    if (this.objects !== null) {
      if (Debug.functions.gameMap) {
        console.log('GameMap::loadMap->objects');
      }
      this.registry.set('interactions', []);
      this.registry.set('warps', []);

      this.initSigns();
      this.initNpcs();
      this.initPkmn();
      this.initWarps();
      this.initJumps();
      this.initPlayer();

      this.debugObjects();
    }

    this.animatedTiles.init(tilemap);
  }

  initSigns() {
    if (Debug.functions.gameMap) {
      console.log('GameMap::initSigns');
    }
    let signs = this.findInteractions('sign');;
    if (signs.length === 0) { return; }

    signs.forEach((sign) => {
      sign.x /= Tile.WIDTH;
      sign.y /= Tile.HEIGHT;
      this.interactTile(this.config.tilemap, sign, 0x00afe4);
    });
  }

  initNpcs() {
    if (Debug.functions.gameMap) {
      console.log('GameMap::initNpcs');
    }
    let npcs = this.findInteractions('npc');;
    if (npcs.length === 0) { return; }

    this.npcs.runChildUpdate = true;
    let color = random_rgba();
    npcs.forEach((npc) => {
      let npcObj = this.addNPCToScene(
        npc.name,
        getPropertyValue(npc.properties, 'texture'),
        npc.x / Tile.WIDTH,
        npc.y / Tile.HEIGHT,
        {
          id: npc.name,
          scene: this,
          ...remapProps(npc.properties)
        }
      );
      this.npcs.add(npcObj);
    });
  }

  initPkmn() {
    if (Debug.functions.gameMap) {
      console.log('GameMap::initPkmn');
    }
    let pkmn = this.findInteractions('pkmn');
    if (pkmn.length === 0) { return; }

    this.pkmn.runChildUpdate = true;
    pkmn.forEach((npc) => {
      if (Debug.functions.gameMap) {
        console.log(
          'GameMap::initPkmn->each',
          npc.name,
          getPropertyValue(npc.properties, 'texture'),
          npc.x, npc.y
        );
      }
      let mon = this.addMonToScene(
        getPropertyValue(npc.properties, 'texture'),
        npc.x / Tile.WIDTH,
        npc.y / Tile.HEIGHT,
        {
          id: npc.name,
          scene: this,
          ...remapProps(npc.properties)
        }
      );
      this.pkmn.add(mon);
    });
  }

  initWarps() {
    if (Debug.functions.gameMap) {
      console.log('GameMap::initWarps');
    }
    let warps = this.findInteractions('warp');
    if (warps.length === 0) { return; }

    warps.forEach((obj) => {
      this.registry.get('warps').push({
        name: obj.id,
        x: obj.x / Tile.WIDTH,
        y: obj.y / Tile.HEIGHT,
        obj: obj
      });
    });
  }

  initPlayer() {
    if (Debug.functions.gameMap) {
      console.log('GameMap::initPlayer');
    }
    if (Object.keys(this.config.playerLocation).length != 0) {
      this.addPlayerToScene(this.config.playerLocation.x, this.config.playerLocation.y);
      return;
    }

    let spawn = this.findInteractions('playerSpawn');
    if (typeof spawn === null || spawn.length === 0) {
      throw 'No player spawn found';
    }
    if (spawn.length > 1) {
      throw 'Only 1 player spawn can be in the map.';
    }

    this.addPlayerToScene(spawn[0].x / Tile.WIDTH, spawn[0].y / Tile.HEIGHT);
  }

  initJumps() {
    if (Debug.functions.gameMap) {
      console.log('GameMap::initJumps');
    }
    if (this.jumpTiles.length === 0) { return; }

    this.jumpTiles.forEach(tile => this.tintTile(this.config.tilemap, tile[0], tile[1], 0x00afe4));

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

  findInteractions(type) {
    return this.config.tilemap.filterObjects(
      'interactions',
      (obj) => obj.type === type && obj.visible
    );
  }

  addPlayerToScene(x, y) {
    this.tintTile(this.config.tilemap,
      this.config.playerLocation.length > 0 ? this.config.playerLocation.x : x,
      this.config.playerLocation.length > 0 ? this.config.playerLocation.y : y,
      random_rgba()
    );

    if (Debug.functions.gameMap) {
      console.log('GameMap::addPlayerToScene', x, y);
    }
    this.loadedPlayer = true;
    this.player = new Player({
      id: 'player',
      texture: 'red',
      x: x,
      y: y,
      scene: this,
      'seen-radius': 3,
    });
    this.registry.set('player', this.player);
    this.cameras.main.startFollow(this.player, true);
    this.cameras.main.setFollowOffset(-this.player.width, -this.player.height);

    // debug for time overlay stuffs
    if (Debug.functions.timeOverlay === true) {
      this.cameras.main.setSize(400, 300);

      // evening
      let cam2 = this.cameras.add(400, 0, 400, 300);
      cam2.startFollow(this.player, true);
      cam2.setFollowOffset(-this.player.width, -this.player.height);

      // night
      let cam3 = this.cameras.add(0, 300, 400, 300);
      cam3.startFollow(this.player, true);
      cam3.setFollowOffset(-this.player.width, -this.player.height);

      // morning
      let cam4 = this.cameras.add(400, 300, 400, 300);
      cam4.startFollow(this.player, true);
      cam4.setFollowOffset(-this.player.width, -this.player.height);
    }

    if (this.scene.get('Preload').enablePlayerOWPokemon) {
      this.playerMon = this.addMonToScene('025', x +1, y, {
        id: 'playerMon',
        follow: this.player.config.id,
        collides: false,
        move: false,
        spin: false,
      });
    }
  }

  addNPCToScene(name, texture, x, y, config) {
    let npcDef = {...{
      id: 'npc_'+name,
      texture: texture,
      x: x,
      y: y,
      scene: this
    }, ...config };

    if (Debug.functions.gameMap) {
      console.log('GameMap::addNPCToScene', name, texture, x, y);
    }
    let npcObj = new NPC(npcDef);
    this.interactTile(this.config.tilemap, npcDef, 0x000000);
    return npcObj;
  }

  addMonToScene(monId, x, y, config) {
    if (config.texture) { delete config.texture; }

    let rng = false;
    if (monId == 'RNG') {
      monId = Math.floor(Math.random() * this.totalMon);
      rng = true;
    }
    if (typeof monId === 'number') {
      monId = monId.toString();
    }
    monId = monId.padStart(3, '0');

    if (rng) {
      console.info('mon got RNGd', monId, config.id, config);
    }

    // check for shiny
    let texture = monId.toString();
    if (getValue(config, 'shiny', false)) {
      texture += 's';
    }

    if (Debug.functions.gameMap) {
      console.log('GameMap::addMonToScene', monId, texture, x, y);
    }
    let pkmnDef = {...{
      id: 'mon'+this.mon.length,
      texture: texture,
      x: x,
      y: y,
      scene: this,
      'char-layer': 'ground'
    }, ...config };

    let pkmn = new PkmnOverworld(pkmnDef);
    this.interactTile(this.config.tilemap, pkmnDef, 0xff0000);
    return pkmn;
  }

  addCharacter(character) {
    this.characters.push(character);
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
    }
    if (this.scene.get('Preload').enablePlayerOWPokemon) {
      this.playerMon.update(time, delta);
    }

    if (this.mon.length > 0) {
      this.mon.forEach((mon) => mon.update(time, delta));
    }

    if (this.ge_init && !this.ge_events_init) {
      this.initGEEvents();
      this.ge_events_init = true;
    }
  }

  interactTile(map, obj, color) {
    this.registry.get('interactions').push({
      x: obj.x,
      y: obj.y,
      obj: obj
    });
  }

  tintTile(tilemap, col, row, color) {
    for (let i = 0; i < tilemap.layers.length; i++) {
      if (tilemap.layers[i].tilemapLayer?.layer?.visible) {
        tilemap.layers[i].tilemapLayer.layer.data[row][col].tint = color;
      }
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

  getTileProperties(x, y) {
    var props = {};
    this.config.tilemap.getTileLayerNames().forEach(layer => {
      let layerTiles = this.config.tilemap.getTilesWithin(x, y, 1, 1, {}, layer);

      var prop, value;
      layerTiles.forEach(layerTile => {
        if (layerTile) {
          Object.entries(layerTile.properties).forEach(prop => {
            [prop, value] = prop;
            // if we dont have it, add it
            if (typeof props[prop] === 'undefined') {
              props[prop] = value;
            }
            // if we already have it and its a bool
            if (typeof props[prop] === 'boolean') {
              // make it true
              if (value === true) {
                props[prop] = value;
              }
              // dont care about falses
            }
          });
        }
      });
    });

    return props;
  }

  debugObjects() {
    if (Debug.functions.gameMap) {
      console.log('GameMap::debugObjects');
    }
    if(Debug.grid === true) {
      this.add.grid(
        0, 0,
        this.config.tilemap.widthInPixels,
        this.config.tilemap.heightInPixels,
        Tile.WIDTH,
        Tile.HEIGHT
      )
        .setOrigin(0, 0)
        .setOutlineStyle(0x000000)
        .setAlpha(0.4)
        .setDepth(9999999)
      ;
    }

    if(Debug.objects !== true) {
      return;
    }
    let colors = {};
    Object.values(ObjectTypes).forEach((obj) => {
      colors[obj.name] = obj.color;
    });

    let graphics = this.add.graphics()
    Object.values(this.config.tilemap.getObjectLayer('interactions').objects)
      .forEach((obj) => {
        let text = this.add.text(0, 0, obj.name, {
            font: '12px',
            align: 'justify',
            padding: 3,
            color: '#fff',
            backgroundColor: (getValue(colors, obj.type, '#000')).substr(0, 7),
            shadow: {
              stroke: '#000',
              offsetX: 1,
              offsetY: 1,
            }
          })
        ;

        let tile = this.add.rectangle(obj.x, obj.y, obj.width, obj.height);
        tile.setOrigin(0,0);
        tile.setStrokeStyle(1, 0x1a65ac);
        var debugObj = this.add.container(0,0, [
          tile,
          Phaser.Display.Align.In.TopCenter(text, this.add.zone(obj.x-5, obj.y-15, obj.width+10, obj.height+10).setOrigin(0,0)),
        ]);
        debugObj.setDepth(9999999);
      })
    ;
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
      return tile[0] == facingTile.x && tile[1] == facingTile.y;
    });
    if (isJumpTile) {
      this.move(this.getFacingDirection());
      this.move(this.getFacingDirection());
    } else {

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
