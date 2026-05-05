import kanto from '@Worlds/kanto/gameDef.js';

/**
 * Nuzlocke ruleset on top of the standard Kanto definition.
 * Only the first Pokémon caught in each encounter zone may be kept;
 * subsequent Pokéball throws in that zone are blocked with a message.
 */
export default {
  ...kanto,
  id: 'nuzlocke',
  name: 'Kanto Nuzlocke',
  gameMode: 'nuzlocke',
};
