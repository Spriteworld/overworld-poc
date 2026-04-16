import { playBgm, playSfx, stopByKey, stopAll, lazyLoadBgm, stopBgm } from '../../utilities/AudioManager.js';

export default {
  play_sound(runner, cmd) {
    const channel = cmd.channel ?? 'sfx';
    if (channel === 'bgm') {
      playBgm(runner._scene, cmd.key, cmd.loop ?? true);
    } else {
      playSfx(runner._scene, cmd.key, cmd.loop ?? false);
    }
    runner._step();
  },

  stop_sound(runner, cmd) {
    if (cmd.key) {
      stopByKey(runner._scene, cmd.key);
    } else {
      stopAll(runner._scene);
    }
    runner._step();
  },

  bgm_start(runner, cmd) {
    lazyLoadBgm(runner._scene, cmd.key, cmd.loop ?? true);
    runner._step();
  },

  bgm_stop(runner) {
    stopBgm();
    runner._step();
  },
};
