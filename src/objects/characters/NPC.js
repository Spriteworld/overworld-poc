import Character from '@Objects/characters/Character.js';

export default class extends Character {
  /**
   * An overworld NPC character. Automatically registers IDLE, MOVE, BIKE, SPIN,
   * and SLIDE states, and starts in the IDLE state.
   * @param {object} config - Character configuration (see Character constructor).
   */
  constructor(config) {
    config.type = 'npc';
    super(config);

    this.stateMachine
      .addState(this.stateDef.IDLE, {
        onEnter: this.idleOnEnter,
        onUpdate: this.npcIdleOnUpdate,
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

  /**
   * Per-frame update. Runs the state machine, line-of-sight checks, player
   * tracking, and auto-behaviours once GridEngine is ready.
   * @param {number} time - Current game time in ms.
   * @param {number} delta - Time since last frame in ms.
   */
  update(time, delta) {
    if (!this.config.scene.ge_init) { return; }
    this.stateMachine.update(time);
    if (this.initalCreation) {
      this.applyInitialFacing();
    }
    // Static NPCs (no spin / move / follow / sight / tracking) skip the
    // entire auto-behavior pipeline. _hasUpdateWork is refreshed in the
    // Character constructor and in setMovementBehavior.
    if (!this._hasUpdateWork) return;
    this.canSeeCharacter();
    this.canTrackPlayer();
    this.addAutoSpin(delta);
    this.addAutoMove();
    this.addAutoFollow();
    // Pyramid regenerates lazily in canTrackPlayer when _trackingCoordsStale
    // is flipped by a positionChangeStarted subscription on this NPC.
  }
}
