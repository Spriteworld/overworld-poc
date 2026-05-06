const WORLD_MANIFEST = {
  kanto:    () => import('@Worlds/kanto/index.js'),
  gavworld: () => import('@Worlds/gavworld/index.js'),
};

export function worldFromSceneKey(sceneKey) {
  if (!sceneKey) return null;
  const lower = sceneKey.toLowerCase();
  for (const id of Object.keys(WORLD_MANIFEST)) {
    if (lower.startsWith(id)) return id;
  }
  return null;
}

const _loaded = new Set();

export async function loadWorld(worldId) {
  if (_loaded.has(worldId)) return;
  const loader = WORLD_MANIFEST[worldId];
  if (!loader) throw new Error(`Unknown world: ${worldId}`);
  await loader();
  _loaded.add(worldId);
}

export function resolveWorldAtBoot() {
  const loadMap = import.meta.env.VITE_LOAD_MAP || '';
  if (loadMap) {
    const world = worldFromSceneKey(loadMap);
    if (world) return world;
  }

  const loadSlotRaw = import.meta.env.VITE_LOAD_SLOT;
  if (loadSlotRaw) {
    const slot = parseInt(loadSlotRaw, 10);
    if (Number.isFinite(slot) && slot >= 1 && slot <= 3) {
      const raw = localStorage.getItem(`sw_game_slot${slot}`);
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          const world = worldFromSceneKey(saved.currentMap)
                     ?? worldFromSceneKey(saved.gameDef?.startScene);
          if (world) return world;
        } catch { /* fall through */ }
      }
    }
  }

  return null;
}
