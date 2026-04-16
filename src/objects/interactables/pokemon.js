import Debug from '@Data/debug.js';
import { Tile, PkmnOverworld } from '@Objects';
import { getValue, getPropertyValue, remapProps, Vector2, checkOnlyIf } from '@Utilities';
import store from '../../store/index.js';
import { rng as gameRng } from '@Utilities/rng.js';
import Tileset from '@Tileset';
import ScriptRunner from '../../utilities/ScriptRunner.js';

export default class {
  constructor(scene) {
    this.scene     = scene;
    this._enterSub = null;
  }

  init() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::pokemon');
    }
    this.scene.pkmn = this.scene.add.group();
    this.scene.pkmn.setName('pkmn');

    let pkmn = this.scene.findInteractions('pkmn');
    if (pkmn.length === 0) { return; }

    this.scene.pkmn.runChildUpdate = true;
    pkmn.forEach((pokemon) => {
      if (this.scene.game.config.debug.console.interactableShout) {
        console.log(
          'Interactables::pokemon::each',
          pokemon.name,
          getPropertyValue(pokemon.properties, 'texture'),
          pokemon.x, pokemon.y
        );
      }
      this.addToScene(
        pokemon.name,
        getPropertyValue(pokemon.properties, 'texture'),
        Vector2(pokemon.x / Tile.WIDTH, pokemon.y / Tile.HEIGHT),
        {
          properties: pokemon.properties,
          ...remapProps(pokemon.properties)
        }
      );
    });
  }

  addToScene(name, monId, coords, config) {
    if (config && config.texture) { delete config.texture; }

    let isRng = false;
    if (monId == 'RNG') {
      monId = Math.floor(gameRng() * this.scene.totalMon);
      isRng = true;
    }
    if (typeof monId === 'number') {
      monId = monId.toString();
    }
    monId = monId.padStart(3, '0');

    if (isRng) {
      console.info('mon got RNGd', monId, config.id, config);
    }

    // check for shiny
    let texture = monId.toString();
    const isShiny = getValue(config, 'shiny', false);
    if (isShiny) {
      texture += 's';
    }

    if (this.scene.game.config.debug.console.interactableShout) {
      console.log('Interactables::pokemon::addToScene', {
        id: name || 'pkmn_' + (this.scene.pkmn.length || monId),
        monId: monId,
        texture: texture,
        x: coords.x,
        y: coords.y
      });
    }

    let pkmnDef = {...{
      id: name || 'pkmn_' + (this.scene.pkmn.length || monId),
      texture: texture,
      x: coords.x,
      y: coords.y,
      scene: this.scene,
      'char-layer': 'ground'
    }, ...config };

    // Always create immediately so GridEngine can manage this character from scene init.
    // If the texture isn't loaded yet it will show a placeholder; setTexture() fixes it once loaded.
    let pkmn = new PkmnOverworld(pkmnDef);
    this.scene.pkmn.add(pkmn);
    this.scene.interactTile(this.scene.game.config.tilemap, pkmnDef, 0xff0000);

    if (this.scene.textures.exists(texture)) {
      this._ensureAnim(texture);
      // If GridEngine is already initialised (dynamic spawn mid-game), register now
      if (this.scene.ge_init) {
        this.scene.gridEngine.addCharacter(pkmn.characterDef());
      }
    } else {
      const pathFactory = isShiny ? Tileset.pokemon_shiny[texture] : Tileset.pokemon[texture];
      const dimSource   = isShiny ? Tileset.ow_pokemon_shiny_dimensions : Tileset.ow_pokemon_dimensions;
      const dims        = dimSource.default?.[texture];

      if (!pathFactory || !dims) {
        console.warn('Interactables::pokemon: missing sprite data for', texture);
        pkmn.setTexture('red');
        if (this.scene.ge_init) {
          this.scene.gridEngine.addCharacter(pkmn.characterDef());
        }
        return pkmn;
      }

      // Use 'red' as a placeholder while the real texture loads.
      pkmn.setTexture('red');
      if (this.scene.ge_init) {
        this.scene.gridEngine.addCharacter(pkmn.characterDef());
      }

      pathFactory().then(path => {
        if (!this.scene.sys) return;
        this.scene.load.spritesheet(texture, path, {
          frameWidth: Math.floor(dims.width  / 4),
          frameHeight: Math.floor(dims.height / 4),
        });
        this.scene.load.once('filecomplete-spritesheet-' + texture, () => {
          this._ensureAnim(texture);
          this.scene.pkmn.getChildren()
            .filter(n => n.config?.texture === texture)
            .forEach(n => {
              n.setTexture(texture);
              if (this.scene.gridEngine?.hasCharacter(n.config.id)) {
                this.scene.gridEngine.setWalkingAnimationMapping(n.config.id, n.characterFramesDef());
              }
            });
        });
        this.scene.load.start();
      });
    }

    return pkmn;
  }

  _ensureAnim(texture) {
    if (!this.scene.anims.exists(texture + '-spin')) {
      this.scene.anims.create({
        key: texture + '-spin',
        frames: this.scene.anims.generateFrameNumbers(texture, { frames: [0, 4, 12, 8] }),
        frameRate: 7,
        repeat: -1
      });
    }
  }

  event() {
    if (this.scene.game.config.debug.console.interactableShout) {
      console.log(['Interactables::pokemon::event', this.scene]);
    }

    this._onInteract = (tile) => {
      if (tile.obj.type !== 'pkmn') { return; }

      const scriptTrigger = this.scene.getPropertyFromTile(tile.obj, 'script-trigger') ?? 'interact';
      if (scriptTrigger !== 'interact') return;

      const player      = this.scene.characters.get('player');
      const char        = this.scene.characters.get(tile.obj.id);
      const originalDir = char?.getFacingDirection() ?? null;
      char?.look(player.getOppositeFacingDirection());
      char?.stopSpin(true);

      const text   = this.scene.getPropertyFromTile(tile.obj, 'text');
      const script = this.scene.getPropertyFromTile(tile.obj, 'script');
      if (!text && !script) { return; }

      const onlyIf = this.scene.getPropertyFromTile(tile.obj, 'only_if') ?? null;
      if (!checkOnlyIf(onlyIf, store.state.game.gameFlags, this.scene.config.variant ?? null, this.scene.mapVars ?? {})) return;

      const restore = () => { if (originalDir) char?.look(originalDir); };

      const runScript = (raw) => {
        let commands = Array.isArray(raw) ? raw : null;
        if (!commands) {
          try { commands = JSON.parse(raw); } catch (e) {
            console.warn(`[Interactables::pokemon] Invalid script JSON for "${tile.obj.name}":`, e.message);
            restore();
            return;
          }
        }
        if (Array.isArray(commands)) {
          new ScriptRunner(this.scene, [...commands]).run(restore);
        }
      };

      if (text) {
        this.scene.game.events.emit('textbox-changedata', text, tile.obj);
        if (script) {
          this.scene.game.events.once('textbox-disable', () => runScript(script));
        } else {
          this.scene.game.events.once('textbox-disable', restore);
        }
      } else {
        runScript(script);
      }
    };
    this.scene.game.events.on('interact-with-obj', this._onInteract);

    // ── Enter trigger ──────────────────────────────────────────────────────
    if (this.scene.gridEngine) {
      this._enterSub = this.scene.gridEngine
        .positionChangeFinished()
        .subscribe(({ charId, enterTile }) => {
          if (charId !== 'player') return;
          this.scene.pkmn.getChildren().forEach(pkmn => {
            const cfg = pkmn.config;
            if (!cfg?.properties) return;
            const scriptTrigger = this.scene.getPropertyFromTile(cfg, 'script-trigger');
            if (scriptTrigger !== 'enter') return;
            const script = this.scene.getPropertyFromTile(cfg, 'script');
            if (!script) return;
            const pos = this.scene.gridEngine.getPosition(cfg.id);
            if (!pos || pos.x !== enterTile.x || pos.y !== enterTile.y) return;
            const onlyIf = this.scene.getPropertyFromTile(cfg, 'only_if') ?? null;
            if (!checkOnlyIf(onlyIf, store.state.game.gameFlags, this.scene.config.variant ?? null, this.scene.mapVars ?? {})) return;
            new ScriptRunner(this.scene, [...script]).run();
          });
        });
    }
  }

  destroy() {
    this.scene.game.events.off('interact-with-obj', this._onInteract);
    if (this._enterSub) this._enterSub.unsubscribe();
  }
};
