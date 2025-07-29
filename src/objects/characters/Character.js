import Phaser from 'phaser';
import StateMachine from '@Objects/StateMachine';
import MovableSprite from '@Objects/characters/MovableSprite';
import { Tile, Direction } from '@Objects';

export default class extends MovableSprite {
  constructor(config) {
    config = {...{
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
      'can-run': true,
      'ignore-warp': false,
      'track-player': false,
      'track-player-radius': 2,
    }, ...config};
    super(config);
    this.config = config;

    this.rectColor = {
      normal: 0x1d7196,
      selected: 0xff0000
    };

    if (this.config.scene.characters.get(this.config.id)) {
      this.config.id = (Math.random() + 1).toString(36).substring(7);
    }

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

    this.stateMachine = new StateMachine(this, this.config.id);
    this.initalCreation = true;
    this.spinRate = parseInt(this.config['spin-rate']);
    
    this.config.scene.add.existing(this);
    this.config.scene.addCharacter(this);

    this.initSeenRadius(identification);
    this.initTrackingRadius(identification);
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

  setState(state) {
    this.stateMachine.setState(state);
  }

  initSeenRadius(identification) {
    this.seenRect = this.config.scene.add.rectangle(
      this.config.x * Tile.WIDTH, this.config.y * Tile.HEIGHT,
      0, 0,
      this.rectColor.normal,
      this.scene.game.config.debug.tests.rectOutlines ? 0.4 : 0
    );
    this.characterRect = this.config.scene.add.rectangle(
      this.config.x * Tile.WIDTH, this.config.y * Tile.HEIGHT,
      30, 30,
      this.rectColor.normal,
      this.scene.game.config.debug.tests.rectOutlines ? 0.5 : 0
    );

    this.seenRect.setOrigin(0, 0);
    this.seenRect.setName(identification+'-seen');
    this.characterRect.setOrigin(0, 0);
    this.characterRect.setName(identification+'-character');
  }

  initTrackingRadius() {
    if (typeof this.config['track-player'] === 'undefined' 
        && typeof this.config['avoid-character'] === 'undefined') { return; }
        
    if (this.config['track-player'] === false
        && this.config['avoid-character'] === false) { return; }

    this.trackingCoords = [];
  }

  idleOnEnter() {
    const { space } = this.config.scene.input.keyboard.createCursorKeys();
    this.spinningDir = null;
    this.slidingDir = null;
    this.jumpingDir = null;
    if (this.config.type === 'player') {
      // space.on('down', () => { this.stateMachine.setState(this.stateDef.JUMP); });
    }
  }
  idleOnExit() {}

  idleOnUpdate() {
    const { left, right, up, down } = this.config.scene.input.keyboard.createCursorKeys();

    if (left.isDown || right.isDown || up.isDown || down.isDown) {
      this.stateMachine.setState(this.stateDef.MOVE);
    }
    this.updateCharacterRect();
  }

  moveOnUpdate() {}
  moveOnExit() {
    this.updateCharacterRect();
  }

  updateCharacterRect() {
    let character = this.config.scene.characters.get(this.config.id);
    if (!character) {
      return;
    }
    let characterBounds = character.getBounds();

    this.characterRect.x = (characterBounds.x+1) +
      (character.config.type === 'pkmn' ? 16 : 0);
    this.characterRect.y = (characterBounds.y+1) +
      (character.config.type === 'pkmn' ? 32 : 8);
  }

  handleMove(dir) {
    const duration = 150;
    const keys = this.config.scene.input.keyboard.createCursorKeys();

    dir = dir.toLowerCase();
    if (this.getFacingDirection() === dir) {
      // console.log('Character::handleMove..', dir);
      this.move(dir);
    } else {
      // console.log('Character::handleMove', dir);
      keys[dir].getDuration() >= duration
        ? this.move(dir)
        : this.look(dir);
    }
  }

  spinOnEnter() {
    this.gridengine.setWalkingAnimationMapping(this.config.id, undefined);
    this.anims.play(this.config.texture + '-spin');
    this.spinningDir = this.getFacingDirection();
  }
  spinOnUpdate() {
    if (!this.isSpinning()) { return; }
    this.move(this.spinningDir);
  }
  spinOnExit() {
    this.gridengine.setWalkingAnimationMapping(this.config.id, this.characterFramesDef());
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
    this.gridengine.setWalkingAnimationMapping(this.config.id, this.characterFramesStaticDef());
    this.slidingDir = this.getFacingDirection();
  }
  slideOnUpdate() {
    if (!this.isSliding()) { return; }
    this.move(this.slidingDir);
  }
  slideOnExit() {
    this.gridengine.setWalkingAnimationMapping(this.config.id, this.characterFramesDef());
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
    this.gridengine.moveRandomly(this.config.id, this.config['move-rate'], 1);
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

    if (this.config.spin !== true && this.config['spin-rate'] && delta) { return; }
    this.spinRate -= delta;
    if (this.spinRate <= 0) {
      this.spinRate = parseInt(this.config['spin-rate']);

      let directions = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];
      let dir = Phaser.Math.RND.pick(directions);

      if (this.scene.game.config.debug.console.character) {
        console.log('Character::addAutoSpin', this.config.id, 'looking at', dir);
      }
      this.look(dir.toLowerCase());
    }
  }

