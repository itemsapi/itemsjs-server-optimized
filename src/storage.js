const lmdb = require('node-lmdb');
const RoaringBitmap32 = require('roaring/RoaringBitmap32');

const env = new lmdb.Env();
env.open({
  //path: './db.mdb',
  path: './example.mdb',
  mapSize: 10 * 1024 * 1024 * 1024,
  maxReaders: 3,
  maxDbs: 3
});

const dbi = env.openDbi({
  name: null,
  create: false
})

module.exports.deleteConfiguration = function(configuration) {

  var txn = env.beginTxn();
  try {
    txn.del(dbi, new Buffer.from('configuration'));
  } catch (err) {
  }
  txn.commit();
}

module.exports.setConfiguration = function(configuration) {

  var txn = env.beginTxn();
  var binary = txn.putBinary(dbi, new Buffer.from('configuration'), new Buffer.from(JSON.stringify(configuration)));
  txn.commit();
}

module.exports.getConfiguration = function() {

  var txn = env.beginTxn();
  var binary = txn.getBinary(dbi, new Buffer.from('configuration'));
  txn.abort();

  if (!binary) {
    return null;
  }

  var result = JSON.parse(binary.toString());

  return result;
}

module.exports.getKeysList = function() {

  var txn = env.beginTxn();
  var binary = txn.getBinary(dbi, new Buffer.from('keys_list'));
  txn.abort();
  var string = binary.toString();
  var array = string.split('|||');

  return array;
}

module.exports.getSearchTermIndex = function(key) {

  var txn = env.beginTxn();
  var binary = txn.getBinary(dbi, new Buffer.from('term|||' + key));
  txn.abort();

  if (!binary) {
    return;
  }

  var bitmap = RoaringBitmap32.deserialize(binary, true);

  return bitmap;
}



module.exports.getFilterIndex = function(key) {

  var txn = env.beginTxn();

  //var binary = txn.getBinary(dbi, new Buffer.from('actors.Al Pacino'));
  var binary = txn.getBinary(dbi, new Buffer.from(key));
  txn.abort();

  if (!binary) {
    return;
  }

  var bitmap = RoaringBitmap32.deserialize(binary, true);


  return bitmap;
}

module.exports.getFilterIndexes = function() {

  var txn = env.beginTxn();

  var output = {};
  var binary = txn.getBinary(dbi, new Buffer.from('keys_list'));

  if (!binary) {
    txn.abort();
    return;
  }

  var string = binary.toString();
  var keys = string.split('|||');

  keys.forEach(key => {

    if (!key) {
      return;
    }

    var binary = txn.getBinary(dbi, new Buffer.from(key));

    if (binary) {
      output[key] = RoaringBitmap32.deserialize(binary, true);
    }
  })

  txn.abort();

  return output;
}

module.exports.getItem = function(id) {

  var txn = env.beginTxn();

  var binary = txn.getBinary(dbi, new Buffer.from(id + ''));
  txn.abort();
  var json = JSON.parse(binary.toString());


  return json;
}

module.exports.getItems = function(ids) {

  var txn = env.beginTxn();
  var output = [];

  ids.forEach(id => {

    var binary = txn.getBinary(dbi, new Buffer.from(id + ''));
    var json = JSON.parse(binary.toString());
    output.push(json);
  })

  txn.abort();

  return output;
}


/**
 * get internal ids
 */
module.exports.getIds = function() {

  return module.exports.getIdsBitmap().toArray();
}


/**
 * get internal ids
 */
module.exports.getIdsBitmap = function() {

  var txn = env.beginTxn();

  var binary = txn.getBinary(dbi, new Buffer.from('ids'));
  txn.abort();
  var bitmap = RoaringBitmap32.deserialize(binary, true);


  return bitmap;
}
