import { makeTypeIcon, TYPE_ICON_W, TYPE_ICON_H } from './iconSheets.js';

/**
 * A "type pill" — rounded dark badge with an offset icon section on the left
 * and the uppercase type name on the right. Each pill is sized to fit its
 * individual label so long names like "ELECTRIC" / "PSYCHIC" don't overflow.
 */

export const TYPE_PILL_H   = 26;
export const TYPE_PILL_GAP = 4;

const _ICON_AREA_W = 28;
const _RADIUS      = 5;
const _TEXT_L_PAD  = 6;
const _TEXT_R_PAD  = 8;
const _LABEL_STYLE = {
  fontFamily: 'Gen3', fontSize: '12px', color: '#ffffff', fontStyle: 'bold', padding: { y: 3 },
};

/** Returns the width of a single pill for the given type. */
export function measureTypePillWidth(scene, type) {
  const t = scene.add.text(0, 0, String(type).toUpperCase(), _LABEL_STYLE);
  const w = Math.ceil(t.width);
  t.destroy();
  return _ICON_AREA_W + _TEXT_L_PAD + w + _TEXT_R_PAD;
}

/** Returns the total width of a row of type pills (including gaps). */
export function measureTypePillsWidth(scene, types) {
  const list = (types ?? []).slice(0, 2);
  if (list.length === 0) return 0;
  let total = 0;
  list.forEach((type, i) => {
    total += measureTypePillWidth(scene, type);
    if (i < list.length - 1) total += TYPE_PILL_GAP;
  });
  return total;
}

/** Draw a row of type pills starting at (x, y). Caps at 2 types. */
export function drawTypePills(menu, x, y, types) {
  const { scene, reg } = menu;
  let cursorX = x;

  (types ?? []).slice(0, 2).forEach((type) => {
    const label = scene.add.text(0, 0, String(type).toUpperCase(), _LABEL_STYLE);
    const textW = Math.ceil(label.width);
    const pillW = _ICON_AREA_W + _TEXT_L_PAD + textW + _TEXT_R_PAD;
    const px    = cursorX;

    const body = scene.add.graphics();
    body.fillStyle(0x2a2a2a, 1);
    body.fillRoundedRect(px, y, pillW, TYPE_PILL_H, _RADIUS);
    reg(body);

    const icoBg = scene.add.graphics();
    icoBg.fillStyle(0x454545, 1);
    icoBg.fillRoundedRect(px, y, _ICON_AREA_W, TYPE_PILL_H, {
      tl: _RADIUS, bl: _RADIUS, tr: 0, br: 0,
    });
    reg(icoBg);

    const icoX = px + Math.floor((_ICON_AREA_W - TYPE_ICON_W) / 2);
    const icoY = y  + Math.floor((TYPE_PILL_H - TYPE_ICON_H) / 2);
    const icon = makeTypeIcon(scene, icoX, icoY, type);
    if (icon) reg(icon);

    label.setPosition(px + _ICON_AREA_W + _TEXT_L_PAD, y + TYPE_PILL_H / 2);
    label.setOrigin(0, 0.5);
    reg(label);

    cursorX += pillW + TYPE_PILL_GAP;
  });
}
