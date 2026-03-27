import { Pokedex, GAMES, NATURES } from '@spriteworld/pokemon-data';
import { gameState } from '@Data/gameState.js';
import { EVOLUTIONS } from '@Data/evolutions.js';
import PokemonSprite from '../PokemonSprite.js';
import {
  TEXT_STYLE_BODY, TEXT_STYLE_HINT, TEXT_STYLE_SM,
} from './layout.js';
import { resolveMonData, drawHpRow, drawExpRow, drawTypeBadges } from './helpers.js';
import TypeBadge, { TYPE_COLORS } from '../common/TypeBadge.js';

export const BALL_COLORS = {
  poke:    0xee1111,
  great:   0x2255bb,
  ultra:   0xeebb00,
  master:  0x9933bb,
  safari:  0x44aa44,
  net:     0x3388bb,
  dive:    0x4499ee,
  nest:    0x88bb22,
  repeat:  0xeeaa00,
  timer:   0xdddddd,
  luxury:  0x222222,
  premier: 0xdddddd,
};

/** Returns the tab labels for the given display mode. */
export function getMonDetailTabs(mon) {
  return mon ? ['MOVES', 'STATS', 'INFO'] : ['STATS', 'INFO', 'EVOLUTIONS'];
}

function blendColors(c1, c2, t = 0.5) {
  const r = Math.round(((c1 >> 16) & 0xff) + (((c2 >> 16) & 0xff) - ((c1 >> 16) & 0xff)) * t);
  const g = Math.round(((c1 >>  8) & 0xff) + (((c2 >>  8) & 0xff) - ((c1 >>  8) & 0xff)) * t);
  const b = Math.round(( c1        & 0xff) + (( c2         & 0xff) - ( c1        & 0xff)) * t);
  return (r << 16) | (g << 8) | b;
}

const STAT_ROWS = [
  { label: 'HP',  key: 'HP',             isHp: true  },
  { label: 'ATK', key: 'ATTACK',         isHp: false },
  { label: 'DEF', key: 'DEFENSE',        isHp: false },
  { label: 'SPA', key: 'SPECIAL_ATTACK', isHp: false },
  { label: 'SPD', key: 'SPECIAL_DEFENSE',isHp: false },
  { label: 'SPE', key: 'SPEED',          isHp: false },
];

/**
 * Renders a Pokémon detail panel into an arbitrary bounding rectangle.
 *
 * @param {object}      menu         - PauseMenu instance (provides scene, reg, dex)
 * @param {object}      opts
 * @param {object|null} opts.mon     - party pokemon config; null for dex-only mode
 * @param {object}      [opts.entry] - pre-resolved dex entry; resolved internally if absent
 * @param {number}      opts.x
 * @param {number}      opts.y
 * @param {number}      opts.w
 * @param {number}      opts.h
 * @param {number}      [opts.tab=0] - active tab index
 */
