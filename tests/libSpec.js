'use strict';

const assert = require('assert');
const Facets = require('./../src/facets');
const storage = require('./../src/storage');
const lib = require('./../src/lib');
const items = require('./fixtures/items.json');
var facets = new Facets();

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
    storage.dropDB();
    storage.deleteConfiguration();
    facets.index({
      json_object: items,
      configuration: configuration
    });
    done();
  });

  it('search 1', function test(done) {


    var input = {
      //query: 'okej',
      per_page: 100,
      filters: {
        tags: ['a'],
        category: ['drama']
      }
    }

    for (var i = 0 ; i < 20 ; ++i) {
      var result = lib.search(input, configuration, facets);
      //console.log(result);
      assert.deepEqual(result.pagination.total, 2);
    }

    done();
  })

  it('search asceding / descending order', function test(done) {

    var input = {
      per_page: 100,
    }

    var result = lib.search(input, configuration, facets);
    assert.deepEqual(result.pagination.total, 4);
    assert.deepEqual(result.data.items[0].id, 1);

    var input = {
      per_page: 100,
      order: 'desc'
    }

    var result = lib.search(input, configuration, facets);
    assert.deepEqual(result.pagination.total, 4);
    assert.deepEqual(result.data.items[0].id, 4);

    done();
  })

  it('makes simple filter with two fields', function test(done) {

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

})

