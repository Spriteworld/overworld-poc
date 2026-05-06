import { DEFAULT_MART_ITEMS } from '../../data/itemRegistry.js';
import ChoicePrompt from '../../utilities/ChoicePrompt.js';

export default {
  open_shop(runner, cmd) {
    const items = cmd.items ?? DEFAULT_MART_ITEMS;

    runner._scene.game.events.emit('textbox-changedata', 'How may I help you?');
    runner._scene.game.events.once('textbox-ready', () => {
      runner._scene.game.events.emit('textbox-intercept');
      const uiScene = runner._scene.scene.get('OverworldUI');

      new ChoicePrompt(uiScene ?? runner._scene, ['BUY', 'SELL', 'CANCEL'], (idx) => {
        runner._scene.game.events.emit('textbox-disable');

        if (idx === 0) {
          // BUY
          runner._scene.game.events.emit('shop-open', { items });
          runner._scene.game.events.once('shop-close', () => runner._step());
        } else if (idx === 1) {
          // SELL — not implemented yet
          runner._scene.game.events.emit('textbox-changedata', "I can't do that yet.");
          runner._scene.game.events.once('textbox-disable', () => runner._step());
        } else {
          // CANCEL
          runner._step();
        }
      });
    });
  },
};
