const addon = require('bindings')('itemsjs_addon.node');

module.exports = addon;

module.exports.indexAsync = function(data) {
  return new Promise(function (resolve, reject) {

    addon.indexCb(data, function(err, res) {

      if (err) {
        return reject(err);
      }

      return resolve(res);
    })
  });
}

module.exports.concurrencyAsync = function(data) {
  return new Promise(function (resolve, reject) {

    addon.concurrencyCb(data, function(err, res) {

      if (err) {
        return reject(err);
      }

      return resolve(res);
    })
  });
}
