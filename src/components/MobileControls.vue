<template>
  <div
    class="flex items-center justify-around w-full bg-zinc-900 border-t border-zinc-800"
    style="touch-action: none; user-select: none; padding: 8px 20px; padding-bottom: max(8px, env(safe-area-inset-bottom));"
  >
    <!-- D-Pad -->
    <div style="display: grid; grid-template-columns: repeat(3, 44px); grid-template-rows: repeat(3, 44px); gap: 2px;">
      <div></div>
      <button class="dpad-btn rounded-t-lg" v-on="handlers('ArrowUp')">▲</button>
      <div></div>
      <button class="dpad-btn rounded-l-lg" v-on="handlers('ArrowLeft')">◀</button>
      <div class="dpad-center"></div>
      <button class="dpad-btn rounded-r-lg" v-on="handlers('ArrowRight')">▶</button>
      <div></div>
      <button class="dpad-btn rounded-b-lg" v-on="handlers('ArrowDown')">▼</button>
      <div></div>
    </div>

    <!-- Select / Start -->
    <div class="flex flex-col gap-3 items-center">
      <button class="sys-btn">SEL</button>
      <button class="sys-btn" v-on="handlers('Enter')">STA</button>
    </div>

    <!-- B / A -->
    <div style="position: relative; width: 110px; height: 110px;">
      <button
        class="action-btn"
        style="position: absolute; width: 48px; height: 48px; bottom: 0; left: 0; font-size: 1rem;"
        v-on="handlers('x')"
      >B</button>
      <button
        class="action-btn"
        style="position: absolute; width: 56px; height: 56px; top: 0; right: 0; font-size: 1.125rem;"
        v-on="handlers('z')"
      >A</button>
    </div>
  </div>
</template>

<script>
const KEY_CODES = {
  ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40,
  z: 90, x: 88, Enter: 13,
};

const KEY_CODE_STR = {
  ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
  ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown',
  z: 'KeyZ', x: 'KeyX', Enter: 'Enter',
  w: 'ArrowUp', a: 'ArrowLeft', s: 'ArrowDown', d: 'ArrowRight',
};

export default {
  name: 'MobileControls',
  methods: {
    press(key) {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key, code: KEY_CODE_STR[key], keyCode: KEY_CODES[key], bubbles: true, cancelable: true,
      }));
    },
    release(key) {
      window.dispatchEvent(new KeyboardEvent('keyup', {
        key, code: KEY_CODE_STR[key], keyCode: KEY_CODES[key], bubbles: true,
      }));
    },
    handlers(key) {
      return {
        touchstart: (e) => { e.preventDefault(); this.press(key); },
        touchend:   (e) => { e.preventDefault(); this.release(key); },
        touchcancel:(e) => { e.preventDefault(); this.release(key); },
        mousedown:  ()  => this.press(key),
        mouseup:    ()  => this.release(key),
        mouseleave: ()  => this.release(key),
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
