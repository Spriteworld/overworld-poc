import OverworldUI    from './misc/OverworldUI.js';
import TimeOverlay    from './misc/TimeOverlay.js';
import Preload        from './misc/Preload.js';
import NintendoLogo   from './misc/NintendoLogo.js';
import CopyrightScene from './misc/CopyrightScene.js';
import TitleScreen    from './misc/TitleScreen.js';

// import BattleUI from './misc/BattleUI.js';
// import BattleScene from './misc/BattleScene.js';

import Spriteworld from '@Scenes/maps/spriteworld/Spriteworld.js';

import Test from '@Scenes/maps/random/Test.js';
import Skyland from '@Scenes/maps/random/Skyland.js';
import Base from '@Scenes/maps/random/Base.js';
import SpriteViewer from '@Scenes/maps/random/SpriteViewer.js';
import Forest from '@Scenes/maps/random/Forest.js';
import VermillionGym from '@Scenes/maps/random/VermillionGym.js';
import TurffieldGym from '@Scenes/maps/random/TurffieldGym.js';
import DarknessTest from '@Scenes/maps/random/DarknessTest.js';
import WaterFxCompare from '@Scenes/maps/random/WaterFxCompare.js';
import WeatherMap from '@Scenes/maps/random/WeatherMap.js';

import Kanto from '@Scenes/maps/kanto/Kanto.js';
import KantoWorld from '@Scenes/maps/kanto/KantoWorld.js';
import KantoPalletTown from '@Scenes/maps/kanto/KantoPalletTown.js';
import KantoHeroHouseF1 from '@Scenes/maps/kanto/KantoHeroHouseF1.js';
import KantoHeroHouseF2 from '@Scenes/maps/kanto/KantoHeroHouseF2.js';
import KantoRoute1 from '@Scenes/maps/kanto/KantoRoute1.js';
import KantoRoute21 from '@Scenes/maps/kanto/KantoRoute21.js';
import KantoRoute22 from '@Scenes/maps/kanto/KantoRoute22.js';
import KantoProfessorLab from '@Scenes/maps/kanto/KantoProfessorLab.js';
import KantoViridianCity from '@Scenes/maps/kanto/KantoViridianCity.js';
import KantoRoute2 from '@Scenes/maps/kanto/KantoRoute2.js';
import KantoPewterCity from '@Scenes/maps/kanto/KantoPewterCity.js';
import KantoRoute3 from '@Scenes/maps/kanto/KantoRoute3.js';
import KantoRoute4 from '@Scenes/maps/kanto/KantoRoute4.js';
import KantoCeruleanCity from '@Scenes/maps/kanto/KantoCeruleanCity.js';
import KantoRoute24 from '@Scenes/maps/kanto/KantoRoute24.js';
import KantoRoute25 from '@Scenes/maps/kanto/KantoRoute25.js';
import KantoRoute5 from '@Scenes/maps/kanto/KantoRoute5.js';
import KantoSaffronCity from '@Scenes/maps/kanto/KantoSaffronCity.js';
import KantoRoute6 from '@Scenes/maps/kanto/KantoRoute6.js';
import KantoVermillionCity from '@Scenes/maps/kanto/KantoVermillionCity.js';
import KantoRoute8 from '@Scenes/maps/kanto/KantoRoute8.js';
import KantoLavenderTown from '@Scenes/maps/kanto/KantoLavenderTown.js';
import KantoRoute9 from '@Scenes/maps/kanto/KantoRoute9.js';
import KantoRoute11 from '@Scenes/maps/kanto/KantoRoute11.js';
import KantoRoute12 from '@Scenes/maps/kanto/KantoRoute12.js';
import KantoRoute13 from '@Scenes/maps/kanto/KantoRoute13.js';
import KantoRoute14 from '@Scenes/maps/kanto/KantoRoute14.js';
import KantoRoute15 from '@Scenes/maps/kanto/KantoRoute15.js';
import KantoRoute7 from '@Scenes/maps/kanto/KantoRoute7.js';
import KantoCeladonCity from '@Scenes/maps/kanto/KantoCeladonCity.js';
import KantoRoute16 from '@Scenes/maps/kanto/KantoRoute16.js';
import KantoRoute17 from '@Scenes/maps/kanto/KantoRoute17.js';
import KantoRoute18 from '@Scenes/maps/kanto/KantoRoute18.js';
import KantoFuchsiaCity from '@Scenes/maps/kanto/KantoFuchsiaCity.js';
import KantoRoute19 from '@Scenes/maps/kanto/KantoRoute19.js';
import KantoRoute20 from '@Scenes/maps/kanto/KantoRoute20.js';
import KantoCinnabarIsland from '@Scenes/maps/kanto/KantoCinnabarIsland.js';
import KantoRoute23 from '@Scenes/maps/kanto/KantoRoute23.js';
import KantoViridianForest from '@Scenes/maps/kanto/KantoViridianForest.js';
import KantoPokemonCenter from '@Scenes/maps/kanto/KantoPokemonCenter.js';
import KantoMtMoonF1 from '@Scenes/maps/kanto/KantoMtMoonF1.js';
import KantoRivalHouse from '@Scenes/maps/kanto/KantoRivalHouse.js';
import KantoMtMoonBF1A from '@Scenes/maps/kanto/KantoMtMoonBF1A.js';
import KantoMtMoonBF1B from '@Scenes/maps/kanto/KantoMtMoonBF1B.js';
import KantoMtMoonBF1C from '@Scenes/maps/kanto/KantoMtMoonBF1C.js';
import KantoPokeMart from '@Scenes/maps/kanto/KantoPokeMart.js';
import KantoViridianCityHouse from '@Scenes/maps/kanto/KantoViridianCityHouse.js';
import KantoPewterGym from '@Scenes/maps/kanto/KantoPewterGym.js';
import KantoCeruleanGym from '@Scenes/maps/kanto/KantoCeruleanGym.js';
import KantoVermilionGym from '@Scenes/maps/kanto/KantoVermilionGym.js';
import KantoCeladonGym from '@Scenes/maps/kanto/KantoCeladonGym.js';
import KantoFushsiaGym from '@Scenes/maps/kanto/KantoFushsiaGym.js';
import KantoSaffronGym from '@Scenes/maps/kanto/KantoSaffronGym.js';
import KantoCinnabarGym from '@Scenes/maps/kanto/KantoCinnabarGym.js';
import KantoViridianGym from '@Scenes/maps/kanto/KantoViridianGym.js';

