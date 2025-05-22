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

let loadPokemonSprites = [
  1,2,3,4,5,6,7,8,9,22,25,197,'197s','025s'
];
loadPokemonSprites = loadPokemonSprites.map(id => {
  if (typeof id === 'number') {
    id = id.toString();
  }
  return id.padStart(3, '0');
});

// let pokemonGlob = import.meta.glob('@Tileset/overworld/pokemon/*.png', { eager: false, query: '?url', import: 'default' });
let pokemonGlob = loadPokemonSprites.filter(id => id.length === 3);
let pokemon = {};
Object.values(pokemonGlob).map((key) => {
  let id = key.split('/').pop().split('.')[0].padStart(3, '0');
  if(!loadPokemonSprites.includes(id)) { return; }
  pokemon[id] = new URL('overworld/pokemon/'+id+'.png', import.meta.url).href;
});

let pokemon_shinyGlob = loadPokemonSprites.filter(id => id.length !== 3);
let pokemon_shiny = {};
Object.values(pokemon_shinyGlob).map((key) => {
  let id = key.split('/').pop().split('.')[0].padStart(3, '0');
  if(!loadPokemonSprites.includes(id)) { return; }
  pokemon_shiny[id] = new URL('overworld/pokemon_shiny/'+id+'.png', import.meta.url).href;
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
