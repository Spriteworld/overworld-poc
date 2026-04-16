import ChoicePrompt from '../../utilities/ChoicePrompt.js';
import { getInputManager, Action } from '../../utilities/InputManager.js';

export default {
  text(runner, cmd) {
    const text = Array.isArray(cmd.text) ? cmd.text.join('\n') : String(cmd.text ?? '');
    runner._scene.game.events.emit('textbox-changedata', text);
    runner._scene.game.events.once('textbox-disable', () => runner._step());
  },

  yes_no(runner, cmd) {
    const text = Array.isArray(cmd.text) ? cmd.text.join('\n') : String(cmd.text ?? '');
    runner._scene.game.events.once('textbox-ready', () => {
      runner._scene.game.events.emit('textbox-intercept');
      const uiScene = runner._scene.scene.get('OverworldUI');
      new ChoicePrompt(uiScene ?? runner._scene, ['YES', 'NO'], (idx) => {
        runner._scene.game.events.emit('textbox-disable');
        runner._branch(idx === 0 ? (cmd.yes ?? []) : (cmd.no ?? []));
      });
    });
    runner._scene.game.events.emit('textbox-changedata', text);
  },

  wait(runner, cmd) {
    runner._scene.time.delayedCall(cmd.duration ?? 0, () => runner._step());
  },

  wait_input(runner, cmd) {
    const im = getInputManager();
    if (!im) {
      console.warn('[ScriptRunner] wait_input: no InputManager, skipping');
      runner._step();
      return;
    }
    im.once(Action.CONFIRM, () => runner._step());
  },
};