import GavWorld from '@Scenes/maps/Gavworld/Gavworld.js';
import GavworldStarterTown from '@Scenes/maps/Gavworld/GavworldStarterTown.js';
import GavworldRoute1 from '@Scenes/maps/Gavworld/GavworldRoute1.js';
import GavworldHeroHouseF1 from '@Scenes/maps/Gavworld/GavworldHeroHouseF1.js';
import GavworldHeroHouseF2 from '@Scenes/maps/Gavworld/GavworldHeroHouseF2.js';
import GavworldProfessorLab from '@Scenes/maps/Gavworld/GavworldProfessorLab.js';
import GavworldPokemonCenter from '@Scenes/maps/Gavworld/GavworldPokemonCenter.js';
import GavworldViridianForest from '@Scenes/maps/Gavworld/GavworldViridianForest.js';
import GavworldMeadowTown from '@Scenes/maps/Gavworld/GavworldMeadowTown.js';

export default {
  OverworldUI, TimeOverlay, Preload, NintendoLogo, CopyrightScene, TitleScreen,

  Spriteworld,

  Test,
  Skyland,
  Base,
  SpriteViewer,
  Forest,
  VermillionGym,
  TurffieldGym,
  DarknessTest,
  WaterFxCompare,
  WeatherMap,

  Kanto,
  KantoWorld,
  KantoPalletTown,
  KantoHeroHouseF1,
  KantoHeroHouseF2,
  KantoRoute1,
  KantoRoute21,
  KantoRoute22,
  KantoProfessorLab,
  KantoViridianCity,
  KantoRoute2,
  KantoPewterCity,
  KantoRoute3,
  KantoRoute4,
  KantoCeruleanCity,
  KantoRoute24,
  KantoRoute25,
  KantoRoute5,
  KantoSaffronCity,
  KantoRoute6,
  KantoVermillionCity,
  KantoRoute8,
  KantoLavenderTown,
  KantoRoute9,
  KantoRoute11,
  KantoRoute12,
  KantoRoute13,
  KantoRoute14,
  KantoRoute15,
  KantoRoute7,
  KantoCeladonCity,
  KantoRoute16,
  KantoRoute17,
  KantoRoute18,
  KantoFuchsiaCity,
  KantoRoute19,
  KantoRoute20,
  KantoCinnabarIsland,
  KantoRoute23,
  KantoViridianForest,
  KantoPokemonCenter,
  KantoMtMoonF1,
  KantoRivalHouse,
  KantoMtMoonBF1A,
  KantoMtMoonBF1B,
  KantoMtMoonBF1C,
  KantoPokeMart,
  GavWorld,
  GavworldStarterTown,
  GavworldRoute1,
  GavworldHeroHouseF1,
  GavworldHeroHouseF2,
  GavworldProfessorLab,
  GavworldPokemonCenter,
  GavworldViridianForest,
  GavworldMeadowTown,
  KantoViridianCityHouse,
  KantoPewterGym,
  KantoCeruleanGym,
  KantoVermilionGym,
  KantoCeladonGym,
  KantoFushsiaGym,
  KantoSaffronGym,
  KantoCinnabarGym,
  KantoViridianGym,
};
