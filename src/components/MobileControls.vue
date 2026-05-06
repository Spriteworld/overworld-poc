<template>
  <div
    ref="root"
    class="flex items-center justify-around w-full bg-zinc-900 border-t border-zinc-800"
    style="touch-action: none; user-select: none; -webkit-user-select: none; padding: 8px 20px; padding-bottom: max(8px, env(safe-area-inset-bottom));"
  >
    <!-- D-Pad -->
    <div style="display: grid; grid-template-columns: repeat(3, 44px); grid-template-rows: repeat(3, 44px); gap: 2px;">
      <div></div>
      <button class="dpad-btn rounded-t-lg" data-action="up">▲</button>
      <div></div>
      <button class="dpad-btn rounded-l-lg" data-action="left">◀</button>
      <div class="dpad-center"></div>
      <button class="dpad-btn rounded-r-lg" data-action="right">▶</button>
      <div></div>
      <button class="dpad-btn rounded-b-lg" data-action="down">▼</button>
      <div></div>
    </div>

    <!-- Select / Start -->
    <div class="flex flex-col gap-3 items-center">
      <button class="sys-btn">SEL</button>
      <button class="sys-btn" data-action="menu">STA</button>
    </div>

    <!-- B / A -->
    <div style="position: relative; width: 110px; height: 110px;">
      <button
        class="action-btn"
        style="position: absolute; width: 48px; height: 48px; bottom: 0; left: 0; font-size: 1rem;"
        data-action="cancel"
      >B</button>
      <button
        class="action-btn"
        style="position: absolute; width: 56px; height: 56px; top: 0; right: 0; font-size: 1.125rem;"
        data-action="confirm"
      >A</button>
    </div>
  </div>
</template>

<script>
import { getInputManager } from '@Utilities';

export default {
  name: 'MobileControls',

  mounted() {
    const root = this.$refs.root;
    const buttons = root.querySelectorAll('[data-action]');

    const onStart = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const action = e.currentTarget.dataset.action;
      if (!action) return;
      e.currentTarget.classList.add('pressed');
      getInputManager()?.press(action);
    };

    const onEnd = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const action = e.currentTarget.dataset.action;
      if (!action) return;
      e.currentTarget.classList.remove('pressed');
      getInputManager()?.release(action);
    };

    this._cleanups = [];
    for (const btn of buttons) {
      btn.addEventListener('pointerdown', onStart, { passive: false });
      btn.addEventListener('pointerup', onEnd, { passive: false });
      btn.addEventListener('pointercancel', onEnd, { passive: false });
      btn.addEventListener('pointerleave', onEnd, { passive: false });
      this._cleanups.push(() => {
        btn.removeEventListener('pointerdown', onStart);
        btn.removeEventListener('pointerup', onEnd);
        btn.removeEventListener('pointercancel', onEnd);
        btn.removeEventListener('pointerleave', onEnd);
      });
    }
  },

  beforeUnmount() {
    this._cleanups?.forEach(fn => fn());
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
.dpad-btn:active, .dpad-btn.pressed { background: #52525b; }

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
.action-btn:active, .action-btn.pressed { background: #991b1b; }

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
.sys-btn:active, .sys-btn.pressed { background: #52525b; }
</style>
