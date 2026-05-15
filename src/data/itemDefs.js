const _defs = new Map();
const _nameIndex = new Map();
let _defaultMartItems = [];

function _normalize(name) {
  return name.toLowerCase().replace(/[-_\s]/g, '').replace(/[éèê]/g, 'e');
}

export function registerItemDefs({ items, defaultMartItems }) {
  for (const [idStr, entry] of Object.entries(items)) {
    const id = Number(idStr);
    const inst = entry.instance;
    const def = {
      id,
      label:       entry.label ?? inst.getName(),
      category:    entry.category ?? inst.getCategory(),
      price:       entry.price ?? inst.price,
      description: entry.description ?? inst.description,
      cls:         inst.constructor,
      instance:    inst,
    };
    _defs.set(id, def);
    for (const alias of inst.getAliases()) {
      _nameIndex.set(alias, id);
    }
    _nameIndex.set(_normalize(def.label), id);
  }
  if (defaultMartItems) _defaultMartItems = defaultMartItems;
}

export function resolveItemId(nameOrId) {
  if (typeof nameOrId === 'number') return _defs.has(nameOrId) ? nameOrId : null;
  if (typeof nameOrId === 'string') {
    const asNum = Number(nameOrId);
    if (!isNaN(asNum) && _defs.has(asNum)) return asNum;
    return _nameIndex.get(_normalize(nameOrId)) ?? null;
  }
  return null;
}

export function getItemDef(id) {
  return _defs.get(id) ?? null;
}

export function getItemLabel(id) {
  return _defs.get(id)?.label ?? `Item #${id}`;
}

export function getItemPrice(id) {
  return _defs.get(id)?.price ?? 0;
}

export function getItemDescription(id) {
  return _defs.get(id)?.description ?? '';
}

export function getItemCategory(id) {
  return _defs.get(id)?.category ?? 'other';
}

export function isKeyItem(id) {
  return getItemCategory(id) === 'key';
}

const CATEGORY_TO_BAG_LIST = {
  medicine: 'medicine',
  balls:    'pokeballs',
  ball:     'pokeballs',
  tm:       'tms',
  hm:       'tms',
  key:      'keyItems',
};

export function getBagListKey(id) {
  return CATEGORY_TO_BAG_LIST[getItemCategory(id)] ?? 'items';
}

export function getDefaultMartItems() {
  return _defaultMartItems;
}

export function getSellPrice(id) {
  return Math.floor(getItemPrice(id) / 2);
}

export function getBattleItemClass(id) {
  const def = _defs.get(id);
  return def?.cls ?? null;
}

export function buildBattleInventory(bagState) {
  const { items, medicine, pokeballs } = bagState ?? {};
  const battleItems = [];
  for (const entry of [...(items ?? []), ...(medicine ?? []), ...(pokeballs ?? [])]) {
    if (entry.quantity <= 0) continue;
    const BattleCls = getBattleItemClass(entry.id);
    if (!BattleCls) continue;
    battleItems.push({ item: new BattleCls(), quantity: entry.quantity });
  }
  return { items: battleItems, pokeballs: [], tms: [] };
}
