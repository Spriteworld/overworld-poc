import { Character, Tile } from '@Objects';
import { EventBus } from '@Utilities';

export default class extends Character {
  constructor(config) {
    config.type = 'player';
    // config.collides = false;
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

    this.blockedRight = this.scene.add
      .rectangle(0, 0, Tile.WIDTH, Tile.HEIGHT)
      .setFillStyle(0xB81D15, 1)
      .setOrigin(0,0)
      .setDepth(9999999)
      .setName('blocked-right')
    ;
    this.blockedDown = this.scene.add
      .rectangle(0, 0, Tile.WIDTH, Tile.HEIGHT)
      .setFillStyle(0xB81D15, 1)
      .setOrigin(0,0)
      .setDepth(9999999)
      .setName('blocked-down')
    ;
    this.blockedLeft = this.scene.add
      .rectangle(0, 0, Tile.WIDTH, Tile.HEIGHT)
      .setFillStyle(0xB81D15, 1)
      .setOrigin(0,0)
      .setDepth(9999999)
      .setName('blocked-left')
    ;
    this.blockedUp = this.scene.add
      .rectangle(0, 0, Tile.WIDTH, Tile.HEIGHT)
      .setFillStyle(0xB81D15, 1)
      .setOrigin(0,0)
      .setDepth(9999999)
      .setName('blocked-up')
    ;
  }

  update(time, delta) {
    this.stateMachine.update(time);

    if (this.config.scene.game.config.debug.tests.playerBlockers) {
      this.debugBlockers();
    }
  }

  idleOnUpdate() {
    Character.prototype.idleOnUpdate.call(this);
    if (this.config.scene.registry.get('player_input') === false) {
      return;
    }
    const Z = this.config.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    Z.emitOnRepeat = false;

    if (Z.isDown) {
      // this.stateMachine.setState(this.stateDf.IDLE);
      this.handleInteractables();
    }
  }

  moveOnUpdate() {
    if (this.config.scene.registry.get('player_input') === false) {
      return;
    }
    const keys = this.config.scene.input.keyboard.createCursorKeys();
    const X = this.config.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    const C = this.config.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);

    let moveSpeed = 4;
    if (this.config.scene.game.config.gameFlags.has_running_shoes && X.isDown) { moveSpeed = 8; }
    if (this.config.scene.game.config.gameFlags.has_bike && C.isDown) { moveSpeed = 20; }

