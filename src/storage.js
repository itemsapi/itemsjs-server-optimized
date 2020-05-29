const lmdb = require('node-lmdb');
const RoaringBitmap32 = require('roaring/RoaringBitmap32');

const env = new lmdb.Env();
env.open({
  //path: './db.mdb',
  path: './example.mdb',
  mapSize: 100 * 1024 * 1024 * 1024,
  maxReaders: 10,
  //noTls: true,
  maxDbs: 10
});

var dbi = env.openDbi({
  name: null,
  create: false
})

module.exports.dropDB = function() {
  dbi.drop();
  dbi = env.openDbi({
    name: null,
    create: false
  });

  var dbi2 = env.openDbi({
    name: 'filters',
    create: true
  });
  dbi2.drop();
}

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

  var txn = env.beginTxn({
    readonly: true
  });
  var binary = txn.getBinary(dbi, new Buffer.from('configuration'));
  txn.abort();

  if (!binary) {
    return null;
  }

  var result = JSON.parse(binary.toString());

  return result;
}


module.exports.getInternalId = function(id) {

  var dbi_pkeys = env.openDbi({
    name: 'pkeys',
    create: true
  })

  var txn = env.beginTxn({
    readonly: true
  });

  var binary = txn.getBinary(dbi_pkeys, new Buffer.from('' + id));
  txn.abort();
  dbi_pkeys.close();


  if (binary) {
    var string = binary.toString();

    if (string) {
      return parseInt(string, 10);
    }
  }
}


module.exports.getKeysList = function() {

  var array = [];

  var dbi2 = env.openDbi({
    name: 'filters',
    create: true
  })

  var txn = env.beginTxn({
    readonly: true
  });

  var time = new Date().getTime();
  var cursor = new lmdb.Cursor(txn, dbi2, { keyIsBuffer: true });

  for (var found = cursor.goToFirst(); found !== null; found = cursor.goToNext()) {
    if (found) {
      array.push(found.toString());
    }
  }

  console.log(`load keys by cursor: ${new Date().getTime() - time}`);
  cursor.close();
  txn.abort();
  dbi2.close();

  return array;


  var txn = env.beginTxn({
    readonly: true
  });
  var time = new Date().getTime();
  var binary = txn.getBinary(dbi, new Buffer.from('keys_list'));
  txn.abort();

  var string = binary.toString();
  var array = string.split('|||');
  console.log(`load keys by splitting: ${new Date().getTime() - time}`);

  console.log(array[0]);

  return array;
}

module.exports.getSearchTermIndex = function(key) {

  var txn = env.beginTxn({
    readonly: true
  });
  var binary = txn.getBinary(dbi, new Buffer.from('term|||' + key));
  txn.abort();

  if (!binary) {
    return;
  }

  var bitmap = RoaringBitmap32.deserialize(binary, true);

  return bitmap;
}



module.exports.getFilterIndex = function(key) {

  var txn = env.beginTxn({
    readonly: true
  });

  //var binary = txn.getBinary(dbi, new Buffer.from('actors.Al Pacino'));
  var binary = txn.getBinary(dbi, new Buffer.from(key));
  txn.abort();

  if (!binary) {
    return;
  }

  var bitmap = RoaringBitmap32.deserialize(binary, true);


  return bitmap;
}

/**
 * the roaring deserialization is taking the most time while making faceted query
 */
module.exports.getFilterIndexes = function() {

  var output = {};
  var keys = module.exports.getKeysList();

  var txn = env.beginTxn({
    readonly: true
  });

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

  var txn = env.beginTxn({
    readonly: true
  });

  var binary = txn.getBinary(dbi, new Buffer.from(id + ''));
  txn.abort();
  var json = JSON.parse(binary.toString());


  return json;
}

module.exports.getItems = function(ids) {

  var txn = env.beginTxn({
    readonly: true
  });
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

  var txn = env.beginTxn({
    readonly: true
  });

  var binary = txn.getBinary(dbi, new Buffer.from('ids'));
  txn.abort();
  var bitmap = RoaringBitmap32.deserialize(binary, true);


  return bitmap;
}
