import Phaser from 'phaser';
import { Player, NPC, PkmnOverworld, ObjectTypes, Tile } from '@Objects';
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
    this.totalMon = 386;
    this.npcs = [];

    this.ge_init = false;
    this.ge_events_init = false;
  }

  init(data) {
    this.config = { ...this.config, ...data };
    this.player = {};
    this.playerMon = {};
    this.characters = [];
    this.mon = [];
    this.warps = [];
    this.ge_init = false;
    this.ge_events_init = false;
  }

  preloadMap() {
    this.load.tilemapTiledJSONExternal(this.config.mapName, this.config.map);
  }

  loadMap() {
    console.log('GameMap::loadMap: '+ this.config.mapName);
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
    tilemap.layers.forEach((layer) => {
      // console.log('[GameMap]', layer);
      tilemap
        .createLayer(layer.name, tilesets)
        .setName(layer.name);
    });

    // map features
    this.iceTiles = this.getTilesWithProperty('sw_slide');
    this.spinTiles = this.getTilesWithProperty('sw_spin');
    this.stopTiles = this.getTilesWithProperty('sw_stop');

    // load ALL THE THINGSSSSS
    this.objects = tilemap.getObjectLayer('interactions');
    if (this.objects !== null) {
      this.registry.set('interactions', []);
      this.registry.set('warps', []);

      this.initSigns();
      this.initNpcs();
      this.initPkmn();
      this.initWarps();
      this.initPlayer();

      this.debugObjects();
    }

    this.animatedTiles.init(tilemap);
  }

  initSigns() {
    let signs = this.config.tilemap.filterObjects(
      'interactions',
      (obj) => obj.type === 'sign' && obj.visible
    );
    if (signs.length === 0) { return; }

    signs.forEach((sign) => {
      sign.x /= Tile.WIDTH;
      sign.y /= Tile.HEIGHT;
      this.interactTile(this.config.tilemap, sign, 0x00afe4);
    });
  }

  initNpcs() {
    let npcs = this.config.tilemap.filterObjects(
      'interactions',
      (obj) => obj.type === 'npc' && obj.visible
    );
    if (npcs.length === 0) { return; }

    this.npcs = this.add.group();
    this.npcs.runChildUpdate = true;
    let color = this.random_rgba();
    npcs.forEach((npc) => {
      this.addNPCToScene(
        npc.name,
        this.getPropertyValue(npc.properties, 'texture'),
        npc.x / Tile.WIDTH,
        npc.y / Tile.HEIGHT,
        {
          id: npc.name,
          scene: this,
          ...this.remapProps(npc.properties)
        }
      );
    });
  }

  initPkmn() {
    let pkmn = this.config.tilemap.filterObjects(
      'interactions',
      (obj) => obj.type === 'pkmn' && obj.visible
    );
    if (pkmn.length === 0) { return; }

    this.pkmn = this.add.group();
    this.pkmn.runChildUpdate = true;
    pkmn.forEach((npc) => {
      this.addMonToScene(
        this.getPropertyValue(npc.properties, 'texture'),
        npc.x / Tile.WIDTH,
        npc.y / Tile.HEIGHT,
        {
          id: npc.name,
          scene: this,
          ...this.remapProps(npc.properties)
        }
      );
    });
  }

  initWarps() {
    let warps = this.config.tilemap.filterObjects(
      'interactions',
      (obj) => obj.type === 'warp' && obj.visible
    );
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
    if (Object.keys(this.config.playerLocation).length != 0) {
      this.addPlayerToScene(this.config.playerLocation.x, this.config.playerLocation.y);
      return;
    }

    let spawn = this.config.tilemap.filterObjects(
      'interactions',
      (obj) => obj.type === 'playerSpawn' && obj.visible
    );
    if (typeof spawn === null || spawn.length === 0) {
      throw 'No player spawn found';
    }
    if (spawn.length > 1) {
      throw 'Only 1 player spawn can be in the map.';
    }

    this.addPlayerToScene(spawn[0].x / Tile.WIDTH, spawn[0].y / Tile.HEIGHT);
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

        // check for spin tiles
        let hasSpinTiles = this.spinTiles.length;
        if (hasSpinTiles > 0) {
          let isSpinTile = this.spinTiles.some(tile => {
            return tile[0] == enterTile.x && tile[1] == enterTile.y;
          });
          if (isSpinTile) {
            let props = this.getTileProperties(enterTile.x, enterTile.y);
            let dir = this.getValue(props, 'sw_spin', false);
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

        // setup handlers etc
        this.handleWarps(enterTile);
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

  addPlayerToScene(x, y) {
    this.tintTile(this.config.tilemap,
      this.config.playerLocation.length > 0 ? this.config.playerLocation.x : x,
      this.config.playerLocation.length > 0 ? this.config.playerLocation.y : y,
      this.random_rgba()
    );

    this.loadedPlayer = true;
    this.player = new Player({
      id: 'player',
      texture: 'red',
      x: x,
      y: y,
      scene: this,
      'seen-radius': 3
    });
    this.registry.set('player', this.player);
    this.cameras.main.startFollow(this.player, true);
    this.cameras.main.setFollowOffset(-this.player.width, -this.player.height);

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

    let npcObj = new NPC(npcDef);
    this.npcs.add(npcObj);
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
    if (monId.length < 3) {
      monId = monId.toString().padStart(3, '0');
    }

    if (rng) {
      console.info('mon got RNGd', monId, config.id, config);
    }

    // check for shiny
    let texture = monId.toString();
    if (this.getValue(config, 'shiny', false)) {
      texture += 's';
    }

    let pkmnDef = {...{
      id: 'mon'+this.mon.length,
      texture: texture,
      x: x,
      y: y,
      scene: this,
      spin: true,
      'spin-rate': Phaser.Math.Between(0, 1000)
    }, ...config };

    let pkmn = new PkmnOverworld(pkmnDef);
    this.mon.push(pkmn);
    this.interactTile(this.config.tilemap, pkmnDef, 0x000000);
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
      this.mon.forEach(function (mon) {
        mon.update(time, delta);
      });
    }

    if (this.ge_init && !this.ge_events_init) {
      this.initGEEvents();
      this.ge_events_init = true;
    }
  }

  handleWarps(enterTile) {
    let warps = this.registry.get('warps');
    if (warps.length === 0) { return; }

    let warp = warps.find(p => p.x === enterTile.x && p.y === enterTile.y);
    if (typeof warp === 'undefined') { return; }

    let warpProps = warp.obj.properties;
    let warpLocation = this.getPropertyValue(warpProps, 'warp', null);
    if (warpLocation === null || warpLocation === ''){ return; }

    // this.player.disableMovement();
    this.cameras.main.fadeOut(this.cameraFade, 0, 0, 0);
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      (cam, effect) => {
        let playerLocation = {
          x: this.getPropertyValue(warpProps, 'warp-x', 0),
          y: this.getPropertyValue(warpProps, 'warp-y', 0),
          dir: this.getPropertyValue(warpProps, 'warp-dir', 'down'),
          charLayer: this.getPropertyValue(warpProps, 'layer', 'ground')
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

  interactTile(map, obj, color) {
    this.registry.get('interactions').push({
      x: obj.x,
      y: obj.y,
      obj: obj
    });
  }

  tintTile(tilemap, col, row, color) {
    for (let i = 0; i < tilemap.layers.length; i++) {
      tilemap.layers[i].tilemapLayer.layer.data[row][col].tint = color;
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
        if (layerTile && this.getValue(layerTile.properties, property, false)) {
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

  getPropertyValue(props, id, defValue) {
    if (typeof props === 'undefined' || Object.values(props).length === 0) {
      return defValue;
    }
    let property = props.find(p => p.name === id);
    return typeof property === 'undefined' ? defValue : property.value;
  }

  getValue(obj, value, defValue) {
    return Phaser.Utils.Objects.GetValue(obj, value, defValue);
  }

  remapProps(props) {
    let values = {};
    Object.values(props).forEach(prop => {
      values = {...values, ...{ [prop.name]: prop.value }};
    });
    return values;
  }

  random_rgba() {
    return '0x' + Math.floor(Math.random() * 16777215).toString(16);
  }


  debugObjects() {
    if(Debug.grid === true) {
      this.add.grid(0, 0, this.config.tilemap.widthInPixels, this.config.tilemap.heightInPixels, Tile.WIDTH, Tile.HEIGHT)
        .setOrigin(0, 0)
        .setOutlineStyle(0x000000)
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
    Object.values(this.config.tilemap.getObjectLayer('interactions').objects).forEach((obj) => {

      let text = this.add.text(0, 0, obj.name, {
          font: '12px',
          align: 'justify',
          padding: 3,
          color: '#fff',
          backgroundColor: (this.getValue(colors, obj.type, '#000')).substr(0, 7),
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
    });
  }

}
