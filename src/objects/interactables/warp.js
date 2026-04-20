import Phaser from 'phaser';
import { Tile, Interactables, GameMap, Direction } from '@Objects';
import { getPropertyValue, checkOnlyIf } from '@Utilities';
import store from '../../store/index.js';

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
    console.log(`[Warp] found ${warps.length} warp objects on this map`, warps);

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
          objCopy.x = objCopy.x + (x * Tile.WIDTH);
          objCopy.y = objCopy.y + (y * Tile.HEIGHT);

          let targetXIdx = objCopy.properties.findIndex(w => w.name === 'warp-x');
          if (targetXIdx !== -1) objCopy.properties[targetXIdx].value = obj.properties[targetXIdx].value + x;

          let targetYIdx = objCopy.properties.findIndex(w => w.name === 'warp-y');
          if (targetYIdx !== -1) objCopy.properties[targetYIdx].value = obj.properties[targetYIdx].value + y;

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
    this.scene.registry.get('warps').push({
      name: obj.id,
      x: parseInt(obj.x / Tile.WIDTH),
      y: parseInt(obj.y / Tile.HEIGHT),
      obj: obj
    });
    if (this.scene.game.config.debug.console.interactableShout) {
      const props = obj.properties ?? [];
      const warpxProp = props.find(w => w.name === 'warp-x');
      const warpyProp = props.find(w => w.name === 'warp-y');
      const warpProp  = props.find(w => w.name === 'warp');
      console.log(['Interactables::warp::addWarp', parseInt(obj.x), parseInt(obj.y),
        warpxProp?.value ?? warpProp?.value, warpyProp?.value]);
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
    if (this.warps.length === 0) return;

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
   * Resolve a warpLocation object by name to a playerLocation coordinate set.
   * Searches the current scene's interactions for a `warpLocation` object
   * whose name matches the given string.
   * @param {string} name - The warpLocation object name.
   * @returns {{x:number,y:number,dir:string,charLayer:string}|null}
   */
  resolveWarpLocation(name) {
    const locations = this.scene.findInteractions('warpLocation');
    console.log('[Warp] resolveWarpLocation', JSON.stringify(name), '— available:', locations.map(l => l.name));
    const obj = locations.find(l => l.name === name);
    if (!obj) {
      console.warn(`[Warp] warpLocation "${name}" not found on this map`);
      return null;
    }
    return {
      x: parseInt(obj.x / Tile.WIDTH),
      y: parseInt(obj.y / Tile.HEIGHT),
      dir: getPropertyValue(obj.properties ?? [], 'warp-dir', Direction.DOWN),
      charLayer: getPropertyValue(obj.properties ?? [], 'layer', 'ground'),
    };
  }

  /**
   * Check whether a character has stepped onto a warp tile and, if so,
   * initiate the appropriate warp action.
   * @param {Character} char - The character that moved.
   * @param {{x:number,y:number}} exitTile - The tile the character left.
   * @param {{x:number,y:number}} enterTile - The tile the character entered.
   */
  handleWarps(char, exitTile, enterTile) {
    // console.log('[Warp] positionChange', char.name, 'exit', exitTile, 'enter', enterTile);
    if (this.warps.length === 0) { return; }

    const tileWarps = this.warps.filter(p => p.x === enterTile.x && p.y === enterTile.y);
    if (tileWarps.length === 0) {
      // console.log('[Warp] no warp at', enterTile, '— registered warps:', this.warps.map(w => `(${w.x},${w.y})`));
      return;
    }

    const variant  = this.scene.config.variant ?? null;
    const mapVars  = this.scene.mapVars ?? {};
    const gameFlags = store.state.game.gameFlags;
    const warp = tileWarps.find(w => {
      const onlyIf = getPropertyValue(w.obj.properties, 'only_if');
      const pass   = checkOnlyIf(onlyIf, gameFlags, variant, mapVars);
      if (onlyIf) {
        let actual;
        if (!onlyIf.type || onlyIf.type === 'flag') {
          const key = onlyIf.key ?? null;
          actual = key ? (key in mapVars ? mapVars[key] : gameFlags[key]) : onlyIf.value?.map(v => `${v}=${!!gameFlags[v]}`).join(', ');
        } else if (onlyIf.type === 'variant') {
          actual = variant;
        } else if (onlyIf.type === 'variable') {
          const key = onlyIf.key ?? onlyIf.value?.[0];
          actual = mapVars[key];
        }
        console.log(`[Warp] only_if check — "${w.obj.name}" actual=${JSON.stringify(actual)} → ${pass ? 'pass' : 'fail'}`, onlyIf);
      }
      return pass;
    });
    if (!warp) return;

    let warpProps        = warp.obj.properties;
    let warpTarget       = getPropertyValue(warpProps, 'warp', null);
    let warpLocationName = getPropertyValue(warpProps, 'warp-location', null);
    let warpVariant      = getPropertyValue(warpProps, 'warp-variant', null);
    console.log('[Warp] matched warp tile → target:', warpTarget, '| location:', warpLocationName, '| variant:', warpVariant, '| props:', warpProps);

    if (warpTarget === null || warpTarget === '') {
      console.warn('[Warp] warp tile has no target scene (warp property missing or empty)');
      return;
    }

    if (char.config.type !== 'player') {
      if (this.scene.registry.get('map') === warpTarget) {
        const loc = this.resolveWarpLocation(warpLocationName);
        if (loc) { this.warpPlayerInMap(char, loc); }
      }
      char.visible = false;
      return;
    }

    this.warpPlayerToMap(char, warpTarget, warpLocationName, warpVariant);
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

    // move the player, preserving their current facing direction
    this.scene.gridEngine.setPosition(char.name, pos, playerLocation.layer);
    char.look(char.getFacingDirection());

    if (this.scene.mapPlugins['player'].hasPlayerMon) {
      // get the pokemon to be in the right spot
      this.scene.gridEngine.setPosition(
        this.scene.mapPlugins['player'].playerMon.config.id,
        char.getPosInBehindDirection(),
        playerLocation.layer
      );
    }
  }

  /**
   * Fade out the camera then switch to a different map scene, placing the
   * character at the named warpLocation on arrival.
   * @param {Character} char - The character to warp.
   * @param {string} warpTarget - Scene key of the destination map, or '_this_'.
   * @param {string} warpLocationName - Name of the warpLocation object on the destination map.
   */
  warpPlayerToMap(char, warpTarget, warpLocationName, warpVariant = null) {
    // `_lastmap_` sentinel — resolve from the Vuex-persisted last-outdoor
    // location so exit doors don't each need their own hard-coded destination.
    // Ignores `warp-location` / `warp-variant` on the triggering warp object;
    // the player lands on the exact tile they last stood on outside.
    let playerLocationOverride = null;
    if (warpTarget === '_lastmap_') {
      const out = store.state.game.lastOutdoorLocation;
      if (!out?.map) {
        console.warn('[Warp] _lastmap_ used but no lastOutdoorLocation is recorded — skipping');
        return;
      }
      warpTarget             = out.map;
      warpLocationName       = null;
      warpVariant            = null;
      playerLocationOverride = { x: out.x, y: out.y, charLayer: out.charLayer };
    }

    console.log('[Warp] warpPlayerToMap — from:', this.scene.config.mapName, '→', warpTarget, '| location:', warpLocationName);

    // Same map — resolve the warpLocation on this scene and teleport in place
    if (this.scene.config.mapName === warpTarget || warpTarget === '_this_') {
      console.log('[Warp] same-map teleport');
      const loc = this.resolveWarpLocation(warpLocationName);
      console.log('[Warp] resolved location:', loc);
      if (!loc) { return; }
      char.disableMovement();
      this.scene.cameras.main.fadeOut(500, 0, 0, 0);
      this.scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.warpPlayerInMap(char, loc);
        this.scene.cameras.main.fadeIn(500, 0, 0, 0);
        char.enableMovement();
      });
      return;
    }

    // Cross-map — pass the warpLocation name so the destination scene can resolve it
    const destScene = this.scene.scene.get(warpTarget);
    console.log('[Warp] cross-map — destScene:', destScene?.constructor?.name ?? warpTarget, '| inside:', destScene?.config?.inside ?? 'unknown');
    if (destScene?.config?.inside) {
      this._dismountBike(char);
    }

    // Persist current facing so the destination scene can restore it
    store.commit('game/SET_PLAYER_FACING', char.getFacingDirection());

    char.disableMovement();

    // Capture and freeze any active script immediately so it doesn't advance
    // into commands that reference the destination map while we are still on
    // the current map (the warp fires on positionChangeStarted, but the script
    // advances on positionChangeFinished — those are two separate ticks).
    let pendingScript;
    const runner = this.scene._activeScriptRunner;
    if (runner?._queue?.length) {
      pendingScript = [...runner._queue];
      runner._queue.length = 0;
    }

    this.scene.cameras.main.fadeOut(500, 0, 0, 0);
    this.scene.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => {
        this.scene.registry.set('map', warpTarget);
        const startParams = playerLocationOverride
          ? { playerLocation: playerLocationOverride }
          : { warpLocationName };
        if (warpVariant) startParams.variant = warpVariant;
        if (pendingScript) startParams._pendingScript = pendingScript;
        this.scene.scene.start(warpTarget, startParams);
      }
    );
  }

  /**
   * Immediately switch to a different map scene without a camera fade.
   * @param {Character} char - The character to warp.
   * @param {string} warpTarget - Scene key of the destination map.
   * @param {string} [warpLocationName] - Name of the warpLocation object on the destination map.
   */
  /**
   * If the character is on the bike, transition them back to IDLE and update the store.
   * @param {Character} char
   */
  _dismountBike(char) {
    if (char.stateMachine.currentState?.name !== char.stateDef.BIKE) return;
    char.stateMachine.setState(char.stateDef.IDLE);
    store.commit('game/SET_ON_BIKE', false);
  }

  warpPlayerToMapWithoutFade(char, warpTarget, locationData) {
    this.scene.registry.set('map', warpTarget);
    let startData;
    if (typeof locationData === 'string') {
      startData = { warpLocationName: locationData };
    } else if (locationData) {
      startData = { playerLocation: locationData };
    } else {
      startData = {};
    }
    const warpRunner = this.scene._activeScriptRunner;
    if (warpRunner?._queue?.length) {
      startData._pendingScript = [...warpRunner._queue];
      warpRunner._queue.length = 0;
    }
    this.scene.scene.start(warpTarget, startData);
  }
}