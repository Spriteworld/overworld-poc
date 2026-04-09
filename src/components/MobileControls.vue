<template>
  <div
    class="flex items-center justify-around w-full bg-zinc-900 border-t border-zinc-800"
    style="touch-action: none; user-select: none; padding: 8px 20px; padding-bottom: max(8px, env(safe-area-inset-bottom));"
  >
    <!-- D-Pad -->
    <div style="display: grid; grid-template-columns: repeat(3, 44px); grid-template-rows: repeat(3, 44px); gap: 2px;">
      <div></div>
      <button class="dpad-btn rounded-t-lg" v-on="handlers(Action.UP)">▲</button>
      <div></div>
      <button class="dpad-btn rounded-l-lg" v-on="handlers(Action.LEFT)">◀</button>
      <div class="dpad-center"></div>
      <button class="dpad-btn rounded-r-lg" v-on="handlers(Action.RIGHT)">▶</button>
      <div></div>
      <button class="dpad-btn rounded-b-lg" v-on="handlers(Action.DOWN)">▼</button>
      <div></div>
    </div>

    <!-- Select / Start -->
    <div class="flex flex-col gap-3 items-center">
      <button class="sys-btn">SEL</button>
      <button class="sys-btn" v-on="handlers(Action.MENU)">STA</button>
    </div>

    <!-- B / A -->
    <div style="position: relative; width: 110px; height: 110px;">
      <button
        class="action-btn"
        style="position: absolute; width: 48px; height: 48px; bottom: 0; left: 0; font-size: 1rem;"
        v-on="handlers(Action.CANCEL)"
      >B</button>
      <button
        class="action-btn"
        style="position: absolute; width: 56px; height: 56px; top: 0; right: 0; font-size: 1.125rem;"
        v-on="handlers(Action.CONFIRM)"
      >A</button>
    </div>
  </div>
</template>

<script>
import { Action, getInputManager } from '../utilities/InputManager.js';

export default {
  name: 'MobileControls',
  data() {
    return { Action };
  },
  methods: {
    handlers(action) {
      return {
        touchstart:  (e) => { e.preventDefault(); getInputManager()?.press(action); },
        touchend:    (e) => { e.preventDefault(); getInputManager()?.release(action); },
        touchcancel: (e) => { e.preventDefault(); getInputManager()?.release(action); },
        mousedown:   ()  => getInputManager()?.press(action),
        mouseup:     ()  => getInputManager()?.release(action),
        mouseleave:  ()  => getInputManager()?.release(action),
      };
    },
  },
};
</script>

<style scoped>
.dpad-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #3f3f46;
  color: white;
  font-weight: bold;
  font-size: 1rem;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.dpad-btn:active { background: #52525b; }

.dpad-center {
  background: #3f3f46;
  border-radius: 2px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #7f1d1d;
  color: white;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 3px 6px rgba(0,0,0,0.4);
  -webkit-tap-highlight-color: transparent;
}
.action-btn:active { background: #991b1b; }

.sys-btn {
  background: #3f3f46;
  color: #a1a1aa;
  font-size: 10px;
  font-weight: bold;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border-radius: 999px;
  padding: 4px 10px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.sys-btn:active { background: #52525b; }
</style>
