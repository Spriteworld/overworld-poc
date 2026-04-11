import kanto from './kanto.js';

/**
 * Randomizer preset — seeded-random encounter tables and random learnsets.
 * All Gen 1 Pokémon are in the pool; any species can appear anywhere.
 */
export default {
  ...kanto,
  id:             'randomizer',
  name:           'Kanto Randomizer',
  gameMode:       'map_randomizer',
  encounterTables: 'random',
  learnsets:      'random',
};
