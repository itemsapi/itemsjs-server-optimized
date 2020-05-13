'use strict';

const assert = require('assert');
const Facets = require('./../src/facets');
const storage = require('./../src/storage');
const lib = require('./../src/lib');

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

