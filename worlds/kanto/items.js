import { Items, BaseItem } from '@spriteworld/pokemon-data';

class OaksParcel extends BaseItem {
  constructor() {
    super({
      name: "Oak's Parcel",
      category: 'key',
      description: "A parcel to be delivered to Prof. Oak from the Viridian City Pokémon Mart.",
      aliases: ['Oaks Parcel'],
    });
  }
}

const entries = [
  // Medicine — HP
  { id: 1,  cls: Items.Potion },
  { id: 2,  cls: Items.SuperPotion },
  { id: 3,  cls: Items.HyperPotion },
  { id: 4,  cls: Items.MaxPotion },
  { id: 5,  cls: Items.FullRestore },
  { id: 6,  cls: Items.Revive },
  { id: 7,  cls: Items.MaxRevive },
  { id: 8,  cls: Items.FreshWater },
  { id: 9,  cls: Items.SodaPop },
  { id: 10, cls: Items.Lemonade },
  { id: 11, cls: Items.MoomooMilk },

  // Medicine — PP
  { id: 12, cls: Items.Ether },
  { id: 13, cls: Items.MaxEther },
  { id: 14, cls: Items.Elixir },
  { id: 15, cls: Items.MaxElixir },

  // Medicine — status
  { id: 16, cls: Items.Antidote },
  { id: 17, cls: Items.ParlyzHeal },
  { id: 18, cls: Items.BurnHeal },
  { id: 19, cls: Items.IceHeal },
  { id: 20, cls: Items.Awakening },
  { id: 21, cls: Items.FullHeal },

  // Vitamins
  { id: 22, cls: Items.RareCandy },
  { id: 23, cls: Items.HPUp },
  { id: 24, cls: Items.Protein },
  { id: 25, cls: Items.Iron },
  { id: 26, cls: Items.Calcium },
  { id: 27, cls: Items.Zinc },
  { id: 28, cls: Items.Carbos },

  // Balls
  { id: 29, cls: Items.Pokeball },
  { id: 30, cls: Items.GreatBall },
  { id: 31, cls: Items.UltraBall },
  { id: 32, cls: Items.MasterBall },
  { id: 33, cls: Items.NetBall },
  { id: 34, cls: Items.DiveBall },
  { id: 35, cls: Items.NestBall },
  { id: 36, cls: Items.RepeatBall },
  { id: 37, cls: Items.TimerBall },
  { id: 38, cls: Items.LuxuryBall },
  { id: 39, cls: Items.PremierBall },

  // Battle items
  { id: 40, cls: Items.XAttack },
  { id: 41, cls: Items.XDefend },
  { id: 42, cls: Items.XSpeed },
  { id: 43, cls: Items.XSpecial },
  { id: 44, cls: Items.XAccuracy },
  { id: 45, cls: Items.GuardSpec },
  { id: 46, cls: Items.DireHit },
  { id: 47, cls: Items.PokeDoll },
  { id: 48, cls: Items.FluffyTail },

  // Field items
  { id: 49, cls: Items.EscapeRope },
  { id: 50, cls: Items.Repel },
  { id: 51, cls: Items.SuperRepel },
  { id: 52, cls: Items.MaxRepel },

  // Evolution stones
  { id: 53, cls: Items.FireStone },
  { id: 54, cls: Items.WaterStone },
  { id: 55, cls: Items.ThunderStone },
  { id: 56, cls: Items.LeafStone },
  { id: 57, cls: Items.MoonStone },
  { id: 58, cls: Items.SunStone },

  // Region specialties
  { id: 59, cls: Items.BerryJuice },
  { id: 60, cls: Items.RageCandyBar },
  { id: 61, cls: Items.SacredAsh },
  { id: 62, cls: Items.LavaCookie },

  // Key items — Kanto
  { id: 63, cls: Items.Bicycle },
  { id: 64, cls: Items.TownMap },
  { id: 65, cls: Items.VsSeeker },
  { id: 66, cls: Items.OldRod },
  { id: 67, cls: Items.GoodRod },
  { id: 68, cls: Items.SuperRod },
  { id: 69, cls: Items.Itemfinder },
  { id: 70, cls: Items.CoinCase },
  { id: 71, cls: Items.SilphScope },
  { id: 72, cls: Items.PokeFlute },
  { id: 73, cls: Items.SSTicket },
  { id: 74, cls: Items.SecretKey },
  { id: 75, cls: Items.BikeVoucher },
  { id: 76, cls: Items.CardKey },
  { id: 77, cls: Items.LiftKey },
  { id: 78, cls: Items.GoldTeeth },
  { id: 79, cls: Items.HelixFossil },
  { id: 80, cls: Items.DomeFossil },
  { id: 81, cls: Items.OldAmber },
  { id: 82, cls: Items.Tea },
  { id: 83, cls: Items.HM01Cut },
  { id: 84, cls: Items.HM02Fly },
  { id: 85, cls: Items.HM03Surf },
  { id: 86, cls: Items.HM04Strength },
  { id: 87, cls: Items.HM05Flash },
  { id: 88, cls: Items.HM06RockSmash },
  { id: 89, cls: Items.HM07Waterfall },

  // World-only items
  { id: 90, cls: OaksParcel },
];

const items = {};
for (const { id, cls, ...overrides } of entries) {
  const instance = new cls();
  items[id] = { instance, ...overrides };
}

export default {
  items,
  defaultMartItems: [1, 2, 29, 30, 16, 17, 49, 50],
};
