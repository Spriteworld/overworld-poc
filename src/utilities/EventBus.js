import Phaser from 'phaser';

// Used to emit events between components, HTML and Phaser scenes
const EventBus = new Phaser.Events.EventEmitter();

export { EventBus };