import { Items } from '@spriteworld/pokemon-data';

function entry(ClassRef, priceOverride) {
  const inst = new ClassRef();
  const price = priceOverride ?? inst.price;
  return [inst.name, { price, description: inst.description }];
}

export const ITEM_REGISTRY = Object.fromEntries([
  // Balls
  entry(Items.Pokeball),
  entry(Items.GreatBall),
  entry(Items.UltraBall),
  entry(Items.NetBall),
  entry(Items.DiveBall),
  entry(Items.NestBall),
  entry(Items.RepeatBall),
  entry(Items.TimerBall),
  entry(Items.LuxuryBall),
  entry(Items.PremierBall),

  // Medicine — HP
  entry(Items.Potion),
  entry(Items.SuperPotion),
  entry(Items.HyperPotion),
  entry(Items.MaxPotion),
  entry(Items.FullRestore),
  entry(Items.Revive),
  entry(Items.MaxRevive),
  entry(Items.FreshWater),
  entry(Items.SodaPop),
  entry(Items.Lemonade),
  entry(Items.MoomooMilk),

  // Medicine — PP
  entry(Items.Ether),
  entry(Items.MaxEther),
  entry(Items.Elixir),
  entry(Items.MaxElixir),

  // Medicine — status
  entry(Items.Antidote),
  entry(Items.ParlyzHeal),
  entry(Items.BurnHeal),
  entry(Items.IceHeal),
  entry(Items.Awakening),
  entry(Items.FullHeal),

  // Vitamins
  entry(Items.RareCandy),
  entry(Items.HPUp),
  entry(Items.Protein),
  entry(Items.Iron),
  entry(Items.Calcium),
  entry(Items.Zinc),
  entry(Items.Carbos),

  // Battle items
  entry(Items.XAttack),
  entry(Items.XDefend),
  entry(Items.XSpeed),
  entry(Items.XSpecial),
  entry(Items.XAccuracy),
  entry(Items.GuardSpec),
  entry(Items.DireHit),
  entry(Items.PokeDoll),
  entry(Items.FluffyTail),

  // Field
  entry(Items.EscapeRope),
  entry(Items.Repel),
  entry(Items.SuperRepel),
  entry(Items.MaxRepel),

  // Evolution stones
  entry(Items.FireStone),
  entry(Items.WaterStone),
  entry(Items.ThunderStone),
  entry(Items.LeafStone),
  entry(Items.MoonStone),
  entry(Items.SunStone),
]);

export function getSellPrice(name) {
  return Math.floor((ITEM_REGISTRY[name]?.price ?? 0) / 2);
}

export const DEFAULT_MART_ITEMS = [
  'Potion', 'Super Potion', 'Poké Ball', 'Great Ball',
  'Antidote', 'Parlyz Heal', 'Escape Rope', 'Repel',
];
