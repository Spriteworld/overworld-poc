import { Character } from '@Objects';

export default class extends Character {
  constructor(config) {
    config.type = 'pkmn';
    config.properties = [];
    config.properties.push(config.scene.addPropertyToTile(
      config, 'text', config.text
    ));    
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
      .addState(this.stateDef.JUMP_LEDGE, {
        onEnter: this.jumpLedgeOnEnter,
        onUpdate: this.jumpLedgeOnUpdate,
        onExit: this.jumpLedgeOnExit,
      })
      .setState(this.stateDef.IDLE)
    ;

    this.setOrigin(0.5, 0.5);
  }

  update(time, delta) {
    if (!this.config.scene.ge_init) { return; }
    this.stateMachine.update(time);
    this.canSeeCharacter();
    this.canTrackPlayer();
    this.addAutoSpin(delta);
    this.addAutoMove();

    if (this.trackingCoords && this.trackingCoords.length){
      if (this.isMoving()) {
        this.generateTrackingCoords();
      }
    }
  }
}
