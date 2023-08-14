import { Character } from '@Objects';

export default class extends Character {
  constructor(config) {
    config.type = 'pkmn';
    super(config);

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
      .addState(this.stateDef.BIKE, {
        onEnter: this.bikeOnEnter,
        onUpdate: this.moveOnUpdate,
        onExit: this.bikeOnExit,
      })
      .addState(this.stateDef.SPIN, {
        onEnter: this.spinOnEnter,
        onUpdate: this.spinOnUpdate,
        onExit: this.spinOnExit,
      })
      .addState(this.stateDef.SLIDE, {
        onEnter: this.slideOnEnter,
        onUpdate: this.slideOnUpdate,
        onExit: this.slideOnExit,
      })
      // warp-doors
      // warp-tiles
      // jump-ledges
      // interact-npcs
      // interact-signs
      // item-pickup
      // HM-options
      // water-currents
      .setState(this.stateDef.IDLE)
    ;

    this.setOrigin(0.5, 0.5);
  }

  update(time, delta) {
    this.stateMachine.update(time);
    this.addAutoSpin(delta);
    this.addAutoMove();
    this.canSeeCharacter();
  }
}
