import BaseItem from '@Objects/items/BaseItem.js';

export default class Bush extends BaseItem {
  constructor(config) {
    config.tileId = 18;
    config.type = 'bush';
    config.properties = [];

    super(config);
  }
}
