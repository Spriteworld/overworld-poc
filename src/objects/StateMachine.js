/**
 * https://github.com/ourcade/sidescrolling-platformer-template-phaser3/blob/master/src/statemachine/StateMachine.ts
 */

let idCount = 0;

export default class StateMachine {
  constructor(context, id) {
    this.id = id ?? (++idCount).toString();
    this.context = context;
    this.states = new Map();

    this.previousState = null;
    this.currentState = null;
    this.isChangingState = false;
    this.changingStateQueue = [];
  }

  isCurrentState(name) {
    if (!this.currentState) {
      return false;
    }

    return this.currentState.name === name;
  }

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
    if (this.context.scene.game.config.debug.stateMachine) {
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
