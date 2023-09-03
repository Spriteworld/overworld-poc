import Phaser from 'phaser';
import StateMachine from '@Objects/StateMachine';
import { Tile, Direction } from '@Objects';
import Debug from '@Data/debug.js';
import { getValue } from '@Utilities';

export default class extends Phaser.GameObjects.Sprite {
  constructor(config) {
    super(config.scene, config.x, config.y, config.texture);
    this.config = {...{
      scene: null,
      id: null,
      spin: false,
      'spin-rate': 600,
      move: false,
      'move-rate': 600,
      'move-radius': 1,
      follow: false,
      collides: true,
      'facing-direction': 'down',
      'seen-radius': 0,
      'seen-character': null,
      'char-layer': 'ground',
      'can-run': true
    }, ...config};
    let identification = (this.config.id ?? this.config.texture);
    this.setName(identification);

    this.stateDef = {
      IDLE: 'idle',
      MOVE: 'move',
      BIKE: 'bike',
      LOOK: 'look',
      SPIN: 'spin',
      SLIDE: 'slide',
      JUMP: 'jump',
      JUMP_LEDGE: 'jump_ledge',
    };

    this.ge = this.config.scene.gridEngine;
    this.stateMachine = new StateMachine(this, this.config.id);
    this.initalCreation = true;
    this.spinRate = this.config['spin-rate'];

    this.config.scene.add.existing(this);
    this.config.scene.addCharacter(this);

    // seen-radius config
    // initSeenRadius(this);
    this.rectColor = {
      normal: 0x1d7196,
      selected: 0xff0000
    };
    this.seenRect = this.config.scene.add.rectangle(
      this.config.x * Tile.WIDTH, this.config.y * Tile.HEIGHT,
      0, 0,
      this.rectColor.normal,
      Debug.functions.characterSeen ? 0.4 : 0
    );
    this.characterRect = this.config.scene.add.rectangle(
      this.config.x * Tile.WIDTH, this.config.y * Tile.HEIGHT,
      30, 30,
      this.rectColor.normal,
      Debug.functions.characterRect ? 0.5 : 0
    );

    this.seenRect.setOrigin(0, 0);
    this.seenRect.setName(identification+'-seen');
    this.characterRect.setOrigin(0, 0);
    this.characterRect.setName(identification+'-character');
  }

  characterFramesDef() {
    return {
      up: { leftFoot: 13, standing: 12, rightFoot: 15 },
      down: { leftFoot: 1, standing: 0, rightFoot: 3 },
      left: { leftFoot: 7, standing: 4, rightFoot: 5 },
      right: { leftFoot: 9, standing: 8, rightFoot: 11 },
    };
  }

  characterFramesStaticDef() {
    return {
      up: { leftFoot: 12, standing: 12, rightFoot: 12 },
      down: { leftFoot: 0, standing: 0, rightFoot: 0 },
      left: { leftFoot: 4, standing: 4, rightFoot: 4 },
      right: { leftFoot: 8, standing: 8, rightFoot: 8 },
    };
  }

  characterDef() {
    let def = this.config;
    return {
      id: def.id,
      sprite: this,
      walkingAnimationMapping: this.characterFramesDef(),
      startPosition: { x: def.x, y: def.y },
      facingDirection: def['facing-direction'] ?? 'down',
      collides: def.collides,
      charLayer: def['char-layer'] ?? 'ground',
    };
  }

  setState(state) {
    this.stateMachine.setState(state);
  }

  idleOnEnter() {
    const { space } = this.config.scene.input.keyboard.createCursorKeys();
    this.spinningDir = null;
    this.slidingDir = null;
    this.jumpingDir = null;
    if (this.config.type === 'player') {
      space.on('down', () => { this.stateMachine.setState(this.stateDef.JUMP); });
    }
  }
  idleOnExit() {}

  idleOnUpdate() {
    const { left, right, up, down } = this.config.scene.input.keyboard.createCursorKeys();

    if (left.isDown || right.isDown || up.isDown || down.isDown) {
      this.stateMachine.setState(this.stateDef.MOVE);
    }
  }

  moveOnUpdate() {}

  handleMove(dir) {
    const duration = 150;
    const keys = this.config.scene.input.keyboard.createCursorKeys();

    dir = dir.toLowerCase();
    if (this.getFacingDirection() === dir) {
      this.move(dir);
    } else {
      keys[dir].getDuration() >= duration
        ? this.move(dir)
        : this.look(dir);
    }
  }

  spinOnEnter() {
    this.ge.setWalkingAnimationMapping(this.config.id, undefined);
    this.anims.play(this.config.texture + '-spin');
    this.spinningDir = this.getFacingDirection();
  }
  spinOnUpdate() {
    if (!this.isSpinning()) { return; }
    this.move(this.spinningDir);
  }
  spinOnExit() {
    this.ge.setWalkingAnimationMapping(this.config.id, this.characterFramesDef());
    this.anims.stop();
    this.spinningDir = null;
  }
  isSpinning() {
    return this.spinningDir !== null;
  }
  getSpinningDirection() {
    return this.spinningDir;
  }
  setSpinDirection(dir) {
    this.look(dir);
    this.spinningDir = dir;
  }

