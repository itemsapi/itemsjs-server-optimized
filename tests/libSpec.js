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
    storage.dropDB();
    storage.deleteConfiguration();
    done();
  });

  it('search 1', function test(done) {

    var facets = new Facets();
    facets.index({
      json_object: items,
      configuration: configuration
    });

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
    }

    done();
  })
})

