const lmdb = require('node-lmdb');
const RoaringBitmap32 = require('roaring/RoaringBitmap32');
const addon = require('bindings')('itemsjs_addon.node');
const _ = require('lodash');

const env = new lmdb.Env();
env.open({
  path: './db.mdb',
  mapSize: 100 * 1024 * 1024 * 1024,
  maxReaders: 10,
  //noTls: true,
  maxDbs: 30
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

  // @TODO reset sorting dbs
  ['filters', 'terms', 'items', 'pkeys'].forEach(v => {
    var dbi2 = env.openDbi({
      name: v,
      create: true
    });
    dbi2.drop();
  })
}


module.exports.deleteItem = function(id) {

  var internal_id = module.exports.getInternalId(id);

  if (internal_id) {
    addon.delete_item(internal_id);
  }
}

module.exports.updateItem = function(item, options) {

  options = options || {};

  if (!item.id) {
    throw new Error('integer id is required');
  }

  var internal_id = module.exports.getInternalId(item.id);

  if (!internal_id) {
    throw new Error(`Not found item by primary key "${id}"`);
  }

  addon.delete_item(internal_id);
  addon.index({
    json_object: [item],
    faceted_fields: options.faceted_fields,
    sorting_fields: options.sorting_fields,
    append: true
  });
}

module.exports.partialUpdateItem = function(id, item, options) {

  options = options || {};

  var internal_id = module.exports.getInternalId(id);

  var old_item = module.exports.getItemByPkey(id);

  if (!internal_id) {
    throw new Error(`Not found item by primary key "${id}"`);
  }

  addon.delete_item(internal_id);
  addon.index({
    json_object: [_.assign(old_item, item)],
    faceted_fields: options.faceted_fields,
    sorting_fields: options.sorting_fields,
    append: true
  });
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

module.exports.getSortingValue = function(field, internal_id) {

  var dbi_sorting = env.openDbi({
    name: 'sorting_' + field,
    create: true
  })

  var txn = env.beginTxn({
    readonly: true
  });

  var binary = txn.getBinary(dbi_sorting, new Buffer.from('' + internal_id));
  txn.abort();
  dbi_sorting.close();


  if (binary) {
    var string = binary.toString();

    return string;
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
}

module.exports.getSearchTermIndex = function(key) {


  var dbi_terms = env.openDbi({
    name: 'terms',
    create: true
  })

  var txn = env.beginTxn({
    readonly: true
  });

  var binary = txn.getBinary(dbi_terms, new Buffer.from('' + key));
  txn.abort();
  dbi_terms.close();

  if (!binary) {
    return;
  }

  var bitmap = RoaringBitmap32.deserialize(binary, true);

  return bitmap;
}



module.exports.getFilterIndex = function(key) {

  var dbi_filters = env.openDbi({
    name: 'filters',
    create: true
  })

  var txn = env.beginTxn({
    readonly: true
  });

  var binary = txn.getBinary(dbi_filters, new Buffer.from(key));
  txn.abort();
  dbi_filters.close();

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

  var dbi_filters = env.openDbi({
    name: 'filters',
    create: true
  })

  var txn = env.beginTxn({
    readonly: true
  });

  keys.forEach(key => {

    if (!key) {
      return;
    }

    var binary = txn.getBinary(dbi_filters, new Buffer.from(key));

    if (binary) {
      output[key] = RoaringBitmap32.deserialize(binary, true);
    }
  })

  txn.abort();
  dbi_filters.close();
  return output;
}

module.exports.getItemByPkey = function(id) {
  var internal_id = module.exports.getInternalId(id);
  return module.exports.getItem(internal_id);
}

module.exports.getItem = function(id) {

  var dbi_items = env.openDbi({
    name: 'items',
    create: true
  })

  var txn = env.beginTxn({
    readonly: true
  });

  var binary = txn.getBinary(dbi_items, new Buffer.from(id + ''));
  txn.abort();
  dbi_items.close();


  if (!binary) {
    return;
  }

  var json = JSON.parse(binary.toString());

  return json;
}

module.exports.getItems = function(ids) {

  var dbi_items = env.openDbi({
    name: 'items',
    create: true
  })

  var txn = env.beginTxn({
    readonly: true
  });
  var output = [];

  ids.forEach(id => {

    var binary = txn.getBinary(dbi_items, new Buffer.from(id + ''));

    if (binary) {
      var json = JSON.parse(binary.toString());
      output.push(json);
    } else {

    }
  })

  txn.abort();
  dbi_items.close();

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

  if (!binary) {
    throw new Error('Not found ids bitmap');
  }

  var bitmap = RoaringBitmap32.deserialize(binary, true);


  return bitmap;
}
