import blank from '@Tileset/blank.png';

import animated_grass from '@Tileset/animated_grass.png';
import animated_grass_json from '@Tileset/animated_grass.json';
import animation_sheet from '@Tileset/animation.png';

import caves      from '@Tileset/caves.png';
import caves_json from '@Tileset/caves.json';

import gen3inside from '@Tileset/gen3_inside.png';
import gen3inside_json from '@Tileset/gen3_inside.json';
import gen3outside from '@Tileset/gen3_outside.png';
import gen3outside_json from '@Tileset/gen3_outside.json';

import gen3_gyms_inside from '@Tileset/gen3_gyms_inside.png';
import gen3_gyms_inside_json from '@Tileset/gen3_gyms_inside.json';

import rse_inside from '@Tileset/rse_inside.png';
import rse_inside_json from '@Tileset/rse_inside.json';
import rse_outside from '@Tileset/rse_outside.png';
import rse_outside_json from '@Tileset/rse_outside.json';

import interactables from '@Tileset/interactables/interactables.png';
import interactables_json from '@Tileset/interactables/interactables.json';

import * as ow_pokemon_dimensions from '@Worlds/_base/pokemon/overworld/pokemon/files.json';
import * as ow_pokemon_shiny_dimensions from '@Worlds/_base/pokemon/overworld/pokemon_shiny/files.json';

import statuses_sheet from '@Tileset/statuses.png';

import base_surf    from '@Worlds/_base/characters/sprites/base_surf.png';
import red          from '@Worlds/_base/characters/sprites/red.png';
import red_bike     from '@Worlds/_base/characters/sprites/red_bike.png';
import red_run      from '@Worlds/_base/characters/sprites/red_run.png';
import red_surf     from '@Worlds/_base/characters/sprites/red_surf.png';
import leaf         from '@Worlds/_base/characters/sprites/leaf.png';
import leaf_bike    from '@Worlds/_base/characters/sprites/leaf_bike.png';
import leaf_run     from '@Worlds/_base/characters/sprites/leaf_run.png';
import leaf_surf    from '@Worlds/_base/characters/sprites/leaf_surf.png';
import brendan      from '@Worlds/_base/characters/sprites/brendan.png';
import brendan_bike from '@Worlds/_base/characters/sprites/brendan_bike.png';
import brendan_surf from '@Worlds/_base/characters/sprites/brendan_surf.png';
import may          from '@Worlds/_base/characters/sprites/may.png';
import may_bike     from '@Worlds/_base/characters/sprites/may_bike.png';
import may_surf     from '@Worlds/_base/characters/sprites/may_surf.png';

import trainers, { sprites, trainer } from '@Worlds/_base/characters';

const _pokemonGlob      = import.meta.glob('../pokemon/overworld/pokemon/*.png',       { eager: false, query: '?url', import: 'default' });
const _pokemonShinyGlob = import.meta.glob('../pokemon/overworld/pokemon_shiny/*.png',  { eager: false, query: '?url', import: 'default' });

const pokemon = Object.fromEntries(
  Object.entries(_pokemonGlob).map(([path, factory]) => [
    path.split('/').pop().replace('.png', '').padStart(3, '0'),
    factory,
  ])
);

const pokemon_shiny = Object.fromEntries(
  Object.entries(_pokemonShinyGlob).map(([path, factory]) => [
    path.split('/').pop().replace('.png', ''),
    factory,
  ])
);

export default {
  blank,
  animated_grass,
  animated_grass_json,
  animation_sheet,
  caves,
  caves_json,
  gen3inside,
  gen3inside_json,
  gen3outside,
  gen3outside_json,
  gen3_gyms_inside,
  gen3_gyms_inside_json,
  rse_inside,
  rse_inside_json,
  rse_outside,
  rse_outside_json,
  interactables,
  interactables_json,

  base_surf,

  red,
  red_bike,
  red_run,
  red_surf,
  leaf,
  leaf_bike,
  leaf_run,
  leaf_surf,
  brendan,
  brendan_bike,
  brendan_surf,
  may,
  may_bike,
  may_surf,

  sprites,
  trainers,
  trainer,

  ow_pokemon_dimensions,
  ow_pokemon_shiny_dimensions,
  pokemon,
  pokemon_shiny,

  statuses_sheet,
};