export function drawMonDetail(menu, { mon, entry, x, y, w, h, tab = 0 }) {
  if (!menu.dex) menu.dex = new Pokedex(GAMES.POKEMON_FIRE_RED);

  if (!entry && mon) entry = resolveMonData(menu.dex, mon).entry;

  const types       = entry?.types ?? [];
  const dexNum      = entry ? `#${String(entry.nat_dex_id).padStart(3, '0')}` : '';
  const speciesName = entry ? entry.species.toUpperCase() : (mon ? `#${mon.species}` : '???');
  const gender      = mon?.gender === 'male' ? ' ♂' : mon?.gender === 'female' ? ' ♀' : '';

  const { scene, reg } = menu;

  // ── Layout ────────────────────────────────────────────────────────
  const HEADER_H  = 100;
  const BALL_CX   = Math.round(x + w * 0.2);
  const BALL_CY   = y + HEADER_H;
  const BALL_R    = 68;
  const SPRITE_SZ = 90;
  const HP_X      = BALL_CX + BALL_R + 20;
  const HP_W      = (x + w) - HP_X - 20;
  const HP_Y      = y + HEADER_H + 10;
  const DIV_Y     = y + HEADER_H;
  const TAB_Y     = Math.max(DIV_Y + 44, BALL_CY + BALL_R + 10);
  const TAB_H     = 28;
  const CONTENT_Y = TAB_Y + TAB_H + 8;
  const CONTENT_X = x + 16;
  const CONTENT_W = w - 32;

  // ── Gradient header ────────────────────────────────────────────────
  const c1   = TYPE_COLORS[types[0]?.toLowerCase()] ?? 0x888888;
  const c2   = TYPE_COLORS[types[1]?.toLowerCase()] ?? c1;
  const midC = blendColors(c1, c2, 0.5);

  const gradBg = scene.add.graphics();
  gradBg.fillGradientStyle(midC, c2, c1, midC, 1);
  gradBg.fillRect(x, y, w, HEADER_H);
  reg(gradBg);

  _addBouncingBalls(scene, reg, { x, y, w, h: HEADER_H });

  const hStyle = { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff', fontStyle: 'bold' };

  // ── Title ─────────────────────────────────────────────────────────
  const title = mon ? `${speciesName}${gender} (Lv.${mon.level})` : speciesName + gender;
  const nameT = scene.add.text(x + w / 2, y + 10, title, hStyle);
  nameT.setOrigin(0.5, 0);
  reg(nameT);

  // ── Type badges ───────────────────────────────────────────────────
  const typeCount  = Math.min(2, types.length);
  const typeBlockW = typeCount * (TypeBadge.WIDTH + 4) - 4;
  drawTypeBadges(menu, (x + w) - typeBlockW - 20, y + HEADER_H - TypeBadge.HEIGHT - 8, types);

  // ── Horizontal divider ────────────────────────────────────────────
  const hDiv = scene.add.graphics();
  hDiv.lineStyle(1, 0xcccccc, 1);
  hDiv.lineBetween(x + 16, DIV_Y, x + w - 16, DIV_Y);
  reg(hDiv);

  // ── HP bar (party only) ───────────────────────────────────────────
  if (mon) {
    const { maxHp } = resolveMonData(menu.dex, mon);
    const currentHp = mon.currentHp ?? maxHp;
    drawHpRow(menu, HP_X, HP_Y,      HP_W, currentHp, maxHp, Math.max(0, currentHp / maxHp));
    drawExpRow(menu, HP_X, HP_Y + 18, HP_W, mon, entry);
  }

  // ── Big dex number ────────────────────────────────────────────────
  if (dexNum) {
    const fontSize = Math.min(64, Math.round(w * 0.1));
    const dexBig = scene.add.text(BALL_CX + BALL_R + 10, y + HEADER_H, dexNum, {
      fontFamily: 'monospace', fontSize: `${fontSize}px`, color: '#ffffff', fontStyle: 'bold',
    });
    dexBig.setOrigin(0, 1);
    dexBig.setAlpha(0.3);
    reg(dexBig);
  }

  // ── Pokeball + sprite (drawn last → renders on top of content) ─────
  _addBall(scene, reg, BALL_CX, BALL_CY, BALL_R, mon?.ball, mon?.ballRotation);
  reg(new PokemonSprite(scene, BALL_CX - SPRITE_SZ / 2, BALL_CY - SPRITE_SZ / 2, {
    species: entry?.nat_dex_id ?? mon?.species ?? 0,
    shiny:   mon?.shiny  ?? false,
    gender:  mon?.gender ?? null,
    forme:   mon?.forme  ?? null,
    size:    SPRITE_SZ,
  }));

  // ── Tab bar ───────────────────────────────────────────────────────
  const tabs      = getMonDetailTabs(mon);
  const activeTab = Math.max(0, Math.min(tab, tabs.length - 1));
  _drawTabBar(scene, reg, tabs, activeTab, CONTENT_X, TAB_Y, CONTENT_W, TAB_H);

  // ── Tab content ───────────────────────────────────────────────────
  switch (tabs[activeTab]) {
    case 'MOVES':      _drawMovesTab(scene, reg, mon, CONTENT_X, CONTENT_Y, CONTENT_W); break;
    case 'STATS':      _drawStatsTab(scene, reg, mon, entry, CONTENT_X, CONTENT_Y, CONTENT_W); break;
    case 'INFO':       _drawInfoTab(scene, reg, mon, entry, CONTENT_X, CONTENT_Y, CONTENT_W); break;
    case 'EVOLUTIONS': _drawEvolutionsTab(scene, reg, menu, entry, CONTENT_X, CONTENT_Y, CONTENT_W); break;
  }
}

// ─── Evolution helpers ────────────────────────────────────────────────────────

/** Walk backwards through EVOLUTIONS to find the chain root. */
function _evoRoot(id) {
  for (const [k, vs] of Object.entries(EVOLUTIONS)) {
    if (vs.some(v => v.target === id)) return _evoRoot(Number(k));
  }
  return id;
}

/** Build a tree node: { id, next: [{ label, node }] } */
function _evoTree(id) {
  const evos = EVOLUTIONS[id] ?? [];
  return { id, next: evos.map(e => ({ label: e.label, node: _evoTree(e.target) })) };
}

function _isLinear(node) {
  if (node.next.length === 0) return true;
  if (node.next.length > 1) return false;
  return _isLinear(node.next[0].node);
}

/** Returns [{ id, label }] where label is condition TO the next stage (null for last). */
function _flatLinear(node) {
  if (!node.next.length) return [{ id: node.id, label: null }];
  return [{ id: node.id, label: node.next[0].label }, ..._flatLinear(node.next[0].node)];
}

function _evoSprite(scene, reg, menu, id, x, y, size, isActive) {
  const seen = !!gameState.pokedex[id]?.seen;

  if (isActive) {
    const bg = scene.add.graphics();
    bg.fillStyle(0xd0e8ff, 1);
    bg.fillRoundedRect(x - 4, y - 4, size + 8, size + 20, 4);
    reg(bg);
  }

  reg(new PokemonSprite(scene, x, y, { species: seen ? id : 0, size }));

  let name = '???';
  if (seen) {
    try { name = menu.dex.getPokemonById(id)?.species?.toUpperCase() ?? '???'; }
    catch (_) { /* unknown id */ }
  }
  const nameT = scene.add.text(x + size / 2, y + size + 2, name, TEXT_STYLE_SM);
  nameT.setOrigin(0.5, 0);
  reg(nameT);
}

function _drawEvolutionsTab(scene, reg, menu, entry, x, y, w) {
  if (!entry) return;
  const dexId = entry.nat_dex_id;
  const root  = _evoRoot(dexId);
  const tree  = _evoTree(root);

  if (tree.next.length === 0) {
    const t = scene.add.text(x + w / 2, y + 30, 'Does not evolve.', TEXT_STYLE_HINT);
    t.setOrigin(0.5, 0);
    reg(t);
    return;
  }

  if (_isLinear(tree)) {
    _drawLinearChain(scene, reg, menu, _flatLinear(tree), x, y, w, dexId);
  } else {
    _drawBranchingChain(scene, reg, menu, tree, x, y, w, dexId);
  }
}

function _drawLinearChain(scene, reg, menu, stages, x, y, w, currentId) {
  const SPR    = 52;
  const COND_H = 52; // space between bottom of sprite and top of next sprite
  const cx     = x + Math.round(w / 2);
  let   sy     = y + 8;

  stages.forEach(({ id, label }) => {
    _evoSprite(scene, reg, menu, id, cx - Math.round(SPR / 2), sy, SPR, id === currentId);
    if (label) {
      const arrY = sy + SPR + 10;
      const arr  = scene.add.text(cx, arrY, '▼', { fontFamily: 'monospace', fontSize: '11px', color: '#888888' });
      arr.setOrigin(0.5, 0);
      reg(arr);
      const lbl  = scene.add.text(cx, arrY + 15, label, { fontFamily: 'monospace', fontSize: '10px', color: '#555555' });
      lbl.setOrigin(0.5, 0);
      reg(lbl);
      sy += SPR + COND_H;
    } else {
      sy += SPR;
    }
  });
}

function _drawBranchingChain(scene, reg, menu, tree, x, y, w, currentId) {
  // Walk forward through single-child nodes to find the actual branch point.
  const prefix = [];
  let cur = tree;
  while (cur.next.length === 1) {
    prefix.push({ id: cur.id, label: cur.next[0].label });
    cur = cur.next[0].node;
  }
  const branchNode = cur;
  const branches   = branchNode.next;
  const n          = branches.length;

  _drawTopDownBranching(scene, reg, menu, prefix, branchNode, branches, x, y, w, currentId);
}

function _drawTopDownBranching(scene, reg, menu, prefix, branchNode, branches, x, y, w, currentId) {
  const n      = branches.length;
  const SPR    = 46;
  const COND_H = 52;
  const cx     = x + Math.round(w / 2);

  // Draw prefix top-to-bottom (same pattern as linear chain)
  let sy = y + 8;
  for (const { id, label } of prefix) {
    _evoSprite(scene, reg, menu, id, cx - Math.round(SPR / 2), sy, SPR, id === currentId);
    if (label) {
      const arrY = sy + SPR + 10;
      const arr = scene.add.text(cx, arrY, '▼', { fontFamily: 'monospace', fontSize: '11px', color: '#888888' });
      arr.setOrigin(0.5, 0); reg(arr);
      const lbl = scene.add.text(cx, arrY + 15, label, { fontFamily: 'monospace', fontSize: '10px', color: '#555555' });
      lbl.setOrigin(0.5, 0); reg(lbl);
      sy += SPR + COND_H;
    } else {
      sy += SPR;
    }
  }

  // Draw the branch node centred
  _evoSprite(scene, reg, menu, branchNode.id, cx - Math.round(SPR / 2), sy, SPR, branchNode.id === currentId);

  // Draw each branch target below with ▼ arrow and condition label
  const gap       = Math.min(60, Math.max(8, Math.floor((w - n * SPR) / (n + 1))));
  const rowW      = n * SPR + (n - 1) * gap;
  const rowStartX = x + Math.round((w - rowW) / 2);
  const condY     = sy + SPR + 10;
  const targY     = condY + COND_H;

  branches.forEach(({ label, node }, i) => {
    const sprX = rowStartX + i * (SPR + gap);
    const bcx  = sprX + SPR / 2;

    const arr = scene.add.text(bcx, condY, '▼', { fontFamily: 'monospace', fontSize: '11px', color: '#888888' });
    arr.setOrigin(0.5, 0); reg(arr);

    const lbl = scene.add.text(bcx, condY + 14, label, { fontFamily: 'monospace', fontSize: '9px', color: '#555555' });
    lbl.setOrigin(0.5, 0); reg(lbl);

    _evoSprite(scene, reg, menu, node.id, sprX, targY, SPR, node.id === currentId);
  });
}

// ─── Tab rendering ───────────────────────────────────────────────────────────

function _drawTabBar(scene, reg, tabs, activeTab, x, y, totalW, tabH) {
  const gap   = 6;
  const tabW  = Math.floor((totalW - gap * (tabs.length - 1)) / tabs.length);

  tabs.forEach((label, i) => {
    const tx       = x + i * (tabW + gap);
    const isActive = i === activeTab;

    const bg = scene.add.graphics();
    bg.fillStyle(isActive ? 0x3399ff : 0xe0e0e0, 1);
    bg.fillRoundedRect(tx, y, tabW, tabH, 4);
    reg(bg);

    const t = scene.add.text(tx + tabW / 2, y + tabH / 2, label, {
      fontFamily: 'monospace',
      fontSize:   '11px',
      color:      isActive ? '#ffffff' : '#555555',
      fontStyle:  isActive ? 'bold' : 'normal',
    });
    t.setOrigin(0.5, 0.5);
    reg(t);
  });
}

function _drawMovesTab(scene, reg, mon, x, y, w) {
  (mon?.moves ?? []).forEach((m, i) => {
    const my = y + i * 42;

    const bg = scene.add.graphics();
    bg.fillStyle(0xeef2f8, 1);
    bg.fillRoundedRect(x, my, w, 34, 4);
    reg(bg);

    reg(scene.add.text(x + 10, my + 9, m.name, TEXT_STYLE_BODY));

    const ppCur = m.pp?.current ?? m.pp?.max ?? '?';
    const ppMax = m.pp?.max ?? '?';
    const ppT = scene.add.text(x + w - 10, my + 9, `PP ${ppCur}/${ppMax}`, TEXT_STYLE_SM);
    ppT.setOrigin(1, 0);
    reg(ppT);
  });
}

function _drawStatsTab(scene, reg, mon, entry, x, y, w) {
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

function _drawInfoTab(scene, reg, mon, entry, x, y, w) {
  let rowY = y;
  const ROW = 22;

  if (mon) {
    if (mon.nature) {
      reg(scene.add.text(x, rowY, 'Nature', TEXT_STYLE_HINT));
      reg(scene.add.text(x + 80, rowY, mon.nature, TEXT_STYLE_SM));
      rowY += ROW;
    }
    if (mon.ability?.name && mon.ability.name !== 'none') {
      reg(scene.add.text(x, rowY, 'Ability', TEXT_STYLE_HINT));
      reg(scene.add.text(x + 80, rowY, mon.ability.name, TEXT_STYLE_SM));
      rowY += ROW;
    }
    if (mon.shiny) {
      reg(scene.add.text(x, rowY, '✦ Shiny', { ...TEXT_STYLE_SM, color: '#ddaa00' }));
      rowY += ROW;
    }
  }

  if (entry) {
    if (entry.height != null) {
      reg(scene.add.text(x, rowY, 'Height', TEXT_STYLE_HINT));
      reg(scene.add.text(x + 80, rowY, `${entry.height.toFixed(1)} m`, TEXT_STYLE_SM));
      rowY += ROW;
    }
    if (entry.weight != null) {
      reg(scene.add.text(x, rowY, 'Weight', TEXT_STYLE_HINT));
      reg(scene.add.text(x + 80, rowY, `${entry.weight.toFixed(1)} kg`, TEXT_STYLE_SM));
      rowY += ROW;
    }
  }
}

// ─── Private helpers ─────────────────────────────────────────────────────────

function _addBouncingBalls(scene, reg, bounds) {
  const { x, y, w, h } = bounds;
  const BALL_TYPES = Object.keys(BALL_COLORS);
  const NUM_BALLS  = 7;

  Array.from({ length: NUM_BALLS }, () => {
    const r    = 6 + Math.floor(Math.random() * 8);
    const bx   = x + r + Math.random() * (w - r * 2);
    const by   = y + r + Math.random() * (h - r * 2);
    const type = BALL_TYPES[Math.floor(Math.random() * BALL_TYPES.length)];
    const top  = BALL_COLORS[type];

    const g = scene.add.graphics();
    g.setAlpha(0.3);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(0, 0, r);
    g.fillStyle(top, 1);
    g.beginPath();
    g.arc(0, 0, r, Math.PI, Math.PI * 2, false);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(0, 0, Math.round(r * 0.25));
    g.setPosition(bx, by);
    reg(g);
  });

}

function _addBall(scene, reg, cx, cy, r, ballType = 'poke', rotation = -0.4) {
  const topColor = BALL_COLORS[ballType] ?? BALL_COLORS.poke;
  const bandW    = Math.max(2, Math.round(r * 0.06));
  const btnR     = Math.round(r * 0.20);
  const btnBand  = Math.max(2, Math.round(r * 0.05));
  const mid      = r;

  const rt = scene.add.renderTexture(cx, cy, r * 2, r * 2);
  rt.setOrigin(0.5, 0.5);

  const fill = scene.add.graphics();
  fill.fillStyle(0xffffff, 1);
  fill.fillCircle(mid, mid, r);
  fill.fillStyle(topColor, 1);
  fill.beginPath();
  fill.arc(mid, mid, r, Math.PI + rotation, rotation + Math.PI * 2, false);
  fill.closePath();
  fill.fillPath();
  rt.draw(fill, 0, 0);
  fill.destroy();

  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  const gap  = scene.add.graphics();
  gap.fillStyle(0xffffff, 1);
  gap.fillPoints([
    { x: mid + r * cosR - bandW * sinR, y: mid + r * sinR + bandW * cosR },
    { x: mid + r * cosR + bandW * sinR, y: mid + r * sinR - bandW * cosR },
    { x: mid - r * cosR + bandW * sinR, y: mid - r * sinR - bandW * cosR },
    { x: mid - r * cosR - bandW * sinR, y: mid - r * sinR + bandW * cosR },
  ], true);
  gap.fillCircle(mid, mid, btnR + btnBand);
  rt.erase(gap, 0, 0);
  gap.destroy();

  const btn = scene.add.graphics();
  btn.fillStyle(0xffffff, 1);
  btn.fillCircle(mid, mid, btnR);
  rt.draw(btn, 0, 0);
  btn.destroy();

  reg(rt);
}
