import TestMap from './random/test.json';
import SkylandMap from './random/skyland.json';
import BaseMap from './random/base.json';
import SpriteViewerMap from './random/sprite_viewer.json';

import SpriteworldMap from './spriteworld/spriteworld.json';
import ForestMap from './random/forest.json';
import VermillionGymMap from './random/vermillion_gym.json';
import TurffieldGymMap from './random/turffield_gym.json';
import DarknessTestMap from './random/darkness_test.json';

import KantoMap from './kanto/kanto.json';
import KantoPalletTownMap from './kanto/pallet.json';
import KantoHeroHouseF1Map from './kanto/hero_house_floor1.json';
import KantoHeroHouseF2Map from './kanto/hero_house_floor2.json';
import KantoProfessorLabMap from './kanto/prof_lab.json';
import KantoRoute1Map from './kanto/route1.json';
import KantoRoute21Map from './kanto/route21.json';
import KantoViridianCityMap from './kanto/viridian_city.json';
import KantoRoute22Map from './kanto/route22.json';
import KantoRoute2Map from './kanto/route2.json';
import KantoPewterCityMap from './kanto/pewter_city.json';
import KantoRoute3Map from './kanto/route3.json';
import KantoRoute4Map from './kanto/route4.json';
import KantoCeruleanCityMap from './kanto/cerulean_city.json';
import KantoRoute5Map from './kanto/route5.json';
import KantoSaffronCityMap from './kanto/saffron_city.json';
import KantoRoute6Map from './kanto/route6.json';
import KantoVermillionCityMap from './kanto/vermillion_city.json';
import KantoRoute7Map from './kanto/route7.json';
import KantoRoute8Map from './kanto/route8.json';
import KantoRoute9Map from './kanto/route9.json';
import KantoCeladonCityMap from './kanto/celadon_city.json';
import KantoRoute11Map from './kanto/route11.json';
import KantoRoute12Map from './kanto/route12.json';
import KantoRoute13Map from './kanto/route13.json';
import KantoRoute14Map from './kanto/route14.json';
import KantoRoute15Map from './kanto/route15.json';
import KantoRoute16Map from './kanto/route16.json';
import KantoRoute17Map from './kanto/route17.json';
import KantoRoute18Map from './kanto/route18.json';
import KantoFuchsiaCityMap from './kanto/fuchsia_city.json';
import KantoRoute19Map from './kanto/route19.json';
import KantoRoute20Map from './kanto/route20.json';
import KantoCinnabarIslandMap from './kanto/cinnabar_island.json';
import KantoLavenderTownMap from './kanto/lavender_town.json';
import KantoRoute23Map from './kanto/route23.json';
import KantoRoute24Map from './kanto/route24.json';
import KantoRoute25Map from './kanto/route25.json';
import KantoViridianForestMap from './kanto/viridian_forest.json';
import KantoPokemonCenterMap from './kanto/pokemon_center.json';
import KantoMtMoonF1Map from './kanto/mt_moon_floor1.json';
import KantoRivalHouseMap from './kanto/rival_house.json';
import KantoMtMoonBF1AMap from './kanto/mt_moon_bf1_a.json';
import KantoMtMoonBF1BMap from './kanto/mt_moon_bf1_b.json';
import KantoMtMoonBF1CMap from './kanto/mt_moon_bf1_c.json';
import KantoPokeMartMap from './kanto/poke_mart.json';
import KantoViridianCityHouseMap from './kanto/viridian_city_house.json';

import GavWorldMap from './Gavworld/Gavworld.json';
import GavworldStarterTownMap from './Gavworld/starter_town.json';
import GavworldRoute1Map from './Gavworld/route1.json';
import GavworldHeroHouseF1Map from './Gavworld/hero_house_floor1.json';
import GavworldHeroHouseF2Map from './Gavworld/hero_house_floor2.json';
import GavworldProfessorLabMap from './Gavworld/prof_lab.json';
import GavworldPokemonCenterMap from './Gavworld/pokemon_center.json';
import GavworldViridianForestMap from './Gavworld/viridian_forest.json';
import GavworldMeadowTownMap from './Gavworld/meadow_town.json';


