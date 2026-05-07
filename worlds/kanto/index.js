import { registerWorld } from '@/worlds/registry.js';

// Maps
import KantoPalletTownMap from './maps/pallet.json';
import KantoHeroHouseF1Map from './maps/hero_house_floor1.json';
import KantoHeroHouseF2Map from './maps/hero_house_floor2.json';
import KantoProfessorLabMap from './maps/prof_lab.json';
import KantoRoute1Map from './maps/route1.json';
import KantoRoute21Map from './maps/route21.json';
import KantoViridianCityMap from './maps/viridian_city.json';
import KantoRoute22Map from './maps/route22.json';
import KantoRoute2Map from './maps/route2.json';
import KantoPewterCityMap from './maps/pewter_city.json';
import KantoRoute3Map from './maps/route3.json';
import KantoRoute4Map from './maps/route4.json';
import KantoCeruleanCityMap from './maps/cerulean_city.json';
import KantoRoute5Map from './maps/route5.json';
import KantoSaffronCityMap from './maps/saffron_city.json';
import KantoRoute6Map from './maps/route6.json';
import KantoVermillionCityMap from './maps/vermillion_city.json';
import KantoRoute7Map from './maps/route7.json';
import KantoRoute8Map from './maps/route8.json';
import KantoRoute9Map from './maps/route9.json';
import KantoCeladonCityMap from './maps/celadon_city.json';
import KantoRoute11Map from './maps/route11.json';
import KantoRoute12Map from './maps/route12.json';
import KantoRoute13Map from './maps/route13.json';
import KantoRoute14Map from './maps/route14.json';
import KantoRoute15Map from './maps/route15.json';
import KantoRoute16Map from './maps/route16.json';
import KantoRoute17Map from './maps/route17.json';
import KantoRoute18Map from './maps/route18.json';
import KantoFuchsiaCityMap from './maps/fuchsia_city.json';
import KantoRoute19Map from './maps/route19.json';
import KantoRoute20Map from './maps/route20.json';
import KantoCinnabarIslandMap from './maps/cinnabar_island.json';
import KantoLavenderTownMap from './maps/lavender_town.json';
import KantoRoute23Map from './maps/route23.json';
import KantoRoute24Map from './maps/route24.json';
import KantoRoute25Map from './maps/route25.json';
import KantoViridianForestMap from './maps/viridian_forest.json';
import KantoPokemonCenterMap from './maps/pokemon_center.json';
import KantoMtMoonF1Map from './maps/mt_moon_floor1.json';
import KantoRivalHouseMap from './maps/rival_house.json';
import KantoMtMoonBF1AMap from './maps/mt_moon_bf1_a.json';
import KantoMtMoonBF1BMap from './maps/mt_moon_bf1_b.json';
import KantoMtMoonBF1CMap from './maps/mt_moon_bf1_c.json';
import KantoPokeMartMap from './maps/poke_mart.json';
import KantoViridianCityHouseMap from './maps/viridian_city_house.json';
import KantoPewterGymMap from './maps/pewter_gym.json';
import KantoCeruleanGymMap from './maps/cerulean_gym.json';
import KantoVermilionGymMap from './maps/vermilion_gym.json';
import KantoCeladonGymMap from './maps/celadon_gym.json';
import KantoFushsiaGymMap from './maps/fushsia_gym.json';
import KantoSaffronGymMap from './maps/saffron_gym.json';
import KantoCinnabarGymMap from './maps/cinnabar_gym.json';
import KantoViridianGymMap from './maps/viridian_gym.json';
import KantoRoute10Map from './maps/route10.json';
import kantoWorldRaw from './maps/kanto.world?raw';

// Tilesets
import kanto_outside from './tilesets/kanto_outside.png';
import kanto_outside_json from './tilesets/kanto_outside.json';
import kanto_inside from './tilesets/kanto_inside.png';
import kanto_inside_json from './tilesets/kanto_inside.json';
import kanto_dungeons from './tilesets/kanto_dungeons.png';
import kanto_dungeons_json from './tilesets/kanto_dungeons.json';

