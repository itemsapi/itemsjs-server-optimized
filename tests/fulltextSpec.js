'use strict';

const assert = require('assert');
const storage = require('./../src/storage');
const Facets = require('./../src/facets');

var facets;
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

describe('full text', function() {

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

  before(function() {
    facets = new Facets();
    facets.index({
      json_object: data,
      configuration: configuration
    });
  });

  it('makes simple search', function test(done) {

    var input = {
      query: 'drama'
    }

    var result = facets.fulltext(input);

    assert.deepEqual(result.toArray(), [1, 4]);

    var input = {
      query: 'john'
    }

    var result = facets.fulltext(input);

    assert.deepEqual(result.toArray(), [1, 2]);

    done();
  })

  it('makes two words (union) search', function test(done) {

    var input = {
      query: 'drama john'
    }

    var result = facets.fulltext(input);
    assert.deepEqual(result.toArray(), [1, 2, 4]);

    done();
  })
})

