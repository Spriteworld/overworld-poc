import TestMap from './random/test.json';
import SkylandMap from './random/skyland.json';
import BaseMap from './random/base.json';

import SpriteworldMap from './spriteworld/spriteworld.json';
import ForestMap from './random/forest.json';
import VermillionGymMap from './random/vermillion_gym.json';
import TurffieldGymMap from './random/turffield_gym.json';

import KantoMap from './kanto/kanto.json';
import PalletTownMap from './kanto/pallet.json';
import HeroHouseF1Map from './kanto/hero_house_floor1.json';
import HeroHouseF2Map from './kanto/hero_house_floor2.json';
import ProfessorLabMap from './kanto/prof_lab.json';
import Route1Map from './kanto/route1.json';
import Route21Map from './kanto/route21.json';
import ViridianCityMap from './kanto/viridian_city.json';
import Route22Map from './kanto/route22.json';
import Route2Map from './kanto/route2.json';
import PewterCityMap from './kanto/pewter_city.json';
import Route3Map from './kanto/route3.json';
import Route4Map from './kanto/route4.json';
import CeruleanCityMap from './kanto/cerulean_city.json';
import Route5Map from './kanto/route5.json';
import SaffronCityMap from './kanto/saffron_city.json';
import Route6Map from './kanto/route6.json';
import VermillionCityMap from './kanto/vermillion_city.json';
import Route7Map from './kanto/route7.json';
import Route8Map from './kanto/route8.json';
import Route9Map from './kanto/route9.json';
import CeladonCityMap from './kanto/celadon_city.json';
import Route11Map from './kanto/route11.json';
import Route12Map from './kanto/route12.json';
import Route13Map from './kanto/route13.json';
import Route14Map from './kanto/route14.json';
import Route15Map from './kanto/route15.json';
import Route16Map from './kanto/route16.json';
import Route17Map from './kanto/route17.json';
import Route18Map from './kanto/route18.json';
import FuchsiaCityMap from './kanto/fuchsia_city.json';
import Route19Map from './kanto/route19.json';
import Route20Map from './kanto/route20.json';
import CinnabarIslandMap from './kanto/cinnabar_island.json';
import LavenderTownMap from './kanto/lavender_town.json';
import Route23Map from './kanto/route23.json';
import Route24Map from './kanto/route24.json';
import Route25Map from './kanto/route25.json';
import ViridianForestMap from './kanto/viridian_forest.json';

// import StarterTownMap from './region/StarterTown.json';

import kantoWorldRaw from './kanto/kanto.world?raw';

/** The kanto .world file — absolute pixel positions of every outdoor map. */
export const WORLD_FILE = JSON.parse(kantoWorldRaw);

/**
 * Maps world-file .json filename → Phaser scene key for every outdoor map
 * included in the kanto world. Add entries here when a new map joins the world.
 */
export const WORLD_MAP_KEYS = {
  'pallet.json':        'PalletTown',
  'route1.json':        'Route1',
  'viridian_city.json': 'ViridianCity',
  'route21.json':       'Route21',
  'route22.json':       'Route22',
  'route2.json':        'Route2',
  'pewter_city.json':   'PewterCity',
  'route3.json':        'Route3',
  'route4.json':         'Route4',
  'cerulean_city.json':  'CeruleanCity',
  'route5.json':         'Route5',
  'saffron_city.json':   'SaffronCity',
  'route6.json':         'Route6',
  'vermillion_city.json': 'VermillionCity',
  'route7.json':         'Route7',
  'route8.json':         'Route8',
  'route9.json':         'Route9',
  'celadon_city.json':   'CeladonCity',
  'route11.json':        'Route11',
  'route12.json':        'Route12',
  'route13.json':        'Route13',
  'route14.json':        'Route14',
  'route15.json':        'Route15',
  'route16.json':        'Route16',
  'route17.json':        'Route17',
  'route18.json':        'Route18',
  'fuchsia_city.json':   'FuchsiaCity',
  'route19.json':        'Route19',
  'route20.json':        'Route20',
  'cinnabar_island.json': 'CinnabarIsland',
  'lavender_town.json':  'LavenderTown',
  'route23.json':        'Route23',
  'route24.json':        'Route24',
  'route25.json':        'Route25',
};

export {
    TestMap,SkylandMap,BaseMap,ForestMap,
    SpriteworldMap,
    VermillionGymMap, TurffieldGymMap,

    // kanto
    KantoMap,
    PalletTownMap,
    HeroHouseF1Map, HeroHouseF2Map,
    ProfessorLabMap,
    Route1Map,
    Route21Map,
    ViridianCityMap,
    Route22Map,
    Route2Map,
    PewterCityMap,
    Route3Map,
    Route4Map,
    CeruleanCityMap,
    Route5Map, SaffronCityMap, Route6Map, 
    Route7Map, Route8Map, Route9Map,
    CeladonCityMap,
    Route11Map, Route12Map, Route13Map, Route14Map, Route15Map,
    Route16Map, Route17Map, Route18Map,
    FuchsiaCityMap,
    VermillionCityMap,
    Route19Map, Route20Map,
    CinnabarIslandMap, LavenderTownMap, Route23Map,
    Route24Map, Route25Map, ViridianForestMap,

    // region
    // StarterTownMap
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
  'PalletTown':   PalletTownMap,
  'HeroHouseF1':  HeroHouseF1Map,
  'HeroHouseF2':  HeroHouseF2Map,
  'ProfessorLab': ProfessorLabMap,
  'Route1':       Route1Map,
  'Route21':      Route21Map,
  'Route22':      Route22Map,
  'ViridianCity': ViridianCityMap,
  'Route2':       Route2Map,
  'PewterCity':   PewterCityMap,
  'Route3':       Route3Map,
  'Route4':      Route4Map,
  'CeruleanCity':    CeruleanCityMap,
  'Route5':          Route5Map,
  'SaffronCity':     SaffronCityMap,
  'Route6':          Route6Map,
  'VermillionCity':  VermillionCityMap,
  'Route7':          Route7Map,
  'Route8':          Route8Map,
  'Route9':          Route9Map,
  'CeladonCity':     CeladonCityMap,
  'Route11':         Route11Map,
  'Route12':         Route12Map,
  'Route13':         Route13Map,
  'Route14':         Route14Map,
  'Route15':         Route15Map,
  'Route16':         Route16Map,
  'Route17':         Route17Map,
  'Route18':         Route18Map,
  'FuchsiaCity':     FuchsiaCityMap,
  'Route19':         Route19Map,
  'Route20':         Route20Map,
  'CinnabarIsland':  CinnabarIslandMap,
  'LavenderTown':    LavenderTownMap,
  'Route23':         Route23Map,
  'Route24':         Route24Map,
  'Route25':         Route25Map,
  'ViridianForest':  ViridianForestMap,
};
