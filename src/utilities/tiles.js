import Phaser from 'phaser';

function getPropertyValue(props, id, defValue) {
  if (typeof props === 'undefined' || Object.values(props).length === 0) {
    return defValue;
  }
  let property = props.find(p => p.name === id);
  return typeof property === 'undefined' ? defValue : property.value;
}

/**
 * Read the current map's `map-settings['battle-theme']` and return a string
 * suitable for the battle scene's `field.scene` (e.g. 'field', 'cave1',
 * 'forest', 'water', 'indoor1'). Defaults to 'field' when unset so maps
 * that don't opt in get the standard grassy backdrop.
 *
 * @param {Phaser.Scene} scene - the active GameMap scene
 * @returns {string}
 */
function getBattleTheme(scene) {
  const mapProps    = scene?.config?.tilemap?.properties ?? [];
  const mapSettings = getPropertyValue(mapProps, 'map-settings') ?? {};
  return mapSettings['battle-theme'] || 'field';
}

function getValue(obj, value, defValue) {
  return Phaser.Utils.Objects.GetValue(obj, value, defValue);
}

function remapProps(props) {
  let values = {};
  Object.values(props).forEach(prop => {
    values = {...values, ...{ [prop.name]: prop.value }};
  });
  return values;
}

function generateTileCoords(startArea, width=1, height=1) {
  if (typeof startArea === 'undefined' || typeof startArea.x === 'undefined' || typeof startArea.y === 'undefined') {
    console.warn('Invalid start area for tile coords:', startArea);
    return [];
  }
  let x = startArea.x;
  let y = startArea.y;

  let coords = [];
  for (let i = x; i < x + width; i++) {
    for (let j = y; j < y + height; j++) {
      coords.push(Vector2(i, j));
    }
  }
  return coords;
}

function Vector2(x, y) {
  return new Phaser.Math.Vector2(parseInt(x), parseInt(y));
}

/**
 * Apply a compare-op string to two scalar values.
 * For 'in'/'nin', `b` should be an array.
 * @param {*} a
 * @param {'lt'|'lte'|'eq'|'gte'|'gt'|'neq'|'in'|'nin'} op
 * @param {*} b
 * @returns {boolean}
 */
function _compareOp(a, op, b) {
  switch (op) {
    case 'lt':  return a <  b;
    case 'lte': return a <= b;
    case 'eq':  return a === b;
    case 'gte': return a >= b;
    case 'gt':  return a >  b;
    case 'neq': return a !== b;
    case 'in':  return Array.isArray(b) ? b.includes(a) : a === b;
    case 'nin': return Array.isArray(b) ? !b.includes(a) : a !== b;
    default:    return true;
  }
}

/**
 * Evaluate an `only_if` class property against a gameFlags map and optional variant string.
 * Returns true (allow) when the condition passes or is not set.
 *
 * only_if shape: { type, comparison, value: string[] }
 *
 * type='flag' (or omitted) — boolean game-flag checks against gameFlags
 *   value: one or more flag names
 *   eq  → every flag in value is truthy
 *   neq → every flag in value is falsy
 *   in  → at least one flag in value is truthy
 *   nin → none of the flags in value are truthy
 *
 * type='variable' — numeric comparison of a single gameFlag value
 *   value[0]: gameFlags key to read
 *   value[1]: target number to compare against
 *   comparison: any compare-op (lt, lte, eq, gte, gt, neq)
 *
 * type='variant' — match the current scene variant string
 *   value: list of allowed variant strings
 *   eq / in  → scene variant must be in the list
 *   neq / nin → scene variant must not be in the list
 *   variant == null → condition passes (no variant set on this scene)
 *
 * @param {object|null} onlyIf
 * @param {object} gameFlags
 * @param {string|null} [variant=null]
 * @returns {boolean}
 */
function checkOnlyIf(onlyIf, gameFlags = {}, variant = null, mapVars = {}) {
  if (!onlyIf) return true;
  const value = (Array.isArray(onlyIf.value)
    ? onlyIf.value
    : (onlyIf.value != null ? [onlyIf.value] : []))
    .map(v => (v && typeof v === 'object' ? v.value : v))
    .filter(v => v != null);
  const key = onlyIf.key ?? null;
  const op  = onlyIf.comparison ?? 'eq';

  if (onlyIf.type === 'flag' || !onlyIf.type) {
    if (key) {
      // key-based: check mapVars first (set_var values), then gameFlags.
      const raw    = key in mapVars ? mapVars[key] : !!gameFlags[key];
      const actual = raw === true || raw === 'true' || (typeof raw === 'number' && raw !== 0);
      if (op === 'in')  return value.some(t  => actual == (t === 'true' || t === true));  // eslint-disable-line eqeqeq
      if (op === 'nin') return value.every(t => actual != (t === 'true' || t === true));  // eslint-disable-line eqeqeq
      const rawTarget = value.length > 0 ? value[0] : null;
      let target = true;
      if (rawTarget === false || rawTarget === 'false') target = false;
      return _compareOp(actual, op, target);
    }
    // legacy: value list of flag names
    if (!value.length) return true;
    if (op === 'in')  return value.some(name => !!gameFlags[name]);
    if (op === 'nin') return value.every(name => !gameFlags[name]);
    return value.every(name => _compareOp(!!gameFlags[name], op, true));
  }

  if (onlyIf.type === 'variable') {
    if (!key) return true;
    let actual = mapVars[key] ?? null;
    if (actual === 'true')  actual = true;
    if (actual === 'false') actual = false;
    // 'in' / 'nin' compare actual against the full value list
    if (op === 'in')  return value.some(t  => actual == t);  // eslint-disable-line eqeqeq
    if (op === 'nin') return value.every(t => actual != t);  // eslint-disable-line eqeqeq
    let target = value[0] ?? null;
    if (target === 'true')  target = true;
    if (target === 'false') target = false;
    // numeric comparison when both sides parse cleanly, otherwise loose equality
    const numA = Number(actual), numT = Number(target);
    if (actual != null && target != null && !isNaN(numA) && !isNaN(numT)) {
      return _compareOp(numA, op, numT);
    }
    return _compareOp(actual, op, target);  // eslint-disable-line eqeqeq
  }

  if (onlyIf.type === 'variant') {
    if (variant == null) return true; // no variant set — don't filter
    return _compareOp(variant, op === 'eq' ? 'in' : op === 'neq' ? 'nin' : op, value);
  }

  return true; // unknown type → allow
}

export {
  getPropertyValue,
  getBattleTheme,
  getValue,
  remapProps,
  generateTileCoords,
  Vector2,
  checkOnlyIf
};