    this.gridengine.setSpeed(this.config.id, moveSpeed);
    // console.log({
    //   left: keys.left.isDown,
    //   right: keys.right.isDown,
    //   up: keys.up.isDown,
    //   down: keys.down.isDown,
    // })

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
    EventBus.emit('player-move-complete', this);
  }

  disableMovement() {
    // console.log('Player::disableMovement');
    EventBus.emit('debug', 'Player::disableMovement');
    this.config.scene.registry.set('player_input', false);
  }
  
  enableMovement() {
    // console.log('Player::enableMovement');
    EventBus.emit('debug', 'Player::enableMovement');
    this.config.scene.registry.set('player_input', true);
  }

  handleInteractables() {
    let facingTile = this.getPosInFacingDirection();

    // check for interactable tiles
    let interactableTiles = this.scene.registry.get('interactions');
    if (interactableTiles.length === 0) { return; }
    let tile = interactableTiles.find((tile) => {
      return (
        tile.x / Tile.WIDTH === facingTile.x &&
        tile.y / Tile.HEIGHT === facingTile.y
      ) || (
        tile.x === facingTile.x &&
        tile.y === facingTile.y
      );
    });

    if (!tile) { return; }

    let text = null;
    let item = null;
    switch (tile.obj.type) {
      case 'sign':
        let signProps = this.scene.getPropertiesFromTile(tile.obj);
        if (signProps.size === 0) { return; }

        this.config.scene.game.events.emit(
          'textbox-changedata', 
          this.scene.getPropertyFromTile(tile.obj, 'text'), 
          tile.obj
        );
      break;

      case 'pkmn':
      case 'npc':
        text = this.scene.getPropertyFromTile(tile.obj, 'text');
        if (!text) { return; }
        let player = this.scene.characters.get('player');
        let char = this.scene.characters.get(tile.obj.id);
        char.look(player.getOppositeFacingDirection());
        char.stopSpin(true);
        console.log(['Player::handleInteractions', char, this.scene.registry.get('player').name]);
        
        this.scene.registry.set('last-spoke-to', tile.obj.id);
        this.config.scene.game.events.emit(
          'textbox-changedata', 
          text, 
          tile.obj
        );
      break;

      case 'item':
        item = this.scene.getPropertyFromTile(tile.obj, 'item');
        if (!item) { return; }
        
        this.config.scene.game.events.emit(
          'textbox-changedata', 
          `You found a ${item}!`, 
          tile.obj
        );
        this.config.scene.game.events.emit('item-pickup', item);
        this.scene.registry.set('last-spoke-to', tile.obj.id);
        this.config.scene.game.events.once('textbox-disable', () => {
          this.scene.removeInteraction(tile.obj.id);
          let char = this.scene.characters.get(tile.obj.id);
          char.remove();
        });
      break;
      
      case 'cut-tree':
        text = this.scene.getPropertyFromTile(tile.obj, 'text');
        if (!text) { return; }
        
        this.config.scene.game.events.emit(
          'textbox-changedata', 
          text, 
          tile.obj
        );
        this.config.scene.game.events.once('textbox-disable', () => {
          this.scene.removeInteraction(tile.obj.id);
          let char = this.scene.characters.get(tile.obj.id);
          char.remove();
        });
      break;
    }
  }

  debugBlockers() {
    let player = this.config.scene.characters.get(this.config.id);
    let tilePos = {};

    tilePos = this.getPosInDirection('left');
    if (player.gridengine.isBlocked(tilePos)) {
      this.blockedLeft.x = tilePos.x * Tile.WIDTH;
      this.blockedLeft.y = tilePos.y * Tile.WIDTH;
      this.blockedLeft.width = Tile.WIDTH;
      this.blockedLeft.height = Tile.HEIGHT;
      this.blockedLeft.setAlpha(0.5);
    } else {
      this.blockedLeft.x = 0;
      this.blockedLeft.y = 0;
      this.blockedLeft.setAlpha(0);
    }

    tilePos = this.getPosInDirection('up');
    if (player.gridengine.isBlocked(tilePos)) {
      this.blockedUp.x = tilePos.x * Tile.WIDTH;
      this.blockedUp.y = tilePos.y * Tile.WIDTH;
      this.blockedUp.width = Tile.WIDTH;
      this.blockedUp.height = Tile.HEIGHT;
      this.blockedUp.setAlpha(0.5);
    } else {
      this.blockedUp.x = 0;
      this.blockedUp.y = 0;
      this.blockedUp.setAlpha(0);
    }

    tilePos = this.getPosInDirection('right');
    if (player.gridengine.isBlocked(tilePos)) {
      this.blockedRight.x = tilePos.x * Tile.WIDTH;
      this.blockedRight.y = tilePos.y * Tile.WIDTH;
      this.blockedRight.width = Tile.WIDTH;
      this.blockedRight.height = Tile.HEIGHT;
      this.blockedRight.setAlpha(0.5);
    } else {
      this.blockedRight.x = 0;
      this.blockedRight.y = 0;
      this.blockedRight.setAlpha(0);
    }

    tilePos = this.getPosInDirection('down');
    if (player.gridengine.isBlocked(tilePos)) {
      this.blockedDown.x = tilePos.x * Tile.WIDTH;
      this.blockedDown.y = tilePos.y * Tile.WIDTH;
      this.blockedDown.width = Tile.WIDTH;
      this.blockedDown.height = Tile.HEIGHT;
      this.blockedDown.setAlpha(0.5);
    } else {
      this.blockedDown.x = 0;
      this.blockedDown.y = 0;
      this.blockedDown.setAlpha(0);
    }
  }
}
