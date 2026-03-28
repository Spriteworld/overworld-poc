import { NATURES, STATS } from '@spriteworld/pokemon-data';
import { TEXT_STYLE_SM } from './constants.js';

const STAT_ROWS = [
  { label: 'HP',  key: STATS.HP,              isHp: true  },
  { label: 'ATK', key: STATS.ATTACK,          isHp: false },
  { label: 'DEF', key: STATS.DEFENSE,         isHp: false },
  { label: 'SPA', key: STATS.SPECIAL_ATTACK,  isHp: false },
  { label: 'SPD', key: STATS.SPECIAL_DEFENSE, isHp: false },
  { label: 'SPE', key: STATS.SPEED,           isHp: false },
];

/**
 * Render a stat bar panel into a bounding rectangle.
 *
 * @param {object}      menu        - container with { scene, reg }
 * @param {object}      opts
 * @param {object|null} opts.mon    - Pokémon with nature (string), ivs, evs, level;
 *                                    null for dex base-stat mode
 * @param {object}      [opts.entry] - Pokédex entry with base_stats
 * @param {number}      opts.x
 * @param {number}      opts.y
 * @param {number}      opts.w
 */
export function drawStatsPanel(menu, { mon, entry, x, y, w }) {
  const { scene, reg } = menu;
  const ivs = mon?.ivs ?? {};
  const evs = mon?.evs ?? {};
  const lvl = mon?.level ?? 1;

  const natureData = mon?.nature
    ? Object.values(NATURES).find(n => n.name === mon.nature.toUpperCase())
    : null;
  const natInc = natureData?.increase;
  const natDec = natureData?.decrease;

  const LABEL_W = 32;
  const VAL_W   = 32;
  const barX    = x + LABEL_W;
  const barW    = w - LABEL_W - VAL_W - 8;

  STAT_ROWS.forEach(({ label, key, isHp }, i) => {
    const rowY = y + i * 26;
    const base = entry?.base_stats?.[key] ?? 0;

    let stat, labelCol;
    if (mon) {
      const iv   = ivs[key] ?? 0;
      const ev   = evs[key] ?? 0;
      const term = Math.floor((2 * base + iv + Math.floor(ev / 4)) * lvl / 100);
      const raw  = isHp ? term + lvl + 10 : term + 5;
      const mult = (!isHp && natInc === key && natInc !== natDec) ? 1.1
                 : (!isHp && natDec === key && natInc !== natDec) ? 0.9 : 1;
      stat     = Math.floor(raw * mult);
      labelCol = mult > 1 ? '#e03030' : mult < 1 ? '#3060e0' : '#555555';
    } else {
      stat     = base;
      labelCol = '#555555';
    }

    const maxStat  = mon ? (isHp ? 400 : 300) : 255;
    const ratio    = Math.min(1, stat / maxStat);
    const barColor = ratio > 0.5 ? 0x48c050 : ratio > 0.3 ? 0xf0c040 : 0xe04040;

    reg(scene.add.text(x, rowY, label, { ...TEXT_STYLE_SM, color: labelCol }));

    const track = scene.add.graphics();
    track.fillStyle(0xdddddd, 1);
    track.fillRoundedRect(barX, rowY + 2, barW, 10, 2);
    track.fillStyle(barColor, 1);
    track.fillRoundedRect(barX, rowY + 2, Math.max(3, barW * ratio), 10, 2);
    reg(track);

    const valT = scene.add.text(barX + barW + 6, rowY, String(stat), TEXT_STYLE_SM);
    valT.setOrigin(0, 0);
    reg(valT);
  });
}
