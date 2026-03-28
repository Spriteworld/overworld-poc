import { gameState } from '@Data/gameState.js';
import PokemonSprite from '../PokemonSprite.js';
import PokedexList from '../ui/PokedexList.js';
import {
  SX, SY, SW, SH,
  DEX_LIST_W, DEX_DETAIL_X, DEX_DETAIL_W,
  TEXT_STYLE_BOLD, TEXT_STYLE_HINT,
} from './layout.js';
import { drawMonDetail, getMonDetailTabs } from './MonDetail.js';

export default class PokedexScreen {
  constructor(menu) {
    this.menu   = menu;
    this.list   = new PokedexList();
    this.dexTab = 0;
  }

  reset() {
    this.list.reset();
    this.dexTab = 0;
  }

  // ─── Navigation ──────────────────────────────────────────────────────────

  nav(dir) {
    this.list.nav(dir);
    this.rebuild();
  }

  tabNav(dir) {
    const entry  = this.list.selected;
    if (!entry) return;
    const record = gameState.pokedex[entry.nat_dex_id];
    if (!record?.seen) return;
    const tabs = getMonDetailTabs(null); // dex mode = null mon
    this.dexTab = (this.dexTab + dir + tabs.length) % tabs.length;
    this.rebuild();
  }

  // ─── Build ───────────────────────────────────────────────────────────────

  rebuild() {
    this.menu._clearSubTexts();
    this.build();
    this.menu.reg(this.menu.scene.add.text(SX + 16, SY + SH - 22, 'X  back', TEXT_STYLE_HINT));
  }

  build() {
    const { scene, reg } = this.menu;

    reg(scene.add.text(SX + 16, SY + 14, 'POKÉDEX', TEXT_STYLE_BOLD));

    // ── Divider ────────────────────────────────────────────────────────
    const div = scene.add.graphics();
    div.lineStyle(1, 0xcccccc, 1);
    div.lineBetween(SX + DEX_LIST_W + 16, SY + 36, SX + DEX_LIST_W + 16, SY + SH - 30);
    reg(div);

    // ── List ───────────────────────────────────────────────────────────
    this.list.draw(scene, reg, SX + 16, SY + 40);

    // ── Detail pane ────────────────────────────────────────────────────
    const entry = this.list.selected;
    if (entry) this._buildDetail(entry);
  }

  _buildDetail(entry) {
    const record = gameState.pokedex[entry.nat_dex_id];
    const seen   = !!record?.seen;

    if (seen) {
      drawMonDetail(this.menu, {
        entry,
        x:   DEX_DETAIL_X,
        y:   SY + 36,
        w:   DEX_DETAIL_W,
        h:   SH - 66,
        tab: this.dexTab,
      });
      return;
    }

    // ── Unseen fallback ────────────────────────────────────────────────
    const { scene, reg } = this.menu;
    const dx  = DEX_DETAIL_X;
    const dy  = SY + 36;

    const numStr = `#${String(entry.nat_dex_id).padStart(3, '0')}`;
    reg(scene.add.text(dx, dy, numStr, TEXT_STYLE_HINT));
    reg(scene.add.text(dx + 44, dy, '???', TEXT_STYLE_BOLD));
    reg(new PokemonSprite(scene, dx, dy + 22, { species: 0, size: 80 }));
  }
}
