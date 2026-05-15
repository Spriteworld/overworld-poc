import { gameState } from '@Data/gameState.js';
import store from '../../store/index.js';
import { applyRareCandy } from '@Data/items/rareCandyEffect.js';
import { Pokedex, getSpeciesDisplayName } from '@spriteworld/pokemon-data';
import { getGameDef } from '@Data/gameDef.js';
import {
  SX, SY, SW, SH, PAD,
  TEXT_STYLE, TEXT_STYLE_BOLD, TEXT_STYLE_BODY, TEXT_STYLE_HINT, TEXT_STYLE_SM,
} from './layout.js';

import { resolveItemId } from '@Data/itemDefs.js';

let _itemEffects;
function getItemEffects() {
  if (!_itemEffects) _itemEffects = { [resolveItemId('Rare Candy')]: applyRareCandy };
  return _itemEffects;
}

const ROW_H   = 44;
const START_Y = SY + 52;

export default class BagTeamPickScreen {
  constructor(menu) {
    this.menu   = menu;
    this.cursor = 0;
  }

  _party() {
    return gameState.party.filter(Boolean);
  }

  build() {
    const { scene, reg } = this.menu;
    const useItem  = this.menu.pendingUseItem;
    const itemLabel = useItem?.label ?? useItem;
    const party    = this._party();

    if (!this.menu.dex) this.menu.dex = new Pokedex(getGameDef().game);
    const dex = this.menu.dex;

    reg(scene.add.text(SX + PAD, SY + 4, `USE ${itemLabel.toUpperCase()}`, TEXT_STYLE_BOLD));
    reg(scene.add.text(SX + PAD, SY + 26, 'Choose a Pokémon', TEXT_STYLE_BODY));

    party.forEach((mon, i) => {
      const y          = START_Y + i * ROW_H;
      const isSelected = i === this.cursor;
      const entry      = dex.getPokemonById(mon.species);
      const name       = entry ? getSpeciesDisplayName(entry).toUpperCase() : `#${mon.species}`;
      const fainted    = (mon.currentHp ?? 1) <= 0;
      const color      = fainted ? '#888888' : '#181818';

      // Slot background
      const g = scene.add.graphics();
      g.fillStyle(isSelected ? 0xddeeff : 0xf0f0f0, 1);
      g.fillRoundedRect(SX + PAD, y, SW - PAD * 2, ROW_H - 4, 4);
      if (isSelected) {
        g.lineStyle(2, 0x3399ff, 1);
        g.strokeRoundedRect(SX + PAD, y, SW - PAD * 2, ROW_H - 4, 4);
      }
      reg(g);

      reg(scene.add.text(SX + PAD + 10, y + 6, `${name}  Lv.${mon.level}`, { ...TEXT_STYLE_BOLD, color }));
      reg(scene.add.text(SX + PAD + 10, y + 24,
        fainted ? 'Fainted' : `HP ${mon.currentHp ?? '?'} / ?`,
        { ...TEXT_STYLE_SM, color: fainted ? '#cc0000' : '#555555' }
      ));
    });

    reg(scene.add.text(SX + SW - 16, SY + SH - 32, '▲▼ choose   Z  use   X  back', TEXT_STYLE_HINT)).setOrigin(1, 0);
  }

  nav(delta) {
    const len   = this._party().length;
    this.cursor = Math.max(0, Math.min(len - 1, this.cursor + delta));
    this.menu._clearSubTexts();
    this.build();
  }

  confirm() {
    const party   = this._party();
    const mon     = party[this.cursor];
    const useItem = this.menu.pendingUseItem;
    const itemId  = useItem?.id ?? useItem;
    const effect  = getItemEffects()[itemId];

    if (!mon || !effect) return;

    const result = effect(mon);

    if (!result.success) {
      this.menu.scene.game.events.emit('toast', result.message);
      return;
    }

    store.commit('party/APPLY_RARE_CANDY', {
      pid:                 mon.pid,
      newLevel:            result.newLevel,
      newExp:              result.newExp,
      readyToEvolve:       result.readyToEvolve,
      newMoves:            result.newMoves,
      pendingMovesToLearn: result.pendingMovesToLearn,
    });
    store.commit('bag/USE_ITEM', itemId);

    // Show level-up toast.
    const entry    = this.menu.dex?.getPokemonById(mon.species);
    const monName  = entry ? getSpeciesDisplayName(entry) : `Pokémon`;
    this.menu.scene.game.events.emit('toast', `${monName} ${result.message}`);

    // If evolution triggered, signal OverworldUI to launch EvolutionScene.
    if (result.readyToEvolve != null) {
      this.menu.scene.game.events.emit('overworld-item-result', {
        pid:           mon.pid,
        readyToEvolve: result.readyToEvolve,
      });
    }

    // Reset and return to bag.
    this.menu.pendingUseItem = null;
    this.cursor              = 0;
    this.menu._transitionTo('bag');
  }
}
