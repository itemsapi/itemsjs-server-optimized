'use strict';

const assert = require('assert');
const _ = require('lodash');
const storage = require('./../src/storage');
const helpers2 = require('./../src/helpers2');
const addon = require('bindings')('itemsjs_addon.node');
const Facets = require('./../src/facets');
const data = require('./fixtures/items.json');
const RoaringBitmap32 = require('roaring/RoaringBitmap32');
const INDEX_PATH = './db.mdb';

var facets = new Facets();

describe('indexing', function() {

  before(function(done) {
    storage.dropDB(INDEX_PATH);

    addon.index({
      json_path: './tests/fixtures/movies.json',
      faceted_fields: ['actors', 'genres', 'year', 'director'],
      index_path: INDEX_PATH,
      sorting_fields: ['votes', 'year', 'rating', 'position'],
      append: false
    });

    done();
  });

  it('checks sorting', function test(done) {

    assert.deepEqual(1790841, storage.getSortingValue(INDEX_PATH, 'votes', 1));
    assert.deepEqual(1222640, storage.getSortingValue(INDEX_PATH, 'votes', 2));

    assert.deepEqual(1972, storage.getSortingValue(INDEX_PATH, 'year', 2));
    assert.deepEqual(1994, storage.getSortingValue(INDEX_PATH, 'year', 1));
    assert.deepEqual(1994, storage.getSortingValue(INDEX_PATH, 'year', 5));

    assert.deepEqual(1, storage.getSortingValue(INDEX_PATH, 'position', 20));

    var ids = new RoaringBitmap32([1, 2, 3, 4]).serialize(true);
    var sorted_index = Array.from(addon.sort_index(ids, 'votes', 'asc', 0, 4));
    assert.deepEqual([4, 2, 3, 1], sorted_index);

    var sorted_index = Array.from(addon.sort_index(ids, 'votes', 'asc', 0, 2));
    assert.deepEqual([4, 2], sorted_index);

    var sorted_index = Array.from(addon.sort_index(ids, 'votes', 'asc', 2, 2));
    assert.deepEqual([3, 1], sorted_index);

    var sorted_index = Array.from(addon.sort_index(ids, 'votes', 'asc', 0, 8));
    assert.deepEqual([4, 2, 3, 1], sorted_index);

    var sorted_index = Array.from(addon.sort_index(ids, 'votes', 'asc', 8, 8));
    assert.deepEqual([], sorted_index);

    var sorted_index = Array.from(addon.sort_index(ids, 'votes', 'desc', 0, 4));
    assert.deepEqual([1, 3, 2, 4], sorted_index);

    var sorted_index = Array.from(addon.sort_index(ids, 'votes', 'desc', 0, 2));
    assert.deepEqual([1, 3], sorted_index);

    var sorted_index = Array.from(addon.sort_index(ids, 'votes', 'desc', 2, 2));
    assert.deepEqual([2, 4], sorted_index);

    var sorted_index = Array.from(addon.sort_index(ids, 'year', 'asc', 0, 4));
    assert.deepEqual([2, 4, 1, 3], sorted_index);

    done();
  })

  it('checks sorting by double / float', function test(done) {

    assert.deepEqual(9.3, storage.getSortingValue(INDEX_PATH, 'rating', 1));

    var ids = new RoaringBitmap32([1, 2, 3, 4]).serialize(true);
    var sorted_index = Array.from(addon.sort_index(ids, 'rating', 'asc', 0, 4));
    assert.deepEqual([3, 4, 2, 1], sorted_index);

    done();
  })

  xit('keep missing null values in the end in sorting', function test(done) {

    var ids = new RoaringBitmap32(_.range(1, 21, 1)).serialize(true);
    var sorted_index = Array.from(addon.sort_index(ids, 'position', 'desc', 0, 20));
    assert.deepEqual(19, sorted_index[0]);
    assert.deepEqual(20, sorted_index[1]);
    assert.deepEqual(20, sorted_index.length);

    done();
  })

  xit('keep missing null values in the end in sorting with pagination', function test(done) {

    var ids = new RoaringBitmap32(_.range(1, 21, 1)).serialize(true);
    var sorted_index = Array.from(addon.sort_index(ids, 'position', 'desc', 2, 20));
    //assert.deepEqual(sorted_index[0]);
    //assert.deepEqual(20, sorted_index[1]);
    assert.deepEqual(sorted_index.length, 18);
    assert.deepEqual(sorted_index[0], 1);

    done();
  })


  it('load sort index', function test(done) {

    addon.load_sort_index(['year', 'votes', 'nonono']);

    var ids = new RoaringBitmap32([1, 2, 3, 4]).serialize(true);
    var sorted_index = Array.from(addon.sort_index(ids, 'year', 'asc', 0, 4));
    assert.deepEqual([2, 4, 1, 3], sorted_index);

    done();
  })


  it('load sort index with not existing field', function test(done) {

    addon.load_sort_index(['year', 'votes', 'nonono']);

    var ids = new RoaringBitmap32([1, 2, 3, 4]).serialize(true);
    var sorted_index = Array.from(addon.sort_index(ids, 'year', 'asc', 0, 4));
    assert.deepEqual([2, 4, 1, 3], sorted_index);

    done();
  })

  xit('works if ids is out of range', function test(done) {

    var ids = new RoaringBitmap32(_.range(1, 61, 1)).serialize(true);
    var sorted_index = Array.from(addon.sort_index(ids, 'year', 'asc', 0, 100));
    assert.deepEqual(20, sorted_index.length);

    done();
  })


  it('load sort index after next data index', function test(done) {

    addon.index({
      json_path: './tests/fixtures/movies.json',
      faceted_fields: ['actors', 'genres', 'year', 'director'],
      index_path: INDEX_PATH,
      sorting_fields: ['votes', 'year', 'rating'],
      append: true
    });

    addon.load_sort_index(['year', 'votes']);

    var ids = new RoaringBitmap32([30, 31]).serialize(true);
    var sorted_index = Array.from(addon.sort_index(ids, 'year', 'asc', 0, 2));
    assert.deepEqual([31, 30], sorted_index);

    var ids = new RoaringBitmap32(_.range(1, 41, 1)).serialize(true);
    var sorted_index = Array.from(addon.sort_index(ids, 'year', 'asc', 0, 100));
    assert.deepEqual(40, sorted_index.length);

    done();
  })

})

