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

var data = [{
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
    var index = addon.index({
      json_path: './tests/fixtures/movies.json',
      //fields: ['actors', 'genres', 'year']
    });

    var filter_index = storage.getFilterIndex('actors.Al Pacino');
    assert.deepEqual(2, filter_index.size);
    assert.deepEqual([2, 4], filter_index.toArray());

    var filter_index = storage.getFilterIndex('genres.Drama');
    assert.deepEqual(15, filter_index.size);

    var filter_index = storage.getFilterIndex('year.1974');
    assert.deepEqual(1, filter_index.size);

    var filter_index = storage.getFilterIndex('year.2008');
    assert.deepEqual(1, filter_index.size);

    var filter_index = storage.getFilterIndex('director.Sergio Leone');
    assert.deepEqual(1, filter_index.size);

    var keys_list = storage.getKeysList('keys_list');
    //console.log(JSON.stringify(keys_list));
    assert.deepEqual('actors.Aamir Khan', keys_list[0]);

    var item = storage.getItem(1);
    assert.deepEqual(item.name, 'The Shawshank Redemption');

    var item = storage.getItem(1);
    assert.deepEqual(item.name, 'The Shawshank Redemption');

    var items = storage.getItems([1, 2]);
    assert.deepEqual(items[0].name, 'The Shawshank Redemption');

    var ids = storage.getIds();
    assert.deepEqual(ids.size, 20);

    //var items = storage.getItems([1, 2]);
    //assert.deepEqual(items[0].name, 'The Shawshank Redemption');

    //var items = storage.getItems([1, 2, 3]);
    //assert.deepEqual(items[0].name, 'The Shawshank Redemption');
    done();
  })

  it('checks index creating from non json object', function test(done) {

    var index = addon.index({
      json_object: data
    });

    var item = storage.getItem(1);
    assert.deepEqual(item.name, 'movie1');

    var item = storage.getItem(2);
    assert.deepEqual(item.name, 'movie2');

    var items = storage.getItems([1, 2]);
    assert.deepEqual(items[0].name, 'movie1');

    done();
  })

  it('checks index creating from stringified json', function test(done) {

    var index = addon.index({
      json_string: JSON.stringify(data)
    });

    var item = storage.getItem(1);
    assert.deepEqual(item.name, 'movie1');

    done();
  })
})

