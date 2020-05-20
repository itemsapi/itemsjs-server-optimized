'use strict';

const assert = require('assert');
const storage = require('./../src/storage');
const Facets = require('./../src/facets');
const data = require('./fixtures/items.json');

var facets;

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
      append: false,
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

  xit('makes two words (union) search', function test(done) {

    var input = {
      query: 'drama john'
    }

    var result = facets.fulltext(input);
    assert.deepEqual(result.toArray(), [1, 2, 4]);

    done();
  })

  it('makes simple search with not existing term', function test(done) {

    var input = {
      query: 'drama2123'
    }

    var result = facets.fulltext(input);
    assert.deepEqual(result.toArray(), []);
    done();
  })

})

