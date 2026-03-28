// ─── Canvas ────────────────────────────────────────────────────────────────
export const SX = 0;
export const SY = 0;
export const SW = 800;
export const SH = 600;

// ─── Main menu panel (right side) ──────────────────────────────────────────
export const MX     = 612;
export const MY     = 80;
export const MW     = 170;
export const ITEM_H = 28;
export const PAD    = 12;

// ─── Team screen ───────────────────────────────────────────────────────────
export const TEAM_PAD_X   = 16;
export const TEAM_START_Y = 42;

export const HERO_W      = 210;
export const HERO_H      = 180;
export const HERO_SPRITE = 80;
export const HERO_TEXT_X = 8 + HERO_SPRITE + 10;
export const HERO_TEXT_W = HERO_W - HERO_TEXT_X - 8;

export const BENCH_X_OFF = TEAM_PAD_X + HERO_W + 10;
export const BENCH_W     = 330;
export const BENCH_H     = 64;
export const BENCH_GAP   = 8;

// ─── Pokédex screen ────────────────────────────────────────────────────────
export const DEX_LIST_W   = 200;
export const DEX_ITEM_H   = 20;
export const DEX_VISIBLE  = 25;
export const DEX_DETAIL_X = SX + DEX_LIST_W + 28;
export const DEX_DETAIL_W = SW - DEX_LIST_W - 44;

// ─── Text styles ───────────────────────────────────────────────────────────
export const TEXT_STYLE      = { fontFamily: 'Gen3', fontSize: '14px', color: '#181818' };
export const TEXT_STYLE_BOLD = { fontFamily: 'Gen3', fontSize: '14px', color: '#181818', fontStyle: 'bold' };
export const TEXT_STYLE_BODY = { fontFamily: 'Gen3', fontSize: '13px', color: '#181818' };
export const TEXT_STYLE_HINT = { fontFamily: 'Gen3', fontSize: '12px', color: '#888888' };
export const TEXT_STYLE_SM   = { fontFamily: 'Gen3', fontSize: '11px', color: '#181818' };
