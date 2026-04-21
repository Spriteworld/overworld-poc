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
export const TEAM_PAD_X    = 16;
export const TEAM_START_Y  = 42;

// Split point between the list column (left, ~40%) and info panel (right, ~60%).
export const TEAM_SPLIT_X  = 320;

// Left column — vertical list of all 6 slots.
export const TEAM_LIST_X   = SX + TEAM_PAD_X;
export const TEAM_LIST_W   = TEAM_SPLIT_X - TEAM_PAD_X * 2;
export const TEAM_SLOT_H   = 80;
export const TEAM_SLOT_GAP = 8;
export const TEAM_SPRITE   = 68;

// Right column — info panel for the cursor slot.
export const TEAM_INFO_X   = TEAM_SPLIT_X + TEAM_PAD_X;
export const TEAM_INFO_W   = SW - TEAM_INFO_X - TEAM_PAD_X;

// ─── Pokédex screen ────────────────────────────────────────────────────────
export const DEX_LIST_W   = 200;
export const DEX_ITEM_H   = 32;
export const DEX_VISIBLE  = 16;
export const DEX_DETAIL_X = SX + DEX_LIST_W + 28;
export const DEX_DETAIL_W = SW - DEX_LIST_W - 44;

// ─── Text styles ───────────────────────────────────────────────────────────
// Vertical padding on every style — fallback-font glyphs (♂ / ♀ / ✦ / …) are
// taller than the Gen3 line box and get clipped by Phaser without padding.
const TEXT_PAD = { padding: { y: 3 } };

export const TEXT_STYLE      = { fontFamily: 'Gen3', fontSize: '14px', color: '#181818', ...TEXT_PAD };
export const TEXT_STYLE_BOLD = { fontFamily: 'Gen3', fontSize: '14px', color: '#181818', fontStyle: 'bold', ...TEXT_PAD };
export const TEXT_STYLE_BODY = { fontFamily: 'Gen3', fontSize: '13px', color: '#181818', ...TEXT_PAD };
export const TEXT_STYLE_HINT = { fontFamily: 'Gen3', fontSize: '12px', color: '#888888', ...TEXT_PAD };
export const TEXT_STYLE_SM   = { fontFamily: 'Gen3', fontSize: '11px', color: '#181818', ...TEXT_PAD };