// import StarterTownMap from './region/StarterTown.json';

import kantoWorldRaw from './kanto/kanto.world?raw';

/** The kanto .world file — absolute pixel positions of every outdoor map. */
export const WORLD_FILE = JSON.parse(kantoWorldRaw);

/**
 * Maps world-file .json filename → Phaser scene key for every outdoor map
 * included in the kanto world. Add entries here when a new map joins the world.
 */
export const WORLD_MAP_KEYS = {
  'pallet.json':        'KantoPalletTown',
  'route1.json':        'KantoRoute1',
  'viridian_city.json': 'KantoViridianCity',
  'route21.json':       'KantoRoute21',
  'route22.json':       'KantoRoute22',
  'route2.json':        'KantoRoute2',
  'pewter_city.json':   'KantoPewterCity',
  'route3.json':        'KantoRoute3',
  'route4.json':         'KantoRoute4',
  'cerulean_city.json':  'KantoCeruleanCity',
  'route5.json':         'KantoRoute5',
  'saffron_city.json':   'KantoSaffronCity',
  'route6.json':         'KantoRoute6',
  'vermillion_city.json': 'KantoVermillionCity',
  'route7.json':         'KantoRoute7',
  'route8.json':         'KantoRoute8',
  'route9.json':         'KantoRoute9',
  'celadon_city.json':   'KantoCeladonCity',
  'route11.json':        'KantoRoute11',
  'route12.json':        'KantoRoute12',
  'route13.json':        'KantoRoute13',
  'route14.json':        'KantoRoute14',
  'route15.json':        'KantoRoute15',
  'route16.json':        'KantoRoute16',
  'route17.json':        'KantoRoute17',
  'route18.json':        'KantoRoute18',
  'fuchsia_city.json':   'KantoFuchsiaCity',
  'route19.json':        'KantoRoute19',
  'route20.json':        'KantoRoute20',
  'cinnabar_island.json': 'KantoCinnabarIsland',
  'lavender_town.json':  'KantoLavenderTown',
  'route23.json':        'KantoRoute23',
  'route24.json':        'KantoRoute24',
  'route25.json':        'KantoRoute25',
  'starter_town.json':   'GavworldStarterTown',
  'meadow_town.json':    'GavworldMeadowTown',
};

export {
    TestMap,SkylandMap,BaseMap,SpriteViewerMap,ForestMap,DarknessTestMap,
    SpriteworldMap,
    VermillionGymMap, TurffieldGymMap,

    // kanto
    KantoMap,
    KantoPalletTownMap,
    KantoHeroHouseF1Map, KantoHeroHouseF2Map,
    KantoProfessorLabMap,
    KantoRoute1Map,
    KantoRoute21Map,
    KantoViridianCityMap,
    KantoRoute22Map,
    KantoRoute2Map,
    KantoPewterCityMap,
    KantoRoute3Map,
    KantoRoute4Map,
    KantoCeruleanCityMap,
    KantoRoute5Map, KantoSaffronCityMap, KantoRoute6Map, 
    KantoRoute7Map, KantoRoute8Map, KantoRoute9Map,
    KantoCeladonCityMap,
    KantoRoute11Map, KantoRoute12Map, KantoRoute13Map, KantoRoute14Map, KantoRoute15Map,
    KantoRoute16Map, KantoRoute17Map, KantoRoute18Map,
    KantoFuchsiaCityMap,
    KantoVermillionCityMap,
    KantoPokemonCenterMap,
    KantoMtMoonF1Map,
    KantoRivalHouseMap,
    KantoMtMoonBF1AMap,
    KantoMtMoonBF1BMap,
    KantoMtMoonBF1CMap,
    KantoPokeMartMap,
    KantoRoute19Map, KantoRoute20Map,
    KantoCinnabarIslandMap, KantoLavenderTownMap, KantoRoute23Map,
    KantoRoute24Map, KantoRoute25Map, KantoViridianForestMap,

    // GavWorld
    GavWorldMap,
    GavworldStarterTownMap,
    GavworldRoute1Map,
    GavworldHeroHouseF1Map,
    GavworldHeroHouseF2Map,
    GavworldProfessorLabMap,
    GavworldPokemonCenterMap,
    GavworldViridianForestMap,
    GavworldMeadowTownMap,
    KantoViridianCityHouseMap,
};

