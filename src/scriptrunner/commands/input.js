export default {
  enable_input(runner) {
    runner._scene.registry.set('player_input', true);
    runner._step();
  },

  disable_input(runner) {
    runner._scene.registry.set('player_input', false);
    runner._step();
  },
};