  slideOnEnter() {
    this.ge.setWalkingAnimationMapping(this.config.id, this.characterFramesStaticDef());
    this.slidingDir = this.getFacingDirection();
  }
  slideOnUpdate() {
    if (!this.isSliding()) { return; }
    this.move(this.slidingDir);
  }
  slideOnExit() {
    this.ge.setWalkingAnimationMapping(this.config.id, this.characterFramesDef());
    this.anims.stop();
    this.slidingDir = null;
  }
  isSliding() {
    return this.slidingDir !== null;
  }
  getSlidingDirection() {
    return this.slidingDir;
  }

  jumpOnEnter() {
    console.log('JUMP START');
  }
  jumpOnUpdate() {
    let jumpHeight = Tile.HEIGHT;
    this.config.scene.tweens.add({
      targets: this,
      y: this.getBounds().y - jumpHeight,
      yoyo: true,
      ease: 'linear',
      duration: 320,
      complete: () => {
        this.stateMachine.setState(this.stateDef.IDLE);
      },
    });
  }
  jumpOnExit() {
    console.log('JUMP END');
  }

  jumpLedgeOnEnter() { }
  jumpLedgeOnUpdate() {
    let dir = this.getPosInFacingDirection();
    let faceDir = this.getFacingDirection();
    let bounds = this.getBounds();

    if (faceDir === 'up') {
      dir.y -= 1;
      bounds.y -= (Tile.HEIGHT + (Tile.HEIGHT/4));
    } else
    if (faceDir === 'down') {
      dir.y += 1;
      bounds.y += (Tile.HEIGHT + (Tile.HEIGHT/4));
    } else
    if (faceDir === 'left') {
      dir.x -= 1;
      bounds.x -= (Tile.WIDTH + (Tile.WIDTH/4));
      bounds.y -= (Tile.HEIGHT/4);
    } else
    if (faceDir === 'right') {
      dir.x += 1;
      bounds.x += (Tile.WIDTH + (Tile.WIDTH/4));
      bounds.y -= (Tile.HEIGHT/4);
    }

    this.config.scene.tweens.add({
      targets: this,
      x: bounds.x,
      y: bounds.y,
      repeat: 0,
      ease: 'linear',
      duration: 320,
      active: () => {
        this.moveTo(dir.x, dir.y);
      },
      complete: () => {
        this.stateMachine.setState(this.stateDef.IDLE);
      },
    });
  }
  jumpLedgeOnExit() { }
  isJumping() {
    return this.jumpingDir !== null;
  }

  addAutoMove() {
    if (this.config.move !== true) { return; }
    this.ge.moveRandomly(this.config.id, this.config['move-rate'], 1);
    this.config.move = false;
  }

  addAutoSpin(delta) {
    if (this.initalCreation) {
      let lookDir = this.config['facing-direction'] ?? 'down';
      let faceDir = this.getFacingDirection();

      if (faceDir !== lookDir) {
        this.look(lookDir.toLowerCase());
        return;
      }
      this.initalCreation = !this.initalCreation;
    }

    if (this.config.spin !== true) { return; }
    this.spinRate -= delta;
    if (this.spinRate <= 0) {
      this.spinRate = this.config['spin-rate'];

      let dir = 'down';
      switch (Math.floor(Math.random() * 8) +1) {
        case 1: dir = Direction.UP; break;
        case 2: dir = Direction.DOWN; break;
        case 3: dir = Direction.LEFT; break;
        case 4: dir = Direction.RIGHT; break;
        default: break;
      }
      this.look(dir.toLowerCase());
    }
  }

  stopSpin(restart=false) {
    this.config.spin = false;

    if (restart) {
      let textbox = this.config.scene.scene.get('OverworldUI').textbox;

      textbox.on('complete', () => this.startSpin());
    }
  }

  startSpin() {
    this.config.spin = true;
  }

