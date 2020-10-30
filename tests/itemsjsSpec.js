'use strict';

const assert = require('assert');
const Facets = require('./../src/facets');
const storage = require('./../src/storage');
const lib = require('./../src/lib');
const items = require('./fixtures/items.json');
var itemsjs = require('./../src/index')();
const INDEX_PATH = './data/db.mdb';
const INDEX_NAME = 'db';

describe('search', function() {

  var configuration = {
    aggregations: {
      tags: {
        title: 'Tags',
        conjunction: true,
      },
      actors: {
        title: 'Actors',
        conjunction: true,
      },
      category: {
        title: 'Category',
        conjunction: true,
      }
    }
  }

  before(function(done) {
    storage.deleteConfiguration(INDEX_PATH);
    done();
  });

  beforeEach(function(done) {
    storage.dropDB(INDEX_PATH);
    done();
  });

  it('index is empty so cannot search', function test(done) {

    try {

      var result = itemsjs.search(INDEX_NAME);
    } catch (err) {
      assert.equal(err.message, 'index first then search');
    }

    done();
  })

  /*it('cannot search with invalid index name', function test(done) {

    try {

      var result = itemsjs.search('A A A');
    } catch (err) {
      assert.equal(err.message, 'invalid index name');
    }

    done();
  })*/

  it('searches with two filters', async function test() {

    await itemsjs.index(INDEX_NAME, {
      json_object: items,
      append: false,
      configuration: configuration
    });

    var result = itemsjs.search(INDEX_NAME, {
      filters: {
        tags: ['a'],
        category: ['drama']
      }
    });

    assert.equal(result.data.items.length, 2);
    assert.equal(result.data.aggregations.tags.buckets[0].doc_count, 2);

  })

  it('searches with filter and query', async function test() {


    await itemsjs.index(INDEX_NAME, {
      json_object: items,
      append: false,
      configuration: configuration
    });

    var result = itemsjs.search(INDEX_NAME, {
      filters: {
        tags: ['a'],
      },
      query: 'comedy'
    });

    assert.equal(result.data.items.length, 2);
    assert.equal(result.data.aggregations.tags.buckets[0].doc_count, 2);
    assert.equal(result.data.aggregations.category.buckets[0].key, 'comedy');
    assert.equal(result.data.aggregations.category.buckets[0].doc_count, 2);
  })


  it('makes search with empty filters', async function test() {

    await itemsjs.index(INDEX_NAME, {
      json_object: items,
      configuration: configuration,
      append: false
    });

    var result = itemsjs.search(INDEX_NAME, {
      filters: {
      }
    });

    assert.equal(result.data.items.length, 4);
  })

  it('makes search with not filters', async function test() {

    await itemsjs.index(INDEX_NAME, {
      json_object: items,
      configuration: configuration,
      append: false
    });

    var result = itemsjs.search(INDEX_NAME, {
      not_filters: {
        tags: ['c']
      }
    });

    assert.equal(result.data.items.length, 1);
  })

  it('makes search with many not filters', async function test() {

    await itemsjs.index(INDEX_NAME, {
      json_object: items,
      configuration: configuration,
      append: false
    });

    var result = itemsjs.search(INDEX_NAME, {
      not_filters: {
        tags: ['c', 'e']
      }
    });

    assert.equal(result.data.items.length, 0);
  })
})


describe('no configuration', function() {

  var configuration = {
    aggregations: {
    }
  }

  before(async function() {
    storage.deleteConfiguration(INDEX_PATH);
    storage.dropDB(INDEX_PATH);
    await itemsjs.index(INDEX_NAME, {
      json_object: items,
      append: false,
      configuration: configuration
    });
  });

  it('searches with two filters', function test(done) {

    var result = itemsjs.search(INDEX_NAME, {
    });

    assert.equal(result.data.items.length, 4);

    done();
  })
})
