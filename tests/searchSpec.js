'use strict';

const assert = require('assert');
const Facets = require('./../src/facets');
const storage = require('./../src/storage');
const lib = require('./../src/lib');
const items = require('./fixtures/items.json');

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

describe('search', function() {

  before(function(done) {
    storage.deleteConfiguration();
    done();
  });

  beforeEach(function(done) {
    storage.dropDB();
    done();
  });

  it('index is empty so cannot search', function test(done) {

    var itemsjs = require('./../src/index')();


    try {

      var result = itemsjs.search();
    } catch (err) {
      assert.equal(err.message, 'index first then search');
    }

    done();
  })


  it('search 1', function test(done) {

    var facets = new Facets();
    facets.index({
      json_object: items,
      append: false,
      configuration: configuration
    });

    var input = {
      filters: {
        tags: ['a'],
        category: ['drama']
      }
    }

    var result = lib.search(input, configuration, facets);
    assert.equal(result.data.items.length, 2);

    done();
  })

  it('searches with query', function test(done) {

    var facets = new Facets();
    facets.index({
      json_object: items,
      append: false,
      configuration: configuration
    });

    var input = {
      filters: {
        tags: ['a'],
        category: ['drama']
      },
      query: 'movie4'
    }

    var result = lib.search(input, configuration, facets);

    assert.equal(result.data.items.length, 1);

    done();
  })

  it('search 2', function test(done) {

    var itemsjs = require('./../src/index')();

    itemsjs.index({
      json_object: items,
      append: false,
      configuration: configuration
    });

    var result = itemsjs.search({
      filters: {
        tags: ['a'],
        category: ['drama']
      }
    });

    assert.equal(result.data.items.length, 2);

    done();
  })

  it('search 3', function test(done) {

    var itemsjs = require('./../src/index')();

    itemsjs.index({
      json_object: items,
      configuration: configuration,
      append: false
    });

    var result = itemsjs.search({
      filters: {
      }
    });

    assert.equal(result.data.items.length, 4);

    done();
  })


})

