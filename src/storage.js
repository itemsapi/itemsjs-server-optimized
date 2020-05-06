const lmdb = require('node-lmdb');
const RoaringBitmap32 = require('roaring/RoaringBitmap32');

const env = new lmdb.Env();
env.open({
  //path: './db.mdb',
  path: './example.mdb',
  mapSize: 2 * 1024 * 1024 * 1024,
  maxReaders: 3,
  maxDbs: 1
});

const dbi = env.openDbi({
  name: null,
  create: false
})

module.exports.getKeysList = function() {

  var txn = env.beginTxn();
  var binary = txn.getBinary(dbi, new Buffer.from('keys_list'));
  var string = binary.toString();
  var array = string.split('|||');

  txn.abort();
  return array;
}



module.exports.getFilterIndex = function(key) {

  var txn = env.beginTxn();

  //var binary = txn.getBinary(dbi, new Buffer.from('actors.Al Pacino'));
  var binary = txn.getBinary(dbi, new Buffer.from(key));
  var bitmap = RoaringBitmap32.deserialize(binary, true);

  txn.abort();

  return bitmap;
}

module.exports.getItem = function(id) {

  var txn = env.beginTxn();

  var binary = txn.getBinary(dbi, new Buffer.from(id + ''));
  var json = JSON.parse(binary.toString());

  txn.abort();

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

  var txn = env.beginTxn();

  var binary = txn.getBinary(dbi, new Buffer.from('ids'));
  var bitmap = RoaringBitmap32.deserialize(binary, true);

  txn.abort();

  return bitmap;
}
