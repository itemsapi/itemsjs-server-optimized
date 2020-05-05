const lmdb = require('node-lmdb');

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
module.exports.getIds = function(ids) {

}
