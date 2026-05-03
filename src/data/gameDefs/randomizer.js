import kanto from './kanto.js';

/**
 * Randomizer preset — seeded-random encounter tables, 4 random moves per
 * Pokémon, and shuffled warp destinations.
 */
export default {
  ...kanto,
  id: 'randomizer',
  name: 'Kanto Randomizer',
  encounterTables: 'random',
  learnsets: '4random',
  entranceRandomizer: 'random',
};
