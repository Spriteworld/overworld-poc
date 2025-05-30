import * as Tile from './Tile.js';
import * as Direction from './Direction.js';
import Game from './Game.js';
import GameMap from './GameMap.js';
import Interactables from './interactables/index.js';
import Items from './items/index.js';

import MovableSprite from './characters/MovableSprite.js';
import Character from './characters/Character.js';
import Player from './characters/Player.js';
import NPC from './characters/NPC.js';
import PkmnOverworld from './characters/PkmnOverworld.js';

import * as ObjectTypesImport from '../tileset/objecttypes.json';
let ObjectTypes = ObjectTypesImport.default;

import Flock from './misc/Flock.js';

export {
  Tile, Direction,
  Game, GameMap,
  Interactables,
  Items,

  MovableSprite,
  Character,
  Player,
  NPC,
  PkmnOverworld,

  ObjectTypes,

  Flock,
};
