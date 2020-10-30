'use strict';

const assert = require('assert');
const storage = require('./../src/storage');
const helpers2 = require('./../src/helpers2');
const addon = require('bindings')('itemsjs_addon.node');
const Facets = require('./../src/facets');
let data = require('./fixtures/movies.json');
const INDEX_PATH = './db.mdb';

var i = 1;
data = data.map(v => {
  v.id = i;
  ++i;
  return v;
})

var facets = new Facets();

describe('delete items', function() {

  before(function(done) {
    storage.dropDB(INDEX_PATH);
    done();
  });

  it('checks index after delete', function test(done) {

    var index = addon.index({
      json_object: data,
      index_path: INDEX_PATH,
      faceted_fields: ['actors', 'genres', 'year', 'director'],
      sorting_fields: ['votes', 'rating'],
      append: false
    });

    var ids = storage.getIdsBitmap(INDEX_PATH);
    assert.deepEqual(ids.size, 20);

    assert.deepEqual(1, storage.getItem(INDEX_PATH, 1).id);

    var filter_index = storage.getFilterIndex(INDEX_PATH, 'genres.Drama');
    assert.deepEqual(15, filter_index.size);




    var index = storage.getSearchTermIndex(INDEX_PATH, 'shawshank');
    assert.deepEqual(1, index.size);

    var index = storage.getSearchTermIndex(INDEX_PATH, 'men');
    assert.deepEqual(6, index.size);

    var index = storage.getSearchTermIndex(INDEX_PATH, 'golden');
    assert.deepEqual(2, index.size);

    assert.deepEqual(1790841, storage.getSortingValue(INDEX_PATH, 'votes', 1));

    storage.deleteItem(INDEX_PATH, 1);

    var ids = storage.getIdsBitmap(INDEX_PATH);
    assert.deepEqual(ids.size, 19);

    var filter_index = storage.getFilterIndex(INDEX_PATH, 'genres.Drama');
    assert.deepEqual(14, filter_index.size);

    var index = storage.getSearchTermIndex(INDEX_PATH, 'shawshank');
    assert.deepEqual(undefined, index);
    //assert.deepEqual(0, index.size);

    var index = storage.getSearchTermIndex(INDEX_PATH, 'men');
    assert.deepEqual(5, index.size);

    var index = storage.getSearchTermIndex(INDEX_PATH, 'golden');
    assert.deepEqual(1, index.size);

    var index = storage.getSearchTermIndex(INDEX_PATH, 'two');
    assert.deepEqual(8, index.size);

    // proximity words (bigram)
    var index = storage.getSearchTermIndex(INDEX_PATH, 'long_term');
    assert.deepEqual(undefined, index);

    assert.equal(undefined, storage.getInternalId(INDEX_PATH, 1));

    assert.deepEqual(undefined, storage.getItem(INDEX_PATH, 1));

    // @TODO should be deleted
    //assert.deepEqual(undefined, storage.getSortingValue(INDEX_PATH, 'votes', 1));

    done();
  })

  it('deletes all', function test(done) {

    for (var i = 1 ; i <= 20 ; ++i) {
      storage.deleteItem(INDEX_PATH, i);
    }

    var ids = storage.getIdsBitmap(INDEX_PATH);
    assert.deepEqual(ids.size, 0);

    var filter_indexes = storage.getFilterIndexes(INDEX_PATH);

    Object.keys(filter_indexes).forEach(v => {
      assert.deepEqual(0, filter_indexes[v].size);
    })

    done();
  })
})

