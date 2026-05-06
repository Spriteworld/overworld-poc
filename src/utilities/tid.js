/**
 * Trainer ID generation — Gen 1/2/3 style. Each trainer (player, NPC,
 * rival) has a 16-bit public TID in the range [0, 65535]. In Gen 3 there
 * was also a 16-bit secret SID paired with it; this POC keeps just the
 * public half for now, which is enough for OT matching and displayed
 * trainer numbers.
 */
export function generateTid() {
  return Math.floor(Math.random() * 0x10000);
}

/** Format a TID for display — always five digits, zero-padded. */
export function formatTid(tid) {
  const n = Number.isFinite(tid) ? (tid | 0) & 0xffff : 0;
  return String(n).padStart(5, '0');
}
