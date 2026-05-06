import {
  TEXT_STYLE_BOLD, TEXT_STYLE_SM, TEXT_STYLE_HINT,
} from './constants.js';
import {
  drawTypeCategoryPill, TYPE_CAT_PILL_W, TYPE_CAT_PILL_H,
} from './TypeCategoryPill.js';
import { getMoveMeta } from './moveMeta.js';

/**
 * Reusable moves panel — renders up to N move rows for a party Pokémon.
 * Each row: rounded row bg → combined type/category pill → move name → PP.
 * Empty slots render as a muted row with a '—' centred.
 */

export const MOVES_PANEL_ROW_H = 44;

/**
 * @param {object} menu    - something with { scene, reg }
 * @param {object} opts
 * @param {number} opts.x
 * @param {number} opts.y
 * @param {number} opts.w
 * @param {Array}  opts.moves        - the mon's moves array (slots may be undefined)
 * @param {number} [opts.count=4]    - number of slots to render
 * @param {number} [opts.rowH]       - row height (defaults to MOVES_PANEL_ROW_H)
 * @param {number} [opts.gap=0]      - vertical gap between rows
 * @returns {number} Total height occupied (rows + gaps).
 */
export function drawMovesPanel(menu, { x, y, w, moves, count = 4, rowH = MOVES_PANEL_ROW_H, gap = 0, filledBg, filledStroke, emptyBg }) {
  for (let i = 0; i < count; i++) {
    const rowY = y + i * (rowH + gap);
    drawMoveRow(menu, x, rowY, w, rowH, moves?.[i] ?? null, { filledBg, filledStroke, emptyBg });
  }
  return count * rowH + Math.max(0, count - 1) * gap;
}

/** Single row rendering — exported in case callers want to draw one at a time. */
export function drawMoveRow(menu, x, y, w, h, move, opts = {}) {
  const { scene, reg } = menu;
  const filledBg     = opts.filledBg     ?? 0xeef2f8;
  const filledStroke = opts.filledStroke ?? null;
  const emptyBg      = opts.emptyBg      ?? 0xe8e8e8;

  const bg = scene.add.graphics();
  bg.fillStyle(move ? filledBg : emptyBg, 1);
  bg.fillRoundedRect(x, y, w, h, 4);
  if (move && filledStroke != null) {
    bg.lineStyle(1, filledStroke, 1);
    bg.strokeRoundedRect(x, y, w, h, 4);
  }
  reg(bg);

  if (!move) {
    const t = scene.add.text(x + w / 2, y + h / 2, '—', { ...TEXT_STYLE_HINT, align: 'center' });
    t.setOrigin(0.5, 0.5);
    reg(t);
    return;
  }

  const meta     = getMoveMeta(move.name);
  const type     = meta?.type ?? null;
  const category = meta?.category ?? null;
  const pillY    = y + Math.floor((h - TYPE_CAT_PILL_H) / 2);
  let cursorX    = x + 10;

  if (type || category) {
    drawTypeCategoryPill(menu, cursorX, pillY, type, category);
    cursorX += TYPE_CAT_PILL_W + 10;
  } else {
    cursorX += 10;
  }

  const nameT = scene.add.text(cursorX, y + h / 2, move.name, TEXT_STYLE_BOLD);
  nameT.setOrigin(0, 0.5);
  reg(nameT);

  const ppCur = move.pp?.current ?? move.pp?.max ?? '?';
  const ppMax = move.pp?.max ?? '?';
  const ppT = scene.add.text(x + w - 10, y + h / 2, `PP  ${ppCur}/${ppMax}`, TEXT_STYLE_SM);
  ppT.setOrigin(1, 0.5);
  reg(ppT);
}
