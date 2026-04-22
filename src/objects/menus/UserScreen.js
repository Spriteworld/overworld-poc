import { gameState, getPlaytime, saveGame } from '@Data/gameState.js';
import store from '../../store/index.js';
import { formatTid } from '@Utilities';
import { multiplayerClient } from '@/multiplayer/Client.js';
import { SX, SY, SH, TEXT_STYLE_BOLD, TEXT_STYLE_BODY, TEXT_STYLE_HINT } from './layout.js';

const MAX_NAME_LEN = 10;

export default class UserScreen {
  constructor(menu) {
    this.menu = menu;
  }

  build() {
    const { scene, reg } = this.menu;

    const secs = Math.floor(getPlaytime());
    const h    = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m    = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s    = (secs % 60).toString().padStart(2, '0');
    const map  = this.menu.scene.registry.get('map') ?? gameState.currentMap;

    const lines = [
      gameState.game.playerName.toUpperCase(),
      '',
      `ID No.:    ${formatTid(gameState.game.trainerId)}`,
      `Playtime:  ${h}:${m}:${s}`,
      `Location:  ${map}`,
    ];

    lines.forEach((line, i) => {
      const style = i === 0 ? TEXT_STYLE_BOLD : TEXT_STYLE_BODY;
      reg(scene.add.text(SX + 16, SY + 16 + i * 22, line, style));
    });

    reg(scene.add.text(SX + 16, SY + SH - 22, 'Z  rename   X  back', TEXT_STYLE_HINT));
  }

  /**
   * Confirm = open a native prompt to rename the trainer. Persists to the
   * active save slot immediately and rebuilds the panel so the new name
   * shows without closing the menu.
   */
  confirm() {
    const current = store.state.game.playerName ?? '';
    const raw = typeof window !== 'undefined'
      ? window.prompt('New trainer name:', current)
      : null;
    if (raw == null) return; // cancelled
    const trimmed = raw.trim().slice(0, MAX_NAME_LEN);
    if (!trimmed || trimmed === current) return;

    store.state.game.playerName = trimmed;
    saveGame(); // writes sw_game_slot<activeSlot> synchronously

    // Push to the relay so peers see the new name without us reconnecting.
    // No-op if we're offline.
    multiplayerClient.updateProfile({ name: trimmed });

    this.menu._clearSubTexts();
    this.build();
  }
}