// Scenes
import KantoCeladonCity from './scenes/KantoCeladonCity.js';
import KantoCeladonGym from './scenes/KantoCeladonGym.js';
import KantoCeruleanCity from './scenes/KantoCeruleanCity.js';
import KantoCeruleanGym from './scenes/KantoCeruleanGym.js';
import KantoCinnabarGym from './scenes/KantoCinnabarGym.js';
import KantoCinnabarIsland from './scenes/KantoCinnabarIsland.js';
import KantoFuchsiaCity from './scenes/KantoFuchsiaCity.js';
import KantoFushsiaGym from './scenes/KantoFushsiaGym.js';
import KantoHeroHouseF1 from './scenes/KantoHeroHouseF1.js';
import KantoHeroHouseF2 from './scenes/KantoHeroHouseF2.js';
import KantoLavenderTown from './scenes/KantoLavenderTown.js';
import KantoMtMoonBF1A from './scenes/KantoMtMoonBF1A.js';
import KantoMtMoonBF1B from './scenes/KantoMtMoonBF1B.js';
import KantoMtMoonBF1C from './scenes/KantoMtMoonBF1C.js';
import KantoMtMoonF1 from './scenes/KantoMtMoonF1.js';
import KantoPalletTown from './scenes/KantoPalletTown.js';
import KantoPewterCity from './scenes/KantoPewterCity.js';
import KantoPewterGym from './scenes/KantoPewterGym.js';
import KantoPokeMart from './scenes/KantoPokeMart.js';
import KantoPokemonCenter from './scenes/KantoPokemonCenter.js';
import KantoProfessorLab from './scenes/KantoProfessorLab.js';
import KantoRivalHouse from './scenes/KantoRivalHouse.js';
import KantoRoute1 from './scenes/KantoRoute1.js';
import KantoRoute11 from './scenes/KantoRoute11.js';
import KantoRoute12 from './scenes/KantoRoute12.js';
import KantoRoute13 from './scenes/KantoRoute13.js';
import KantoRoute14 from './scenes/KantoRoute14.js';
import KantoRoute15 from './scenes/KantoRoute15.js';
import KantoRoute16 from './scenes/KantoRoute16.js';
import KantoRoute17 from './scenes/KantoRoute17.js';
import KantoRoute18 from './scenes/KantoRoute18.js';
import KantoRoute19 from './scenes/KantoRoute19.js';
import KantoRoute2 from './scenes/KantoRoute2.js';
import KantoRoute20 from './scenes/KantoRoute20.js';
import KantoRoute21 from './scenes/KantoRoute21.js';
import KantoRoute22 from './scenes/KantoRoute22.js';
import KantoRoute23 from './scenes/KantoRoute23.js';
import KantoRoute24 from './scenes/KantoRoute24.js';
import KantoRoute25 from './scenes/KantoRoute25.js';
import KantoRoute3 from './scenes/KantoRoute3.js';
import KantoRoute4 from './scenes/KantoRoute4.js';
import KantoRoute5 from './scenes/KantoRoute5.js';
import KantoRoute6 from './scenes/KantoRoute6.js';
import KantoRoute7 from './scenes/KantoRoute7.js';
import KantoRoute8 from './scenes/KantoRoute8.js';
import KantoRoute9 from './scenes/KantoRoute9.js';
import KantoSaffronCity from './scenes/KantoSaffronCity.js';
import KantoSaffronGym from './scenes/KantoSaffronGym.js';
import KantoVermilionGym from './scenes/KantoVermilionGym.js';
import KantoVermillionCity from './scenes/KantoVermillionCity.js';
import KantoViridianCity from './scenes/KantoViridianCity.js';
import KantoViridianCityHouse from './scenes/KantoViridianCityHouse.js';
import KantoViridianForest from './scenes/KantoViridianForest.js';
import KantoViridianGym from './scenes/KantoViridianGym.js';
import KantoRoute10 from './scenes/KantoRoute10.js';
import KantoWorld from './scenes/KantoWorld.js';

