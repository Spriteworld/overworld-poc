import * as Tile from '@Objects/Tile.js';
import Tileset from '@Tileset';
import { SpriteworldMap } from '@Maps';
import baseSounds from '@Worlds/_base/sounds.json';
import { registerItemDefs } from '@Data/itemDefs.js';

export const MAP_REGISTRY = {
  'Spriteworld': SpriteworldMap,
};
export const TILESET_REGISTRY = {};
export const TILESET_JSON_REGISTRY = {};
export const WORLD_MAP_KEYS = {};
export const WORLD_FILES = [];
export const INSIDE_MAP_SCENE_KEYS = [];
export const WORLD_SCENES = {};
export const WORLD_GAME_DEFS = {};
export const SOUND_REGISTRY = {
  bgm: { ...baseSounds.bgm },
  se:  { ...baseSounds.se  },
};

export function registerWorld(config) {
  Object.assign(MAP_REGISTRY, config.maps);

  for (const [name, ts] of Object.entries(config.tilesets ?? {})) {
    TILESET_REGISTRY[name] = { url: ts.url, frameWidth: Tile.WIDTH, frameHeight: Tile.HEIGHT };
    TILESET_JSON_REGISTRY[name] = ts.json;
  }

  Object.assign(WORLD_MAP_KEYS, config.worldMapKeys ?? {});

  if (config.worldFile) WORLD_FILES.push(config.worldFile);

  INSIDE_MAP_SCENE_KEYS.push(...(config.insideMapSceneKeys ?? []));

  Object.assign(WORLD_SCENES, config.scenes ?? {});

  if (config.gameDef) WORLD_GAME_DEFS[config.gameDef.id] = config.gameDef;

  if (config.sprites) Object.assign(Tileset.sprites, config.sprites);
  if (config.trainerSprites) Object.assign(Tileset.trainer, config.trainerSprites);

  if (config.sounds?.bgm) Object.assign(SOUND_REGISTRY.bgm, config.sounds.bgm);
  if (config.sounds?.se)  Object.assign(SOUND_REGISTRY.se,  config.sounds.se);

  if (config.items) registerItemDefs(config.items);
}

const SHARED = {
  'gen3_inside':       { url: Tileset.gen3inside,       json: Tileset.gen3inside_json },
  'gen3_outside':      { url: Tileset.gen3outside,      json: Tileset.gen3outside_json },
  'rse_inside':        { url: Tileset.rse_inside,       json: Tileset.rse_inside_json },
  'rse_outside':       { url: Tileset.rse_outside,      json: Tileset.rse_outside_json },
  'animated_grass':    { url: Tileset.animated_grass,    json: Tileset.animated_grass_json },
  'caves':             { url: Tileset.caves,             json: Tileset.caves_json },
  'gen3_gyms_inside':  { url: Tileset.gen3_gyms_inside,  json: Tileset.gen3_gyms_inside_json },
  'interactables':     { url: Tileset.interactables,     json: Tileset.interactables_json },
};

for (const [name, ts] of Object.entries(SHARED)) {
  TILESET_REGISTRY[name] = { url: ts.url, frameWidth: Tile.WIDTH, frameHeight: Tile.HEIGHT };
  TILESET_JSON_REGISTRY[name] = ts.json;
}
