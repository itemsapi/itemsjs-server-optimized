'use strict';

const assert = require('assert');
const storage = require('./../src/storage');
const helpers2 = require('./../src/helpers2');
const addon = require('bindings')('itemsjs_addon.node');
const Facets = require('./../src/facets');
let data = require('./fixtures/movies.json');

var i = 1;
data = data.map(v => {
  v.id = i;
  ++i;
  return v;
})

var facets = new Facets();

describe('delete items', function() {

  before(function(done) {
    storage.dropDB();
    done();
  });

  it('checks index after delete', function test(done) {

    var index = addon.index({
      json_object: data,
      faceted_fields: ['actors', 'genres', 'year', 'director'],
      sorting_fields: ['votes', 'rating'],
      append: false
    });

    var ids = storage.getIdsBitmap();
    assert.deepEqual(ids.size, 20);

    assert.deepEqual(1, storage.getItem(1).id);

    var filter_index = storage.getFilterIndex('genres.Drama');
    assert.deepEqual(15, filter_index.size);

    var index = storage.getSearchTermIndex('shawshank');
    assert.deepEqual(1, index.size);

    var index = storage.getSearchTermIndex('men');
    assert.deepEqual(6, index.size);

    var index = storage.getSearchTermIndex('golden');
    assert.deepEqual(2, index.size);

    assert.deepEqual(1790841, storage.getSortingValue('votes', 1));

    storage.deleteItem(1);

    var ids = storage.getIdsBitmap();
    assert.deepEqual(ids.size, 19);

    var filter_index = storage.getFilterIndex('genres.Drama');
    assert.deepEqual(14, filter_index.size);

    var index = storage.getSearchTermIndex('shawshank');
    assert.deepEqual(undefined, index);
    //assert.deepEqual(0, index.size);

    var index = storage.getSearchTermIndex('men');
    assert.deepEqual(5, index.size);

    var index = storage.getSearchTermIndex('golden');
    assert.deepEqual(1, index.size);

    var index = storage.getSearchTermIndex('two');
    assert.deepEqual(8, index.size);

    // proximity words (bigram)
    var index = storage.getSearchTermIndex('long_term');
    assert.deepEqual(undefined, index);

    assert.equal(undefined, storage.getInternalId(1));

    assert.deepEqual(undefined, storage.getItem(1));

    // @TODO should be deleted
    //assert.deepEqual(undefined, storage.getSortingValue('votes', 1));

    done();
  })


  it('deletes all', function test(done) {

    for (var i = 1 ; i <= 20 ; ++i) {
      storage.deleteItem(i);
    }

    var ids = storage.getIdsBitmap();
    assert.deepEqual(ids.size, 0);

    var filter_indexes = storage.getFilterIndexes();

    Object.keys(filter_indexes).forEach(v => {
      assert.deepEqual(0, filter_indexes[v].size);
    })


    done();
  })

})

describe('update items', function() {

  before(function(done) {
    storage.dropDB();
    done();
  });

  it('checks index after update', function test(done) {

    var index = addon.index({
      json_object: data,
      faceted_fields: ['actors', 'genres', 'year', 'director'],
      sorting_fields: ['votes', 'rating'],
      append: false
    });

    storage.updateItem({
      id: 1,
      votes: 100,
      name: 'Tom & Jerry'
    }, {
      faceted_fields: ['actors', 'genres', 'year', 'director'],
      sorting_fields: ['votes', 'rating']
    });


    var ids = storage.getIdsBitmap();
    //console.log(ids.toArray())
    assert.deepEqual(ids.size, 20);
    assert.deepEqual(1, storage.getItem(21).id);
    assert.deepEqual('Tom & Jerry', storage.getItem(21).name);
    assert.deepEqual(1, storage.getItemByPkey(1).id);
    assert.deepEqual(undefined, storage.getItemByPkey(1).year);
    assert.deepEqual(100, storage.getSortingValue('votes', 21));

    done();
  })
})

describe('update items partially', function() {

  before(function(done) {
    storage.dropDB();
    done();
  });

  it('checks index after update', function test(done) {

    var index = addon.index({
      json_object: data,
      faceted_fields: ['actors', 'genres', 'year', 'director'],
      append: false
    });

    storage.partialUpdateItem(1, {
      name: 'Tom & Jerry'
    }, {
      faceted_fields: ['actors', 'genres', 'year', 'director']
    });

    var ids = storage.getIdsBitmap();
    assert.deepEqual(ids.size, 20);
    assert.deepEqual(1, storage.getItem(21).id);
    assert.deepEqual('Tom & Jerry', storage.getItem(21).name);
    assert.deepEqual(1, storage.getItemByPkey(1).id);
    assert.deepEqual(1994, storage.getItemByPkey(1).year);
    assert.deepEqual(['Crime', 'Drama'], storage.getItemByPkey(1).genres);

    var filter_index = storage.getFilterIndex('genres.Drama');
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



  before(function(done) {
    storage.dropDB();

    facets.index({
      json_object: data,
      append: false,
      configuration: configuration
    });

    done();
  });

  it('checks index after partial update', function test(done) {

    facets.partial_update_item(1, {
      name: 'Tom & Jerry'
    });

    var ids = storage.getIdsBitmap();
    assert.deepEqual(ids.size, 20);
    assert.deepEqual(1, storage.getItem(21).id);
    assert.deepEqual('Tom & Jerry', storage.getItem(21).name);
    assert.deepEqual(1, storage.getItemByPkey(1).id);
    assert.deepEqual(1994, storage.getItemByPkey(1).year);
    assert.deepEqual(['Crime', 'Drama'], storage.getItemByPkey(1).genres);

    var filter_index = storage.getFilterIndex('genres.Drama');
    assert.deepEqual(15, filter_index.size);

    done();
  })

  it('checks index after update', function test(done) {

    facets.update_item({
      id: 1,
      name: 'Tom & Jerry'
    });

    var ids = storage.getIdsBitmap();
    //console.log(ids.toArray())
    assert.deepEqual(ids.size, 20);
    assert.deepEqual(1, storage.getItem(21).id);
    assert.deepEqual('Tom & Jerry', storage.getItem(21).name);
    assert.deepEqual(1, storage.getItemByPkey(1).id);
    assert.deepEqual(undefined, storage.getItemByPkey(1).year);

    done();
  })
})
