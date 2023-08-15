import blank from '@Tileset/blank.png';

import gen3inside from '@Tileset/gen3_inside.png';
import gen3inside_json from '@Tileset/gen3_inside.json';
import gen3outside from '@Tileset/gen3_outside.png';
import gen3outside_json from '@Tileset/gen3_outside.json';

import rse_inside from '@Tileset/rse_inside.png';
import rse_inside_json from '@Tileset/rse_inside.json';
import rse_outside from '@Tileset/rse_outside.png';
import rse_outside_json from '@Tileset/rse_outside.json';

import * as ow_pokemon_dimensions from '@Tileset/overworld/pokemon/files.json';
import * as ow_pokemon_shiny_dimensions from '@Tileset/overworld/pokemon_shiny/files.json';
import * as bs_normal_dimensions from '@Tileset/battlescene/normal/files.json';

import red from '@Tileset/characters/red.png';

import trainers from '@Tileset/characters';


let pokemonGlob = import.meta.glob('@Tileset/overworld/pokemon/*.png');
let pokemon = {};
Object.keys(pokemonGlob).map(img => {
  let id = img.split('/').pop().split('.')[0].padStart(3, '0');
  pokemon[id] = new URL(img, import.meta.url).pathname;
});

let pokemon_shinyGlob = import.meta.glob('@Tileset/overworld/pokemon_shiny/*.png');
let pokemon_shiny = {};
Object.keys(pokemon_shinyGlob).map(img => {
  let id = img.split('/').pop().split('.')[0].padStart(3, '0');
  pokemon_shiny[id] = new URL(img, import.meta.url).pathname;
});

export default {
  blank,
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
