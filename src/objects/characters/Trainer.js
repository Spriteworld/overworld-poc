import NPC from '@Objects/characters/NPC.js';

export default class Trainer extends NPC {
  /**
   * An overworld trainer character. Extends NPC but adds a one-shot guard on
   * `canSeeCharacter()` so the sight callback only fires once per encounter,
   * and a `setDefeated()` method that permanently disables further sighting.
   * @param {object} config - Character configuration (see Character/NPC constructor).
   */
  constructor(config) {
    super(config);
    this._spotted = false;

    this.setOrigin(0.5, 0.5);
  }

  /**
   * Override: only calls the parent sight check if this trainer hasn't already
   * spotted the player.  Prevents the callback from re-firing every frame while
   * the player remains in the line-of-sight rectangle.
   */
  canSeeCharacter() {
    if (this._spotted) return;
    super.canSeeCharacter();
  }

  /**
   * Mark this trainer as defeated: prevents any future sighting and disables
   * the line-of-sight radius so the character goes fully passive.
   */
  setDefeated() {
    this._spotted = true;
  }
}
