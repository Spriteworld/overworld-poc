export default {
  objects: true,
  grid: false,
  time: true,
  nighttimeLightsOnly: true,
  inspector: false,
  stateMachine: {
    console: false,
  },
  functions: {
    preload: false,
    gameMap: false,
    timeOverlay: false,
    outlineColliders: false,
    rectOutlines: !false,
    playerTracking: !false,
    interactables: {
      player: false,
      npc: false,
      pokemon: false,
      sign: false,
      slideTile: false,
      spinTile: false,
      warp: false,
      light: false,
      cutTree: false,
    },
  },
};