// GameDef
import gameDef from './gameDef.js';

registerWorld({
  maps: {
    'KantoPalletTown': KantoPalletTownMap,
    'KantoHeroHouseF1': KantoHeroHouseF1Map,
    'KantoHeroHouseF2': KantoHeroHouseF2Map,
    'KantoProfessorLab': KantoProfessorLabMap,
    'KantoRoute1': KantoRoute1Map,
    'KantoRoute21': KantoRoute21Map,
    'KantoRoute22': KantoRoute22Map,
    'KantoViridianCity': KantoViridianCityMap,
    'KantoRoute2': KantoRoute2Map,
    'KantoPewterCity': KantoPewterCityMap,
    'KantoRoute3': KantoRoute3Map,
    'KantoRoute4': KantoRoute4Map,
    'KantoCeruleanCity': KantoCeruleanCityMap,
    'KantoRoute5': KantoRoute5Map,
    'KantoSaffronCity': KantoSaffronCityMap,
    'KantoRoute6': KantoRoute6Map,
    'KantoVermillionCity': KantoVermillionCityMap,
    'KantoRoute7': KantoRoute7Map,
    'KantoRoute8': KantoRoute8Map,
    'KantoRoute9': KantoRoute9Map,
    'KantoCeladonCity': KantoCeladonCityMap,
    'KantoRoute11': KantoRoute11Map,
    'KantoRoute12': KantoRoute12Map,
    'KantoRoute13': KantoRoute13Map,
    'KantoRoute14': KantoRoute14Map,
    'KantoRoute15': KantoRoute15Map,
    'KantoRoute16': KantoRoute16Map,
    'KantoRoute17': KantoRoute17Map,
    'KantoRoute18': KantoRoute18Map,
    'KantoFuchsiaCity': KantoFuchsiaCityMap,
    'KantoRoute19': KantoRoute19Map,
    'KantoRoute20': KantoRoute20Map,
    'KantoCinnabarIsland': KantoCinnabarIslandMap,
    'KantoLavenderTown': KantoLavenderTownMap,
    'KantoRoute23': KantoRoute23Map,
    'KantoRoute24': KantoRoute24Map,
    'KantoRoute25': KantoRoute25Map,
    'KantoViridianForest': KantoViridianForestMap,
    'KantoPokemonCenter': KantoPokemonCenterMap,
    'KantoMtMoonF1': KantoMtMoonF1Map,
    'KantoRivalHouse': KantoRivalHouseMap,
    'KantoMtMoonBF1A': KantoMtMoonBF1AMap,
    'KantoMtMoonBF1B': KantoMtMoonBF1BMap,
    'KantoMtMoonBF1C': KantoMtMoonBF1CMap,
    'KantoPokeMart': KantoPokeMartMap,
    'KantoViridianCityHouse': KantoViridianCityHouseMap,
    'KantoPewterGym': KantoPewterGymMap,
    'KantoCeruleanGym': KantoCeruleanGymMap,
    'KantoVermilionGym': KantoVermilionGymMap,
    'KantoCeladonGym': KantoCeladonGymMap,
    'KantoFushsiaGym': KantoFushsiaGymMap,
    'KantoSaffronGym': KantoSaffronGymMap,
    'KantoCinnabarGym': KantoCinnabarGymMap,
    'KantoViridianGym': KantoViridianGymMap,
    'KantoRoute10': KantoRoute10Map,
  },
  tilesets: {
    'kanto_outside': { url: kanto_outside, json: kanto_outside_json },
    'kanto_inside':  { url: kanto_inside,  json: kanto_inside_json },
    'kanto_dungeons': { url: kanto_dungeons, json: kanto_dungeons_json },
  },
  worldMapKeys: {
    'pallet.json': 'KantoPalletTown',
    'route1.json': 'KantoRoute1',
    'viridian_city.json': 'KantoViridianCity',
    'route21.json': 'KantoRoute21',
    'route22.json': 'KantoRoute22',
    'route2.json': 'KantoRoute2',
    'pewter_city.json': 'KantoPewterCity',
    'route3.json': 'KantoRoute3',
    'route4.json': 'KantoRoute4',
    'cerulean_city.json': 'KantoCeruleanCity',
    'route5.json': 'KantoRoute5',
    'saffron_city.json': 'KantoSaffronCity',
    'route6.json': 'KantoRoute6',
    'vermillion_city.json': 'KantoVermillionCity',
    'route7.json': 'KantoRoute7',
    'route8.json': 'KantoRoute8',
    'route9.json': 'KantoRoute9',
    'celadon_city.json': 'KantoCeladonCity',
    'route11.json': 'KantoRoute11',
    'route12.json': 'KantoRoute12',
    'route13.json': 'KantoRoute13',
    'route14.json': 'KantoRoute14',
    'route15.json': 'KantoRoute15',
    'route16.json': 'KantoRoute16',
    'route17.json': 'KantoRoute17',
    'route18.json': 'KantoRoute18',
    'fuchsia_city.json': 'KantoFuchsiaCity',
    'route19.json': 'KantoRoute19',
    'route20.json': 'KantoRoute20',
    'cinnabar_island.json': 'KantoCinnabarIsland',
    'lavender_town.json': 'KantoLavenderTown',
    'route23.json': 'KantoRoute23',
    'route24.json': 'KantoRoute24',
    'route25.json': 'KantoRoute25',
    'route10.json':        'KantoRoute10',
  },
  worldFile: JSON.parse(kantoWorldRaw),
  insideMapSceneKeys: [
    'KantoHeroHouseF1',
    'KantoHeroHouseF2',
    'KantoProfessorLab',
    'KantoViridianForest',
    'KantoPewterGym',
    'KantoCeruleanGym',
    'KantoVermilionGym',
    'KantoCeladonGym',
    'KantoFushsiaGym',
    'KantoSaffronGym',
    'KantoCinnabarGym',
    'KantoViridianGym',
  ],
  scenes: {
    KantoCeladonCity,
    KantoCeladonGym,
    KantoCeruleanCity,
    KantoCeruleanGym,
    KantoCinnabarGym,
    KantoCinnabarIsland,
    KantoFuchsiaCity,
    KantoFushsiaGym,
    KantoHeroHouseF1,
    KantoHeroHouseF2,
    KantoLavenderTown,
    KantoMtMoonBF1A,
    KantoMtMoonBF1B,
    KantoMtMoonBF1C,
    KantoMtMoonF1,
    KantoPalletTown,
    KantoPewterCity,
    KantoPewterGym,
    KantoPokeMart,
    KantoPokemonCenter,
    KantoProfessorLab,
    KantoRivalHouse,
    KantoRoute1,
    KantoRoute11,
    KantoRoute12,
    KantoRoute13,
    KantoRoute14,
    KantoRoute15,
    KantoRoute16,
    KantoRoute17,
    KantoRoute18,
    KantoRoute19,
    KantoRoute2,
    KantoRoute20,
    KantoRoute21,
    KantoRoute22,
    KantoRoute23,
    KantoRoute24,
    KantoRoute25,
    KantoRoute3,
    KantoRoute4,
    KantoRoute5,
    KantoRoute6,
    KantoRoute7,
    KantoRoute8,
    KantoRoute9,
    KantoRoute10,
    KantoSaffronCity,
    KantoSaffronGym,
    KantoVermilionGym,
    KantoVermillionCity,
    KantoViridianCity,
    KantoViridianCityHouse,
    KantoViridianForest,
    KantoViridianGym,
    KantoWorld,
  },
  gameDef,
});
