import store from '../store/index.js';
import { SOUND_REGISTRY } from '../worlds/registry.js';

let _bgm           = null; // active Phaser Sound object for the BGM channel
let _game          = null; // Phaser.Game reference used to register the volume listener once
let _pausedBgm     = null; // { key, loop } — saved when BGM is muted via volume=0
let _intendedBgmKey = null; // most recently requested BGM key — stale filecomplete callbacks are ignored

function _ensureListener(game) {
  if (_game === game) return;
  _game = game;
  game.events.on('bgm-volume-change', (vol) => {
    if (vol === 0) {
      if (_bgm?.isPlaying) {
        _pausedBgm = { key: _bgm.key, loop: _bgm.loop };
        _bgm.stop();
      }
    } else if (_bgm?.isPlaying) {
      _bgm.setVolume(vol / 20);
    }
  });
}

/**
 * Load a BGM file on-demand and play it once loaded.
 * Safe to call at any time (preload phase or after); no-ops if the key is
 * unknown. If the audio is already cached it plays immediately.
 * @param {Phaser.Scene} scene
 * @param {string} key - Key from SOUND_REGISTRY.bgm.
 * @param {boolean} [loop=true]
 */
export function lazyLoadBgm(scene, key, loop = true) {
  if (store.state.game.bgmVolume === 0) return;
  _pausedBgm = null;
  _ensureListener(scene.game);
  const normKey = key?.replace(/\.[^.]+$/, ''); // accept 'pallet' or 'pallet.mp3'
  const url = SOUND_REGISTRY.bgm[normKey];
  if (!url) {
    console.warn(`[AudioManager] bgm key "${key}" not found in SOUND_REGISTRY.bgm. Available keys:`, Object.keys(SOUND_REGISTRY.bgm));
    return;
  }
  _intendedBgmKey = normKey;
  if (scene.cache.audio.has(normKey)) {
    playBgm(scene, normKey, loop);
    return;
  }
  scene.load.audio(normKey, url);
  scene.load.once(`filecomplete-audio-${normKey}`, () => {
    if (_intendedBgmKey === normKey) playBgm(scene, normKey, loop);
  });
  scene.load.start();
}

/** Queue all SE files for loading during a scene's preload phase. Already-cached keys are skipped. No-ops if SFX volume is 0. */
export function preloadSe(scene) {
  if (store.state.game.sfxVolume === 0) return;
  for (const [key, url] of Object.entries(SOUND_REGISTRY.se)) {
    if (!scene.cache.audio.has(key)) {
      scene.load.audio(key, url);
    }
  }
}

export function playBgm(scene, key, loop = true) {
  if (store.state.game.bgmVolume === 0) return;
  _ensureListener(scene.game);
  if (!scene.cache.audio.has(key)) return;
  if (_bgm) {
    try { _bgm.stop(); } catch (_) {}
    try { _bgm.destroy(); } catch (_) {}
    _bgm = null;
  }
  const sound = scene.sound.add(key, { loop, volume: store.state.game.bgmVolume / 20 });
  sound.play();
  _bgm = sound;
  // Stop and destroy the sound when this scene shuts down so it doesn't
  // keep playing as an orphan while the next scene loads.
  scene.events.once('shutdown', () => {
    try { sound.stop(); } catch (_) {}
    try { sound.destroy(); } catch (_) {}
    if (_bgm === sound) _bgm = null;
  });
  return _bgm;
}

export function playSfx(scene, key, loop = false) {
  if (store.state.game.sfxVolume === 0) return;
  if (!scene.cache.audio.has(key)) return;
  return scene.sound.play(key, { loop, volume: store.state.game.sfxVolume / 20 });
}

export function stopBgm() {
  _pausedBgm = null;
  if (_bgm) _bgm.stop();
}

export function resumeBgm(scene) {
  if (!_pausedBgm) return;
  const { key, loop } = _pausedBgm;
  _pausedBgm = null;
  lazyLoadBgm(scene, key, loop);
}

export function stopSfx(scene) {
  scene.sound.sounds
    .filter(s => s !== _bgm)
    .forEach(s => s.stop());
}

export function stopByKey(scene, key) {
  scene.sound.stopByKey(key);
  if (_bgm?.key === key) _bgm = null;
}

export function stopAll(scene) {
  scene.sound.stopAll();
  _bgm = null;
}
