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

export {
  getPropertyValue,
  getValue,
  remapProps,
  generateTileCoords,
  Vector2
};
