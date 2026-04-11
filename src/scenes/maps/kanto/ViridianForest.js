import { GameMap } from '@Objects';
import { ViridianForestMap } from '@Maps';

export default class extends GameMap {
  constructor() {
    super({
      mapName: 'ViridianForest',
      map: ViridianForestMap,
      active: false,
      visible: false,
    });
  }

  preload() {
    this.preloadMap();
  }

  create() {
    this.loadMap();
    this.createCharacters();
  }

  update(time, delta) {
    this.updateCharacters(time, delta);
  }

  encounterTable() {
    return {
      VIRIDIAN_FOREST: [
        { pokemon: 'caterpie', level: [3, 5], rarity: 0.45 },
        { pokemon: 'metapod', level: [4, 6], rarity: 0.1 },
        { pokemon: 'weedle', level: [3, 5], rarity: 0.45 },
        { pokemon: 'kakuna', level: [4, 6], rarity: 0.1 },
        { pokemon: 'pidgey', level: [3, 5], rarity: 0.24 },
        { pokemon: 'pidgeotto', level: [9], rarity: 0.01 },
        { pokemon: 'pikachu', level: [3, 5], rarity: 0.1 },
      ],
    };
  }
}
