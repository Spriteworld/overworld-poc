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

export {
  getPropertyValue,
  getValue,
  remapProps,
};
