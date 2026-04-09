/**
 * https://github.com/ourcade/sidescrolling-platformer-template-phaser3/blob/master/src/statemachine/StateMachine.ts
 */

let idCount = 0;

export default class StateMachine {
  /**
   * @param {object} context - The object that owns this state machine; state callbacks are bound to it.
   * @param {string} [id] - Optional identifier used in debug logs; auto-incremented if omitted.
   */
  constructor(context, id) {
    this.id = id ?? (++idCount).toString();
    this.context = context;
    this.states = new Map();

    this.previousState = null;
    this.currentState = null;
    this.isChangingState = false;
    this.changingStateQueue = [];
  }

  /**
   * Returns true if the machine is currently in the named state.
   * @param {string} name - State name to test.
   * @returns {boolean}
   */
  isCurrentState(name) {
    if (!this.currentState) {
      return false;
    }

    return this.currentState.name === name;
  }

  /**
   * Register a new state with optional lifecycle callbacks.
   * All callbacks are bound to the context passed to the constructor.
   * @param {string} name - Unique state identifier.
   * @param {object} [config={}] - Lifecycle hooks.
   * @param {Function} [config.onEnter] - Called when entering this state.
   * @param {Function} [config.onUpdate] - Called every update tick while in this state.
   * @param {Function} [config.onExit] - Called when leaving this state.
   * @returns {StateMachine} This instance, for chaining.
   */
  addState(name, config = {}) {
    const context = this.context;

    this.states.set(name, {
      name,
      onEnter: config.onEnter ? config.onEnter.bind(context) : null,
      onUpdate: config.onUpdate ? config.onUpdate.bind(context) : null,
      onExit: config.onExit ? config.onExit.bind(context) : null
    });

    return this;
  }

  /**
   * Transition to the named state. If a transition is already in progress,
   * the request is queued and applied on the next update.
   * @param {string} name - Name of the state to transition to.
   */
  setState(name) {
    if (!this.states.has(name)) {
      console.log(`[StateMachine (${this.id})] Tried to change to unknown state: ${name}`);
      return;
    }

    if (this.isCurrentState(name)) {
      console.log(`[StateMachine (${this.id})] Tried to set state to the current state`);
      return;
    }

    if (this.isChangingState) {
      this.changingStateQueue.push(name);
      return;
    }

    this.isChangingState = true;
    if (this.context.scene?.game?.config?.debug?.stateMachine) {
      console.log(`[StateMachine (${this.id})] change from ${this.currentState?.name ?? 'none'} to ${name}`);
    }

    if (this.currentState && this.currentState.onExit) {
      this.currentState.onExit();
    }

    this.previousState = this.currentState;
    this.currentState = this.states.get(name);

    if (this.currentState.onEnter) {
      this.currentState.onEnter();
    }

    this.isChangingState = false;
  }

  /**
   * Called each game tick. Flushes any queued state changes then invokes
   * the current state's onUpdate callback.
   * @param {number} dt - Delta time in milliseconds.
   */
  update(dt) {
    if (this.changingStateQueue.length > 0) {
      this.setState(this.changingStateQueue.shift());
      return;
    }

    if (this.currentState && this.currentState.onUpdate) {
      this.currentState.onUpdate();
    }
  }
}