/** Scene keys for kanto inside / non-world maps, shown in the debug warp list. */
export const INSIDE_MAP_SCENE_KEYS = [
  'HeroHouseF1',
  'HeroHouseF2',
  'ProfessorLab',
  'ViridianForest',
];

export const MAP_REGISTRY = {
  'Spriteworld':  SpriteworldMap,
  'Kanto':        KantoMap,
  'KantoPalletTown':   KantoPalletTownMap,
  'KantoHeroHouseF1':  KantoHeroHouseF1Map,
  'KantoHeroHouseF2':  KantoHeroHouseF2Map,
  'KantoProfessorLab': KantoProfessorLabMap,
  'KantoRoute1':       KantoRoute1Map,
  'KantoRoute21':      KantoRoute21Map,
  'KantoRoute22':      KantoRoute22Map,
  'KantoViridianCity': KantoViridianCityMap,
  'KantoRoute2':       KantoRoute2Map,
  'KantoPewterCity':   KantoPewterCityMap,
  'KantoRoute3':       KantoRoute3Map,
  'KantoRoute4':      KantoRoute4Map,
  'KantoCeruleanCity':    KantoCeruleanCityMap,
  'KantoRoute5':          KantoRoute5Map,
  'KantoSaffronCity':     KantoSaffronCityMap,
  'KantoRoute6':          KantoRoute6Map,
  'KantoVermillionCity':  KantoVermillionCityMap,
  'KantoRoute7':          KantoRoute7Map,
  'KantoRoute8':          KantoRoute8Map,
  'KantoRoute9':          KantoRoute9Map,
  'KantoCeladonCity':     KantoCeladonCityMap,
  'KantoRoute11':         KantoRoute11Map,
  'KantoRoute12':         KantoRoute12Map,
  'KantoRoute13':         KantoRoute13Map,
  'KantoRoute14':         KantoRoute14Map,
  'KantoRoute15':         KantoRoute15Map,
  'KantoRoute16':         KantoRoute16Map,
  'KantoRoute17':         KantoRoute17Map,
  'KantoRoute18':         KantoRoute18Map,
  'KantoFuchsiaCity':     KantoFuchsiaCityMap,
  'KantoRoute19':         KantoRoute19Map,
  'KantoRoute20':         KantoRoute20Map,
  'KantoCinnabarIsland':  KantoCinnabarIslandMap,
  'KantoLavenderTown':    KantoLavenderTownMap,
  'KantoRoute23':         KantoRoute23Map,
  'KantoRoute24':         KantoRoute24Map,
  'KantoRoute25':         KantoRoute25Map,
  'KantoViridianForest':  KantoViridianForestMap,
  'KantoPokemonCenter': KantoPokemonCenterMap,
  'KantoMtMoonF1':    KantoMtMoonF1Map,
  'KantoRivalHouse':  KantoRivalHouseMap,
  'KantoMtMoonBF1A':  KantoMtMoonBF1AMap,
  'KantoMtMoonBF1B':  KantoMtMoonBF1BMap,
  'KantoMtMoonBF1C':  KantoMtMoonBF1CMap,
  'KantoPokeMart':    KantoPokeMartMap,
  'GavworldStarterTown': GavworldStarterTownMap,
  'GavworldRoute1': GavworldRoute1Map,
  'GavworldHeroHouseF1': GavworldHeroHouseF1Map,
  'GavworldHeroHouseF2': GavworldHeroHouseF2Map,
  'GavworldProfessorLab': GavworldProfessorLabMap,
  'GavworldPokemonCenter': GavworldPokemonCenterMap,
  'GavworldViridianForest': GavworldViridianForestMap,
  'GavworldMeadowTown': GavworldMeadowTownMap,
  'KantoViridianCityHouse': KantoViridianCityHouseMap,
};
