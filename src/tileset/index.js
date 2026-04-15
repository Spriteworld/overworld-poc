import blank from '@Tileset/blank.png';

import animated_grass from '@Tileset/animated_grass.png';
import animation_sheet from '@Tileset/maps/animation.png';

import gen3inside from '@Tileset/gen3_inside.png';
import gen3inside_json from '@Tileset/gen3_inside.json';
import gen3outside from '@Tileset/gen3_outside.png';
import gen3outside_json from '@Tileset/gen3_outside.json';

import kanto_common       from '@Tileset/maps/kanto_common.png';
import kanto_common_json   from '@Tileset/maps/kanto_common.json';
import kanto_outside      from '@Tileset/maps/kanto_outside.png';
import kanto_outside_json  from '@Tileset/maps/kanto_outside.json';
import kanto_inside       from '@Tileset/maps/kanto_inside.png';
import kanto_inside_json  from '@Tileset/maps/kanto_inside.json';

import rse_inside from '@Tileset/rse_inside.png';
import rse_inside_json from '@Tileset/rse_inside.json';
import rse_outside from '@Tileset/rse_outside.png';
import rse_outside_json from '@Tileset/rse_outside.json';

import * as ow_pokemon_dimensions from '@Tileset/overworld/pokemon/files.json';
import * as ow_pokemon_shiny_dimensions from '@Tileset/overworld/pokemon_shiny/files.json';
import * as bs_normal_dimensions from '@Tileset/battlescene/normal/files.json';

import red from '@Tileset/characters/sprites/red.png';

import trainers from '@Tileset/characters';

const _pokemonGlob      = import.meta.glob('./overworld/pokemon/*.png',       { eager: false, query: '?url', import: 'default' });
const _pokemonShinyGlob = import.meta.glob('./overworld/pokemon_shiny/*.png',  { eager: false, query: '?url', import: 'default' });

const pokemon = Object.fromEntries(
  Object.entries(_pokemonGlob).map(([path, factory]) => [
    path.split('/').pop().replace('.png', '').padStart(3, '0'),
    factory,
  ])
);

const pokemon_shiny = Object.fromEntries(
  Object.entries(_pokemonShinyGlob).map(([path, factory]) => [
    path.split('/').pop().replace('.png', '').padStart(3, '0') + 's',
    factory,
  ])
);

export default {
  blank,
  animated_grass,
  animation_sheet,
  kanto_common,
  kanto_common_json,
  kanto_outside,
  kanto_outside_json,
  kanto_inside,
  kanto_inside_json,
  gen3inside,
  gen3inside_json,
  gen3outside,
  gen3outside_json,
  rse_inside,
  rse_inside_json,
  rse_outside,
  rse_outside_json,

  red,
  trainers,

  ow_pokemon_dimensions,
  ow_pokemon_shiny_dimensions,
  bs_normal_dimensions,
  pokemon,
  pokemon_shiny
};
