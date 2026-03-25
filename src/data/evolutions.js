/**
 * Evolution chains for Gens 1–3.
 * Format: { [fromNatDexId]: [{ label, target }] }
 *   label:  human-readable condition shown in the UI
 *   target: national dex ID of the evolved form
 *
 * Includes cross-gen evolutions (e.g. babies introduced in Gen 2,
 * or Gen 1 Pokémon that gained new evolutions in later gens).
 */
export const EVOLUTIONS = {

  // ══════════════════════════════════════════════════════════════════════
  //  GEN 1 LINES
  // ══════════════════════════════════════════════════════════════════════

  // Grass starters
  1:   [{ label: 'Lv.16',          target: 2   }],
  2:   [{ label: 'Lv.32',          target: 3   }],
  // Fire starters
  4:   [{ label: 'Lv.16',          target: 5   }],
  5:   [{ label: 'Lv.36',          target: 6   }],
  // Water starters
  7:   [{ label: 'Lv.16',          target: 8   }],
  8:   [{ label: 'Lv.36',          target: 9   }],
  // Bug lines
  10:  [{ label: 'Lv.7',           target: 11  }],
  11:  [{ label: 'Lv.10',          target: 12  }],
  13:  [{ label: 'Lv.7',           target: 14  }],
  14:  [{ label: 'Lv.10',          target: 15  }],
  // Birds
  16:  [{ label: 'Lv.18',          target: 17  }],
  17:  [{ label: 'Lv.36',          target: 18  }],
  // Rodents / snakes
  19:  [{ label: 'Lv.20',          target: 20  }],
  21:  [{ label: 'Lv.20',          target: 22  }],
  23:  [{ label: 'Lv.22',          target: 24  }],
  // Pikachu line (Pichu added in Gen 2, handled below)
  25:  [{ label: 'Thunder Stone',  target: 26  }],
  // Ground/sand
  27:  [{ label: 'Lv.22',          target: 28  }],
  // Nidoran lines
  29:  [{ label: 'Lv.16',          target: 30  }],
  30:  [{ label: 'Moon Stone',     target: 31  }],
  32:  [{ label: 'Lv.16',          target: 33  }],
  33:  [{ label: 'Moon Stone',     target: 34  }],
  // Fairy / normal
  35:  [{ label: 'Moon Stone',     target: 36  }],
  37:  [{ label: 'Fire Stone',     target: 38  }],
  39:  [{ label: 'Moon Stone',     target: 40  }],
  // Poison
  41:  [{ label: 'Lv.22',          target: 42  }],
  // Grass lines
  43:  [{ label: 'Lv.21',          target: 44  }],
  44:  [{ label: 'Leaf Stone',     target: 45  }],
  46:  [{ label: 'Lv.24',          target: 47  }],
  48:  [{ label: 'Lv.31',          target: 49  }],
  // Ground
  50:  [{ label: 'Lv.26',          target: 51  }],
  // Normal
  52:  [{ label: 'Lv.28',          target: 53  }],
  // Water
  54:  [{ label: 'Lv.33',          target: 55  }],
  // Fighting
  56:  [{ label: 'Lv.28',          target: 57  }],
  // Fire
  58:  [{ label: 'Fire Stone',     target: 59  }],
  // Water / Psychic — Poliwhirl gains Politoed in Gen 2
  60:  [{ label: 'Lv.25',          target: 61  }],
  61:  [
    { label: 'Water Stone',       target: 62  },
    { label: 'Trade King\'s Rock', target: 186 },
  ],
  // Psychic
  63:  [{ label: 'Lv.16',          target: 64  }],
  64:  [{ label: 'Trade',          target: 65  }],
  // Fighting
  66:  [{ label: 'Lv.28',          target: 67  }],
  67:  [{ label: 'Trade',          target: 68  }],
  // Grass lines
  69:  [{ label: 'Lv.21',          target: 70  }],
  70:  [{ label: 'Leaf Stone',     target: 71  }],
  // Water
  72:  [{ label: 'Lv.30',          target: 73  }],
  // Rock / Ground
  74:  [{ label: 'Lv.25',          target: 75  }],
  75:  [{ label: 'Trade',          target: 76  }],
  // Fire
  77:  [{ label: 'Lv.40',          target: 78  }],
  // Water / Psychic — Slowpoke gains Slowking in Gen 2
  79:  [
    { label: 'Lv.37',            target: 80  },
    { label: 'Trade King\'s Rock', target: 199 },
  ],
  // Electric
  81:  [{ label: 'Lv.30',          target: 82  }],
  // Flying
  84:  [{ label: 'Lv.31',          target: 85  }],
  // Water
  86:  [{ label: 'Lv.34',          target: 87  }],
  // Poison
  88:  [{ label: 'Lv.38',          target: 89  }],
  // Water
  90:  [{ label: 'Water Stone',    target: 91  }],
  // Ghost
  92:  [{ label: 'Lv.25',          target: 93  }],
  93:  [{ label: 'Trade',          target: 94  }],
  // Rock / Normal
  95:  [{ label: 'Trade',          target: 208 }],
  // Psychic
  96:  [{ label: 'Lv.26',          target: 97  }],
  // Water
  98:  [{ label: 'Lv.28',          target: 99  }],
  // Electric
  100: [{ label: 'Lv.30',          target: 101 }],
  // Grass
  102: [{ label: 'Leaf Stone',     target: 103 }],
  // Ground
  104: [{ label: 'Lv.28',          target: 105 }],
  // Normal — Chansey gains Blissey in Gen 2
  113: [{ label: 'Friendship',     target: 242 }],
  // Water — Seadra gains Kingdra in Gen 2
  117: [{ label: 'Trade',          target: 230 }],
  // Water
  118: [{ label: 'Lv.33',          target: 119 }],
  120: [{ label: 'Water Stone',    target: 121 }],
  // Bug — Scyther gains Scizor in Gen 2
  123: [{ label: 'Trade',          target: 212 }],
  // Water
  129: [{ label: 'Lv.20',          target: 130 }],
  // Eevee — gains Espeon & Umbreon in Gen 2
  133: [
    { label: 'Water Stone',       target: 134 },
    { label: 'Thunder Stone',     target: 135 },
    { label: 'Fire Stone',        target: 136 },
    { label: 'Friendship (Day)',  target: 196 },
    { label: 'Friendship (Night)',target: 197 },
  ],
  // Normal — Porygon gains Porygon2 in Gen 2
  137: [{ label: 'Trade',          target: 233 }],
  // Fossil
  138: [{ label: 'Lv.40',          target: 139 }],
  140: [{ label: 'Lv.40',          target: 141 }],
  // Dragon
  147: [{ label: 'Lv.30',          target: 148 }],
  148: [{ label: 'Lv.55',          target: 149 }],
  // Poison
  109: [{ label: 'Lv.35',          target: 110 }],
  // Ground
  111: [{ label: 'Lv.42',          target: 112 }],

  // ══════════════════════════════════════════════════════════════════════
  //  GEN 2 LINES
  // ══════════════════════════════════════════════════════════════════════

  // Grass starters
  152: [{ label: 'Lv.16',          target: 153 }],
  153: [{ label: 'Lv.32',          target: 154 }],
  // Fire starters
  155: [{ label: 'Lv.14',          target: 156 }],
  156: [{ label: 'Lv.36',          target: 157 }],
  // Water starters
  158: [{ label: 'Lv.18',          target: 159 }],
  159: [{ label: 'Lv.30',          target: 160 }],
  // Normal
  161: [{ label: 'Lv.15',          target: 162 }],
  163: [{ label: 'Lv.20',          target: 164 }],
  // Bug
  165: [{ label: 'Lv.18',          target: 166 }],
  167: [{ label: 'Lv.22',          target: 168 }],
  // Water / Electric
  170: [{ label: 'Lv.27',          target: 171 }],
  // Babies (cross-gen → Gen 1)
  172: [{ label: 'Friendship',     target: 25  }],
  173: [{ label: 'Friendship',     target: 35  }],
  174: [{ label: 'Friendship',     target: 39  }],
  // Fairy
  175: [{ label: 'Friendship',     target: 176 }],
  // Psychic
  177: [{ label: 'Lv.25',          target: 178 }],
  // Electric
  179: [{ label: 'Lv.15',          target: 180 }],
  180: [{ label: 'Lv.30',          target: 181 }],
  // Water / Fairy
  183: [{ label: 'Lv.18',          target: 184 }],
  // Grass
  187: [{ label: 'Lv.18',          target: 188 }],
  188: [{ label: 'Lv.27',          target: 189 }],
  // Grass
  191: [{ label: 'Sun Stone',      target: 192 }],
  // Water / Ground
  194: [{ label: 'Lv.20',          target: 195 }],
  // Bug / Steel
  204: [{ label: 'Lv.31',          target: 205 }],
  // Bug
  209: [{ label: 'Lv.23',          target: 210 }],
  // Ice / Dark
  216: [{ label: 'Lv.30',          target: 217 }],
  // Fire / Rock
  218: [{ label: 'Lv.38',          target: 219 }],
  // Ice / Ground
  220: [{ label: 'Lv.33',          target: 221 }],
  // Water
  223: [{ label: 'Lv.25',          target: 224 }],
  // Dark / Fire
  228: [{ label: 'Lv.24',          target: 229 }],
  // Ground
  231: [{ label: 'Lv.25',          target: 232 }],
  // Fighting — Tyrogue's branching evo (cross-gen → Gen 1 and Gen 2)
  236: [
    { label: 'Lv.20 ATK>DEF',    target: 106 },
    { label: 'Lv.20 DEF>ATK',    target: 107 },
    { label: 'Lv.20 ATK=DEF',    target: 237 },
  ],
  // Ice / Psychic (cross-gen → Gen 1)
  238: [{ label: 'Lv.30',          target: 124 }],
  // Electric (cross-gen → Gen 1)
  239: [{ label: 'Lv.30',          target: 125 }],
  // Fire (cross-gen → Gen 1)
  240: [{ label: 'Lv.30',          target: 126 }],
  // Dragon
  246: [{ label: 'Lv.30',          target: 247 }],
  247: [{ label: 'Lv.55',          target: 248 }],

  // ══════════════════════════════════════════════════════════════════════
  //  GEN 3 LINES
  // ══════════════════════════════════════════════════════════════════════

  // Grass starters
  252: [{ label: 'Lv.16',          target: 253 }],
  253: [{ label: 'Lv.36',          target: 254 }],
  // Fire starters
  255: [{ label: 'Lv.16',          target: 256 }],
  256: [{ label: 'Lv.36',          target: 257 }],
  // Water starters
  258: [{ label: 'Lv.16',          target: 259 }],
  259: [{ label: 'Lv.36',          target: 260 }],
  // Dark
  261: [{ label: 'Lv.18',          target: 262 }],
  // Normal
  263: [{ label: 'Lv.20',          target: 264 }],
  // Bug — Wurmple branches by personality
  265: [
    { label: 'Lv.7',             target: 266 },
    { label: 'Lv.7',             target: 268 },
  ],
  266: [{ label: 'Lv.10',          target: 267 }],
  268: [{ label: 'Lv.10',          target: 269 }],
  // Water / Grass
  270: [{ label: 'Lv.14',          target: 271 }],
  271: [{ label: 'Water Stone',    target: 272 }],
  // Grass / Dark
  273: [{ label: 'Lv.14',          target: 274 }],
  274: [{ label: 'Leaf Stone',     target: 275 }],
  // Normal / Flying
  276: [{ label: 'Lv.22',          target: 277 }],
  // Water / Flying
  278: [{ label: 'Lv.25',          target: 279 }],
  // Psychic / (Fairy)
  280: [{ label: 'Lv.20',          target: 281 }],
  281: [{ label: 'Lv.30',          target: 282 }],
  // Bug / Water → Bug / Flying
  283: [{ label: 'Lv.22',          target: 284 }],
  // Grass / Fighting
  285: [{ label: 'Lv.23',          target: 286 }],
  // Normal
  287: [{ label: 'Lv.18',          target: 288 }],
  288: [{ label: 'Lv.36',          target: 289 }],
  // Bug → Bug / Flying + Ghost (Shedinja is special — show only Ninjask)
  290: [{ label: 'Lv.20',          target: 291 }],
  // Normal
  293: [{ label: 'Lv.20',          target: 294 }],
  294: [{ label: 'Lv.40',          target: 295 }],
  // Fighting
  296: [{ label: 'Lv.24',          target: 297 }],
  // Water / Fairy (baby, cross-gen → Gen 2 Marill)
  298: [{ label: 'Friendship',     target: 183 }],
  // Normal
  300: [{ label: 'Moon Stone',     target: 301 }],
  // Steel / Rock
  304: [{ label: 'Lv.32',          target: 305 }],
  305: [{ label: 'Lv.42',          target: 306 }],
  // Fighting / Psychic
  307: [{ label: 'Lv.37',          target: 308 }],
  // Electric
  309: [{ label: 'Lv.26',          target: 310 }],
  // Poison
  316: [{ label: 'Lv.26',          target: 317 }],
  // Water / Dark
  318: [{ label: 'Lv.30',          target: 319 }],
  // Water
  320: [{ label: 'Lv.40',          target: 321 }],
  // Fire / Ground
  322: [{ label: 'Lv.33',          target: 323 }],
  // Psychic
  325: [{ label: 'Lv.32',          target: 326 }],
  // Ground / Dragon
  328: [{ label: 'Lv.35',          target: 329 }],
  329: [{ label: 'Lv.45',          target: 330 }],
  // Grass / Dark
  331: [{ label: 'Lv.32',          target: 332 }],
  // Normal / Flying
  333: [{ label: 'Lv.35',          target: 334 }],
  // Water / Ground
  339: [{ label: 'Lv.30',          target: 340 }],
  // Water / Dark
  341: [{ label: 'Lv.30',          target: 342 }],
  // Ground / Psychic
  343: [{ label: 'Lv.36',          target: 344 }],
  // Rock / Grass (fossil)
  345: [{ label: 'Lv.40',          target: 346 }],
  // Rock / Bug (fossil)
  347: [{ label: 'Lv.40',          target: 348 }],
  // Water
  349: [{ label: 'Beauty',         target: 350 }],
  // Ghost
  353: [{ label: 'Lv.37',          target: 354 }],
  // Ghost
  355: [{ label: 'Lv.37',          target: 356 }],
  // Ice / Ghost (Snorunt — Froslass is Gen 4, show only Glalie)
  361: [{ label: 'Lv.42',          target: 362 }],
  // Ice / Water
  363: [{ label: 'Lv.32',          target: 364 }],
  364: [{ label: 'Lv.44',          target: 365 }],
  // Water — Clamperl branches by held item
  366: [
    { label: 'Trade DeepSeaTooth',  target: 367 },
    { label: 'Trade DeepSeaScale',  target: 368 },
  ],
  // Dragon
  371: [{ label: 'Lv.30',          target: 372 }],
  372: [{ label: 'Lv.50',          target: 373 }],
  // Steel / Psychic
  374: [{ label: 'Lv.20',          target: 375 }],
  375: [{ label: 'Lv.45',          target: 376 }],
  // Psychic (baby, cross-gen → Gen 2 Wobbuffet)
  360: [{ label: 'Lv.15',          target: 202 }],
};

/** @deprecated Use EVOLUTIONS instead */
export const GEN1_EVOLUTIONS = EVOLUTIONS;