describe('update items', function() {

  before(function(done) {
    storage.dropDB(INDEX_PATH);
    done();
  });

  it('checks index after update', function test(done) {

    var index = addon.index({
      json_object: data,
      index_path: INDEX_PATH,
      faceted_fields: ['actors', 'genres', 'year', 'director'],
      sorting_fields: ['votes', 'rating'],
      append: false
    });

    storage.updateItem(INDEX_PATH, {
      id: 1,
      votes: 100,
      name: 'Tom & Jerry'
    }, {
      faceted_fields: ['actors', 'genres', 'year', 'director'],
      sorting_fields: ['votes', 'rating']
    });


    var ids = storage.getIdsBitmap(INDEX_PATH);
    //console.log(ids.toArray())
    assert.deepEqual(ids.size, 20);
    assert.deepEqual(1, storage.getItem(INDEX_PATH, 21).id);
    assert.deepEqual('Tom & Jerry', storage.getItem(INDEX_PATH, 21).name);
    assert.deepEqual(1, storage.getItemByPkey(INDEX_PATH, 1).id);
    assert.deepEqual(undefined, storage.getItemByPkey(INDEX_PATH, 1).year);
    assert.deepEqual(100, storage.getSortingValue(INDEX_PATH, 'votes', 21));

    done();
  })
})

describe('update items partially', function() {

  before(function(done) {
    storage.dropDB(INDEX_PATH);
    done();
  });

  it('checks index after update', function test(done) {

    var index = addon.index({
      json_object: data,
      index_path: INDEX_PATH,
      faceted_fields: ['actors', 'genres', 'year', 'director'],
      append: false
    });

    storage.partialUpdateItem(INDEX_PATH, 1, {
      name: 'Tom & Jerry'
    }, {
      faceted_fields: ['actors', 'genres', 'year', 'director']
    });

    var ids = storage.getIdsBitmap(INDEX_PATH);
    assert.deepEqual(ids.size, 20);
    assert.deepEqual(1, storage.getItem(INDEX_PATH, 21).id);
    assert.deepEqual('Tom & Jerry', storage.getItem(INDEX_PATH, 21).name);
    assert.deepEqual(1, storage.getItemByPkey(INDEX_PATH, 1).id);
    assert.deepEqual(1994, storage.getItemByPkey(INDEX_PATH, 1).year);
    assert.deepEqual(['Crime', 'Drama'], storage.getItemByPkey(INDEX_PATH, 1).genres);

    var filter_index = storage.getFilterIndex(INDEX_PATH, 'genres.Drama');
    assert.deepEqual(15, filter_index.size);


    done();
  })
})

describe('aggregation / facet', function() {

  var facets = new Facets();

  var configuration = {
    aggregations: {
      actors: {
        conjunction: true,
      },
      genres: {
        conjunction: true,
      },
      year: {
        conjunction: true,
      },
      director: {
        conjunction: true,
      }
    }
  }

  before(async function() {
    storage.dropDB(INDEX_PATH);

    await facets.index(INDEX_PATH, {
      json_object: data,
      append: false,
      configuration: configuration
    });
  });

  it('checks index after partial update', function test(done) {

    facets.partial_update_item(INDEX_PATH, 1, {
      name: 'Tom & Jerry'
    });

    var ids = storage.getIdsBitmap(INDEX_PATH);
    assert.deepEqual(ids.size, 20);
    assert.deepEqual(1, storage.getItem(INDEX_PATH, 21).id);
    assert.deepEqual('Tom & Jerry', storage.getItem(INDEX_PATH, 21).name);
    assert.deepEqual(1, storage.getItemByPkey(INDEX_PATH, 1).id);
    assert.deepEqual(1994, storage.getItemByPkey(INDEX_PATH, 1).year);
    assert.deepEqual(['Crime', 'Drama'], storage.getItemByPkey(INDEX_PATH, 1).genres);

    var filter_index = storage.getFilterIndex(INDEX_PATH, 'genres.Drama');
    assert.deepEqual(15, filter_index.size);

    done();
  })

  it('checks index after update', function test(done) {

    facets.update_item(INDEX_PATH, {
      id: 1,
      name: 'Tom & Jerry'
    });

    var ids = storage.getIdsBitmap(INDEX_PATH);
    //console.log(ids.toArray())
    assert.deepEqual(ids.size, 20);
    assert.deepEqual(1, storage.getItem(INDEX_PATH, 21).id);
    assert.deepEqual('Tom & Jerry', storage.getItem(INDEX_PATH, 21).name);
    assert.deepEqual(1, storage.getItemByPkey(INDEX_PATH, 1).id);
    assert.deepEqual(undefined, storage.getItemByPkey(INDEX_PATH, 1).year);

    done();
  })
})
