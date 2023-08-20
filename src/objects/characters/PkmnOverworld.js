import { Character } from '@Objects';

export default class extends Character {
  constructor(config) {
    config.type = 'pkmn';
    super(config);
    this.config = config;

    this.stateMachine
      .addState(this.stateDef.IDLE, {
        onEnter: this.idleOnEnter,
        onUpdate: this.idleOnUpdate,
        onExit: this.idleOnExit,
      })
      .addState(this.stateDef.MOVE, {
        onEnter: this.moveOnEnter,
        onUpdate: this.moveOnUpdate,
        onExit: this.moveOnExit,
      })
      .setState(this.stateDef.IDLE)
    ;

    this.setOrigin(0.5, 0.5);
  }

  update(time, delta) {
    if (!this.config.scene.ge_init) { return; }
    this.stateMachine.update(time);
    this.addAutoSpin(delta);
    this.addAutoMove();
  }
}
