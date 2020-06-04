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
      append: false
    });

    var ids = storage.getIdsBitmap();
    assert.deepEqual(ids.size, 20);

    //console.log(storage.getItem(1));

    var filter_index = storage.getFilterIndex('genres.Drama');
    assert.deepEqual(15, filter_index.size);

    var index = storage.getSearchTermIndex('shawshank');
    assert.deepEqual(1, index.size);

    var index = storage.getSearchTermIndex('men');
    assert.deepEqual(6, index.size);

    var index = storage.getSearchTermIndex('golden');
    assert.deepEqual(2, index.size);

    storage.delete_item(1);

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

    assert.equal(undefined, storage.getInternalId(1));

    done();
  })


  it('deletes all', function test(done) {

    for (var i = 1 ; i <= 20 ; ++i) {
      storage.delete_item(i);
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

