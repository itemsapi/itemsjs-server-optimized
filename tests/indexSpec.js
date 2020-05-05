'use strict';

const should = require('should');
const expect = require('expect');
const assert = require('assert');
const service = require('./../src/lib');
const sinon = require('sinon');
const Facets = require('./../src/facets');
const storage = require('./../src/storage');
//const storage = require('./../src/storage')({
  //database: 'moja_nowa'
//});
const helpers2 = require('./../src/helpers2');
const RoaringBitmap32 = require('roaring/RoaringBitmap32');
const addon = require('bindings')('itemsjs_addon.node');
const lmdb = require('node-lmdb');

var items = [{
  id: 1,
  name: 'movie1',
  tags: ['a', 'b', 'c', 'd'],
  actors: ['john', 'alex'],
  category: 'drama'
}, {
  id: 2,
  name: 'movie2',
  tags: ['a', 'e', 'f'],
  actors: ['john', 'brad'],
  category: 'comedy'
}, {
  id: 3,
  name: 'movie3',
  tags: ['a', 'c'],
  actors: ['jeff'],
  category: 'comedy'
}, {
  id: 4,
  name: 'movie4',
  tags: ['c', 'a', 'z'],
  actors: ['jean'],
  category: 'drama'
}]

describe('indexing', function() {

  it('checks index', function test(done) {

    //var index = addon.index('/home/mateusz/node/items-benchmark/datasets/shoprank_full.json');
    var index = addon.index('./tests/fixtures/movies.json');

    var env = new lmdb.Env();
    env.open({
      //path: './db.mdb',
      path: './example.mdb',
      mapSize: 2 * 1024 * 1024 * 1024,
      maxReaders: 3,
      maxDbs: 1
    });


    var dbi = env.openDbi({
      name: null,
      create: false
    })

    var txn = env.beginTxn();

    var binary = txn.getBinary(dbi, new Buffer.from('actors.Al Pacino'));
    var bitmap = RoaringBitmap32.deserialize(binary, true);
    assert.deepEqual(2, bitmap.size);

    var binary = txn.getBinary(dbi, new Buffer.from('genres.Drama'));
    var bitmap = RoaringBitmap32.deserialize(binary, true);
    assert.deepEqual(15, bitmap.size);

    var binary = txn.getBinary(dbi, new Buffer.from('1'));
    var json = JSON.parse(binary.toString());
    assert.deepEqual(json.name, 'The Shawshank Redemption');

    var binary = txn.getBinary(dbi, new Buffer.from('1'));
    var json = JSON.parse(binary.toString());
    assert.deepEqual(json.name, 'The Shawshank Redemption');

    env.close();

    var item = storage.getItem(1);
    assert.deepEqual(item.name, 'The Shawshank Redemption');

    var item = storage.getItem(1);
    assert.deepEqual(item.name, 'The Shawshank Redemption');

    var items = storage.getItems([1, 2]);
    assert.deepEqual(items[0].name, 'The Shawshank Redemption');

    done();
  })

  it('checks index creating from non json object', function test(done) {

    //var index = addon.index({
      //json: items
    //});

    done();
  })
})