  stopSpin(restart=false) {
    this.config.spin = false;

    if (restart) {
      this.scene.game.events.on('textbox-disable', () => this.startSpin());
    }
  }

  startSpin() {
    this.config.spin = true;
  }

  generateTrackingCoords() {
    let radius = this.config['track-player-radius'] || 2;
    this.trackingCoords = [];
    let npcBounds = this.getBounds();
    let pyramidCount = [1,3,5,7,9,11,13,15,17,19,21,23,25,27,29];

    let npcCoords = { 
      x: parseInt(npcBounds.x / Tile.WIDTH), 
      y: parseInt(npcBounds.y / Tile.HEIGHT)
    };

    // top pyramid
    npcCoords.x -= 1;
    for (let i=0; i<radius; i++) {
      let coord = {...npcCoords};
      coord.x -= i;
      coord.y -= i;

      for (let j=0; j<pyramidCount[i]; j++) {
        coord.x += 1;
        
        this.trackingCoords.push({x: coord.x, y: coord.y, dir: 'up'});
        if (!this.isMoving() && this.scene.game.config.debug.tests.rectOutlines) {
          let tile = this.config.scene.add.rectangle(
            coord.x * Tile.WIDTH, (coord.y * Tile.HEIGHT),
            Tile.WIDTH, Tile.HEIGHT,
            this.rectColor.normal,
            0.5
          );
          tile.setOrigin(0,0);
        }
      }
    }

    // bottom pyramid
    npcCoords.x += 2;
    npcCoords.y += 2;
    for (let i=0; i<radius; i++) {
      let coord = {...npcCoords};
      coord.x += i;
      coord.y += i;

      for (let j=0; j<pyramidCount[i]; j++) {
        coord.x -= 1;
        
        this.trackingCoords.push({x: coord.x, y: coord.y, dir: 'down'});
        if (!this.isMoving() && this.scene.game.config.debug.tests.rectOutlines) {
          let tile = this.config.scene.add.rectangle(
            coord.x * Tile.WIDTH, (coord.y * Tile.HEIGHT),
            Tile.WIDTH, Tile.HEIGHT,
            this.rectColor.normal,
            0.5
          );
          tile.setOrigin(0,0);
        }
      }
    }

    // right pyramid
    npcCoords.y -= 2;
    for (let i=0; i<radius; i++) {
      let coord = {...npcCoords};
      coord.x += i;
      coord.y -= i;

      for (let j=0; j<pyramidCount[i]; j++) {
        coord.y += 1;
        
        this.trackingCoords.push({x: coord.x, y: coord.y, dir: 'right'});
        if (!this.isMoving() && this.scene.game.config.debug.tests.rectOutlines) {
          let tile = this.config.scene.add.rectangle(
            coord.x * Tile.WIDTH, (coord.y * Tile.HEIGHT),
            Tile.WIDTH, Tile.HEIGHT,
            this.rectColor.normal,
            0.5
          );
          tile.setOrigin(0,0);
        }
      }
    }

    // left pyramid
    npcCoords.x -= 2;
    for (let i=0; i<radius; i++) {
      let coord = {...npcCoords};
      coord.x -= i;
      coord.y -= i;

      for (let j=0; j<pyramidCount[i]; j++) {
        coord.y += 1;
        
        this.trackingCoords.push({x: coord.x, y: coord.y, dir: 'left'});
        if (!this.isMoving() && this.scene.game.config.debug.tests.rectOutlines) {
          let tile = this.config.scene.add.rectangle(
            coord.x * Tile.WIDTH, (coord.y * Tile.HEIGHT),
            Tile.WIDTH, Tile.HEIGHT,
            this.rectColor.normal,
            0.5
          );
          tile.setOrigin(0,0);
        }
      }
    }
  }

