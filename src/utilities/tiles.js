import Phaser from 'phaser';

function getPropertyValue(props, id, defValue) {
  if (typeof props === 'undefined' || Object.values(props).length === 0) {
    return defValue;
  }
  let property = props.find(p => p.name === id);
  return typeof property === 'undefined' ? defValue : property.value;
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
 * Evaluate an `only_if` class property against a gameFlags map.
 * Returns true (allow) when the condition passes or is not set.
 *
 * only_if shape: { type: 'flag'|'variable', comparison: 'eq'|'neq', value: string[] }
 *   type='flag',  comparison='eq'  → all named flags must be truthy
 *   type='flag',  comparison='neq' → all named flags must be falsy
 */
function checkOnlyIf(onlyIf, gameFlags) {
  if (!onlyIf || !Array.isArray(onlyIf.value) || !onlyIf.value.length) return true;
  if (onlyIf.type === 'flag' || !onlyIf.type) {
    return onlyIf.value.every(name => {
      const val = !!gameFlags[name];
      return onlyIf.comparison === 'neq' ? !val : val;
    });
  }
  return true; // unknown type → allow
}

export {
  getPropertyValue,
  getValue,
  remapProps,
  generateTileCoords,
  Vector2,
  checkOnlyIf
};
