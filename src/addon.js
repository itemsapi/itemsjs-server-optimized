const addon = require('bindings')('itemsjs_addon.node');

module.exports = addon;

module.exports.indexAsync = function(data) {
  return new Promise(function (resolve, reject) {

    addon.index_cb(data, function(err, res) {

      if (err) {
        return reject(err);
      }

      return resolve(res);
    })
  });
}

module.exports.concurrencyAsync = function(data) {
  return new Promise(function (resolve, reject) {

    addon.concurrency_cb(data, function(err, res) {

      if (err) {
        return reject(err);
      }

      return resolve(res);
    })
  });
}

module.exports.searchFacetsAsync = function(data) {
  return new Promise(function (resolve, reject) {

    addon.search_facets_cb(data, function(err, res) {

      if (err) {
        return reject(err);
      }

      return resolve(res);
    })
  });
}