  canTrackPlayer() {
    if (this.config['track-player'] === false 
      && this.config['avoid-character'] === false) { 
      return; 
    }
    let radius = this.config['track-player-radius'] || 2;

    let player = this.config.scene.mapPlugins['player'].player;
    let playerPos = player.getPosition();
    
    if (this.trackingCoords.length === 0) {
      // this.scene.mapPlugins['debug'].debugObject(this, radius);
      this.generateTrackingCoords();
    }

    let coord = Object
      .values(this.trackingCoords)
      .find((coord) => {
        if (coord.x === parseInt(playerPos.x) && coord.y === parseInt(playerPos.y)) {
          return true;
        }
      })
    ;

    if (coord) {
      console.log(['Character::canTrackPlayer', this.config.id +' can track the player!', coord.dir]);
      if (typeof this.config['event-can-see-character'] === 'function') {
        console.log(['Character::canTrackPlayer', this.config.id, 'event-can-see-character', coord.dir]);
        this.config['event-can-see-character'](this.config.id, coord.dir);
      }
      this.look(coord.dir);
    }
  }

  canSeeCharacter() {
    if (this.config['seen-radius'] === 0) { return; }
    if (
      this.config['seen-character'] === null 
        || this.config['seen-character'] === undefined 
        || this.config['seen-character'].length === 0
    ) { 
      return; 
    }

    if (!this.gridengine.hasCharacter(this.config['seen-character'])) {
      if (this.scene.game.config.debug.tests.rectOutlines) {
        console.log('GridEngine doesnt know about character: ', this.config['seen-character'], this.config.id);
      }
      return;
    }

    let character = this.config.scene.characters.get(this.config['seen-character']);
    if (typeof character === 'undefined') {
      if (this.scene.game.config.debug.tests.rectOutlines) {
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

      var check = [
        this.config.scene.isCharacterOnTile(tile.x, tile.y),
        this.gridengine.isBlocked(tile),
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
    let seenRadiusInTiles = seenRadiusOverride * Tile.WIDTH;

    // calc the actual seen box
    switch(this.getFacingDirection()) {
      case 'left':
        this.seenRect.x = ((faceDir.x+1) * Tile.WIDTH) - seenRadiusInTiles;
        this.seenRect.y = npcBounds.y + (this.config.type === 'pkmn' ? 30 : 8);
        this.seenRect.width = seenRadiusInTiles;
        this.seenRect.height = Tile.HEIGHT;
      break;

      case 'right':
        this.seenRect.x = faceDir.x * Tile.WIDTH;
        this.seenRect.y = npcBounds.y + (this.config.type === 'pkmn' ? 30 : 8);
        this.seenRect.width = seenRadiusInTiles;
        this.seenRect.height = Tile.HEIGHT;
      break;

      case 'up':
        this.seenRect.x = npcBounds.x + (this.config.type === 'pkmn' ? 15 : 0);
        this.seenRect.y = ((faceDir.y+1) * Tile.HEIGHT) - seenRadiusInTiles;
        this.seenRect.width = Tile.WIDTH;
        this.seenRect.height = seenRadiusInTiles;
      break;

      case 'down':
        this.seenRect.x = npcBounds.x + (this.config.type === 'pkmn' ? 15 : 0);
        this.seenRect.y = faceDir.y * Tile.HEIGHT;
        this.seenRect.width = Tile.WIDTH;
        this.seenRect.height = seenRadiusInTiles;
      break;
    }

    let isInside = Phaser.Geom.Rectangle.ContainsPoint(this.seenRect, character.characterRect);
    if (isInside) {
      console.log(['Character::canSeeCharacter', this.config.id +' can see '+character.config.id+'!']);
      if (typeof this.config['event-can-see-character'] === 'function') {
        console.log(['Character::canSeeCharacter', this.config.id, 'event-can-see-character', coord.dir]);
        this.config['event-can-see-character'](this.config.id, coord.dir);
      }
    }
    this.seenRect.fillColor = isInside
      ? this.rectColor.selected
      : this.rectColor.normal;
  }

}
