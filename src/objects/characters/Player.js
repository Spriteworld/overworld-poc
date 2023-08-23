import { Character } from '@Objects';

export default class extends Character {
  constructor(config) {
    config.type = 'player';
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
      .addState(this.stateDef.JUMP, {
        onEnter: this.jumpOnEnter,
        onUpdate: this.jumpOnUpdate,
        onExit: this.jumpOnExit,
      })
      .addState(this.stateDef.JUMP_LEDGE, {
        onEnter: this.jumpLedgeOnEnter,
        onUpdate: this.jumpLedgeOnUpdate,
        onExit: this.jumpLedgeOnExit,
      })
      // warp-doors
      // warp-tiles
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
  }

  moveOnUpdate() {
    if (this.config.scene.registry.get('player_input')) {
      return;
    }
    const keys = this.config.scene.input.keyboard.createCursorKeys();
    const X = this.config.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    const C = this.config.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);

    let moveSpeed = 4;
    if (X.isDown) { moveSpeed = 8; }
    if (C.isDown) { moveSpeed = 20; }

    this.ge.setSpeed(this.config.id, moveSpeed);

    if (keys.left.isDown) {
      this.handleMove('left');
    } else if (keys.right.isDown) {
      this.handleMove('right');
    } else if (keys.up.isDown) {
      this.handleMove('up');
    } else if (keys.down.isDown) {
      this.handleMove('down');
    } else {
      this.stateMachine.setState(this.stateDef.IDLE);
    }
  }

  disableMovement() {
    console.log('player::disableMovement');
    this.config.scene.registry.set('player_input', false);
  }

  enableMovement() {
    console.log('player::enableMovement');
    this.config.scene.registry.set('player_input', true);
  }

}
