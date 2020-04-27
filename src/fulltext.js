const _ = require('lodash');
const lunr = require('lunr');
const RoaringBitmap32 = require('roaring/RoaringBitmap32');

/**
 * responsible for making full text searching on items
 * config provide only searchableFields
 */
var Fulltext = function(items, config) {

  config = config || {};
  config.searchableFields = config.searchableFields || [];
  this.items = items;
  // creating index
  this.idx = lunr(function () {
    // currently schema hardcoded
    this.field('name', { boost: 10 });

    var self = this;
    _.forEach(config.searchableFields, function(field) {
      self.field(field);
    });
    this.ref('id');
  })

  //var items2 = _.clone(items)
  var i = 1;
  this._items_map = {};
  this._ids = [];

  _.map(items, (item) => {

    this._items_map[i] = item;
    this._ids.push(i);
    item._id = i;

    if (!item.id) {
      item.id = i;
    }

    ++i;
    this.idx.add(item)
  })

  this._bits_ids = new RoaringBitmap32(this._ids);

  this.store = _.mapKeys(items, (doc) => {
    return doc.id;
  })
};

Fulltext.prototype = {

  internal_ids: function() {
    return this._ids;
  },

  bits_ids: function() {
    return this._bits_ids;
  },

  /*items_map: function() {
    return this._items_map;
  },*/

  get_item: function(id) {
    return this._items_map[id];
  },

  search: function(query) {
    if (!query) {
      return this.items;
    }
    return _.map(this.idx.search(query), (val) => {
      var item = this.store[val.ref]
      //delete item.id;
      return item;
    })
  }
}

module.exports = Fulltext;