  canSeeCharacter() {
    if (this.config['seen-radius'] === 0) { return; }
    if (this.config['seen-character'] === null) { return; }
    if (this.config['seen-character'].length === 0) { return; }

    if (!this.ge.hasCharacter(this.config['seen-character'])) {
      if (Debug.functions.characterSeen) {
        console.log(this.config['seen-character'], 'ge doesnt has character');
      }
      return;
    }

    let character = this.config.scene.characters.find(
      char => char.config.id == this.config['seen-character']
    );
    if (typeof character === 'undefined') {
      if (Debug.functions.characterSeen) {
        console.log(character, this.config['seen-character'], 'gamemap doesnt has character');
      }
      return;
    }

    let npcBounds = this.getBounds();
    let faceDir = this.getPosInFacingDirection();
    let tile;

    // find tiles we need to check
    // check for collision objects
    let count = this.config['seen-radius'];
    for (let i=0; i<this.config['seen-radius']; i++) {
      switch(this.getFacingDirection()) {
        case 'left':
          tile = {x: faceDir.x-i, y: faceDir.y};
        break;
        case 'right':
          tile = {x: faceDir.x+i, y: faceDir.y};
        break;
        case 'up':
          tile = {x: faceDir.x, y: faceDir.y-i};
        break;
        case 'down':
          tile = {x: faceDir.x, y: faceDir.y+i};
        break;
      }
      var props = this.scene.getTileProperties(tile.x, tile.y);
      var check = [
        getValue(props, 'ge_collide', false),
        getValue(props, 'ge_collide_left', false),
        getValue(props, 'ge_collide_right', false),
        getValue(props, 'ge_collide_up', false),
        getValue(props, 'ge_collide_down', false),
        getValue(props, 'sw_stop', false),
        getValue(props, 'sw_slide', false),
        getValue(props, 'sw_spin', false),
        getValue(props, 'sw_jump', false),
        // todo: add character checks...shouldnt be able to see thru other characters XD
      ].includes(true);

      if (check) {
        count = i;
        break;
      }
    }

    // count not being the same as the seen-radius
    // means we hit something with a collision on it
    // so just see everything upto that point
    let seenRadiusOverride = count !== this.config['seen-radius']
      ? count
      : this.config['seen-radius']
    ;

    // 32 here is the tile size
    let seenRadiusInTiles = seenRadiusOverride * 32;

    // calc the actual seen box
    switch(this.getFacingDirection()) {
      case 'left':
        this.seenRect.x = ((faceDir.x+1) * Tile.WIDTH) - seenRadiusInTiles;
        this.seenRect.y = npcBounds.y+8;
        this.seenRect.width = seenRadiusInTiles;
        this.seenRect.height = Tile.HEIGHT;
      break;

      case 'right':
        this.seenRect.x = faceDir.x * Tile.WIDTH;
        this.seenRect.y = npcBounds.y+8;
        this.seenRect.width = seenRadiusInTiles;
        this.seenRect.height = Tile.HEIGHT;
      break;

      case 'up':
        this.seenRect.x = npcBounds.x;
        this.seenRect.y = ((faceDir.y+1) * Tile.HEIGHT) - seenRadiusInTiles;
        this.seenRect.width = Tile.WIDTH;
        this.seenRect.height = seenRadiusInTiles;
      break;

      case 'down':
        this.seenRect.x = npcBounds.x;
        this.seenRect.y = faceDir.y * Tile.HEIGHT;
        this.seenRect.width = Tile.WIDTH;
        this.seenRect.height = seenRadiusInTiles;
      break;
    }

    let characterBounds = character.getBounds();

    this.characterRect.x = (characterBounds.x+1) +
      (character.config.type === 'pkmn' ? 16 : 0);
    this.characterRect.y = (characterBounds.y+1) +
      (character.config.type === 'pkmn' ? 32 : 8);

    let isInside = Phaser.Geom.Rectangle.ContainsPoint(this.seenRect, this.characterRect);
    if (isInside) {
      console.log(this.config.id +' can see '+character.config.id+'!');
    }
    this.seenRect.fillColor = isInside
      ? this.rectColor.selected
      : this.rectColor.normal;
  }

  look(dir) {
    return this.ge.turnTowards(this.config.id, dir.toLowerCase());
  }

  lookAt(charId) {
    return this.ge.turnTowards(this.config.id, this.ge.getFacingPosition(charId));
  }

  move(dir) {
    return this.ge.move(this.config.id, dir.toLowerCase());
  }

  moveTo(x, y, config) {
    return this.ge.moveTo(this.config.id, { x: x, y: y }, config);
  }

  stopMovement() {
    return this.ge.stopMovement(this.config.id);
  }

  getFacingDirection() {
    return this.ge.getFacingDirection(this.config.id);
  }

  getFacingTile() {
    let faceDir = this.getPosInFacingDirection();
    return this.scene.getTileProperties(faceDir.x, faceDir.y);
  }

  getPosition() {
    return this.ge.getPosition(this.config.id);
  }

  getPosInFacingDirection() {
    let pos = this.getPosition();
    let dir = this.getFacingDirection();
    if (dir === 'up') {
      return { ...pos, y: pos.y - 1 };
    } else if (dir === 'down') {
      return { ...pos, y: pos.y + 1 };
    } else if (dir === 'left') {
      return { ...pos, x: pos.x - 1 };
    } else if (dir === 'right') {
      return { ...pos, x: pos.x + 1 };
    }
  }

  getPosInBehindDirection() {
    let pos = this.getPosition();
    let dir = this.getFacingDirection();
    if (dir === 'up') {
      return { ...pos, y: pos.y + 1 };
    } else if (dir === 'down') {
      return { ...pos, y: pos.y - 1 };
    } else if (dir === 'left') {
      return { ...pos, x: pos.x + 1 };
    } else if (dir === 'right') {
      return { ...pos, x: pos.x - 1 };
    }
  }
}
