import { Pokedex, GAMES, NATURES } from '@spriteworld/pokemon-data';
import { gameState } from '@Data/gameState.js';
import { EVOLUTIONS } from '@Data/evolutions.js';
import PokemonSprite from '../PokemonSprite.js';
import {
  TEXT_STYLE_BODY, TEXT_STYLE_HINT, TEXT_STYLE_SM,
} from './layout.js';
import { resolveMonData, drawHpRow, drawTypeBadges } from './helpers.js';
import TypeBadge, { TYPE_COLORS } from '../TypeBadge.js';

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
    drawHpRow(menu, HP_X, HP_Y, HP_W, currentHp, maxHp, Math.max(0, currentHp / maxHp));
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
  const SPR   = 52;
  const COND  = 56;
  const total = stages.length * SPR + (stages.length - 1) * COND;
  let   sx    = x + Math.max(0, Math.round((w - total) / 2));
  const cy    = y + 20;

  stages.forEach(({ id, label }) => {
    _evoSprite(scene, reg, menu, id, sx, cy, SPR, id === currentId);

    if (label) {
      const ax  = sx + SPR + COND / 2;
      const arr = scene.add.text(ax, cy + SPR / 2 - 8, '▶', { fontFamily: 'monospace', fontSize: '12px', color: '#888888' });
      arr.setOrigin(0.5, 0.5);
      reg(arr);
      const lbl = scene.add.text(ax, cy + SPR / 2 + 6, label, { fontFamily: 'monospace', fontSize: '10px', color: '#555555' });
      lbl.setOrigin(0.5, 0);
      reg(lbl);
    }

    sx += SPR + (label ? COND : 0);
  });
}

function _drawBranchingChain(scene, reg, menu, tree, x, y, w, currentId) {
  const SPR     = 48;
  const ROW_H   = SPR + 18;
  const ROW_GAP = 10;
  const COND_W  = 72;
  const branches  = tree.next;
  const totalH    = branches.length * ROW_H + (branches.length - 1) * ROW_GAP;
  const baseCY    = y + totalH / 2;
  const BASE_X    = x + 8;
  const BRANCH_X  = BASE_X + SPR + COND_W;

  _evoSprite(scene, reg, menu, tree.id, BASE_X, baseCY - SPR / 2, SPR, tree.id === currentId);

  branches.forEach(({ label, node }, i) => {
    const rowCY = y + i * (ROW_H + ROW_GAP) + ROW_H / 2;

    const condCX = BASE_X + SPR + COND_W / 2;
    const arr = scene.add.text(condCX, rowCY - 8, '▶', { fontFamily: 'monospace', fontSize: '12px', color: '#888888' });
    arr.setOrigin(0.5, 0.5);
    reg(arr);
    const lbl = scene.add.text(condCX, rowCY + 6, label, { fontFamily: 'monospace', fontSize: '10px', color: '#555555' });
    lbl.setOrigin(0.5, 0);
    reg(lbl);

    _evoSprite(scene, reg, menu, node.id, BRANCH_X, rowCY - SPR / 2, SPR, node.id === currentId);
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

  const state = Array.from({ length: NUM_BALLS }, () => {
    const r    = 6 + Math.floor(Math.random() * 8);
    const bx   = x + r + Math.random() * (w - r * 2);
    const by   = y + r + Math.random() * (h - r * 2);
    const spd  = 25 + Math.random() * 45;
    const ang  = Math.random() * Math.PI * 2;
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

    const spinV = (Math.random() < 0.5 ? 1 : -1) * (2 + Math.random() * 3);
    return { g, x: bx, y: by, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r, rot: 0, spinV };
  });

  const update = (_t, delta) => {
    const dt = Math.min(delta, 100) / 1000;
    state.forEach(b => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x - b.r < x)     { b.x = x + b.r;     b.vx =  Math.abs(b.vx); b.spinV = -Math.abs(b.spinV); }
      if (b.x + b.r > x + w) { b.x = x + w - b.r; b.vx = -Math.abs(b.vx); b.spinV =  Math.abs(b.spinV); }
      if (b.y - b.r < y)     { b.y = y + b.r;     b.vy =  Math.abs(b.vy); b.spinV *= -1; }
      if (b.y + b.r > y + h) { b.y = y + h - b.r; b.vy = -Math.abs(b.vy); b.spinV *= -1; }
      b.rot += b.spinV * dt;
      b.g.setPosition(b.x, b.y);
      b.g.setRotation(b.rot);
    });
  };

  scene.events.on('update', update);

  const sentinel = scene.add.graphics();
  sentinel.once('destroy', () => scene.events.off('update', update));
  reg(sentinel);
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
