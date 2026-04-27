/**
 * Player-location override supplied by the test harness when launching a
 * scenario. Read by Preload as the `playerLocation` value passed to the
 * test scene's start params, so a scenario can drop the player at a
 * specific tile (and optional charLayer) instead of relying on the map's
 * default `playerSpawn` interactable.
 */
let _loc = null;

export function getStartPlayerLocation() { return _loc; }
export function setStartPlayerLocation(loc) { _loc = loc ? { ...loc } : null; }
export function clearStartPlayerLocation() { _loc = null; }
