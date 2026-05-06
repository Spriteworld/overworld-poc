export default {
  show_placeable(runner, cmd) {
    const plugin = runner._scene.mapPlugins?.['placeable'];
    if (!plugin) { runner._step(); return; }
    const anchor = cmd.anchor ? runner._resolveAnchor(cmd.anchor) : null;
    const coords = anchor ?? (cmd.x != null ? { x: cmd.x, y: cmd.y } : null);
    plugin.show(cmd.name, coords?.x, coords?.y);
    runner._step();
  },

  hide_placeable(runner, cmd) {
    const plugin = runner._scene.mapPlugins?.['placeable'];
    if (!plugin) { runner._step(); return; }
    plugin.hide(cmd.name);
    runner._step();
  },

  move_placeable(runner, cmd) {
    const plugin = runner._scene.mapPlugins?.['placeable'];
    if (!plugin) { runner._step(); return; }
    const anchor = cmd.anchor ? runner._resolveAnchor(cmd.anchor) : null;
    const coords = anchor ?? { x: cmd.x, y: cmd.y };
    plugin.moveTo(cmd.name, coords.x, coords.y);
    runner._step();
  },
};
