import { WORLD_GAME_DEFS } from '@/worlds/registry.js';
import kanto from '@Worlds/kanto/gameDef.js';
import nuzlocke from './nuzlocke.js';
import randomizer from './randomizer.js';

WORLD_GAME_DEFS[kanto.id] = kanto;
WORLD_GAME_DEFS[nuzlocke.id] = nuzlocke;
WORLD_GAME_DEFS[randomizer.id] = randomizer;

export { kanto, nuzlocke, randomizer };
