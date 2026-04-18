/**
 * Character names / ids that the engine reserves for the player and the
 * player's walking Pokémon. Tiled-authored NPCs, trainers, and pkmn objects
 * — and any dynamically-spawned versions of those — must not re-use these
 * names, because GridEngine, `scene.characters`, and the scriptrunner all
 * look characters up by id, and a shadowed "player" would silently break
 * movement, battles, follow, and the follower-mon trail.
 */
export const RESERVED_CHARACTER_IDS = new Set(['player', 'playerMon']);

/**
 * Throws when `name` collides with a reserved id.
 * @param {string} name   - The Tiled / script-provided character name.
 * @param {string} source - Short label for the caller (used in the error).
 * @throws {Error} on collision
 */
export function assertNotReservedId(name, source) {
  if (RESERVED_CHARACTER_IDS.has(name)) {
    throw new Error(
      `[${source}] character name "${name}" is reserved by the player/follower. Rename the Tiled object or script spawn.`
    );
  }
}
