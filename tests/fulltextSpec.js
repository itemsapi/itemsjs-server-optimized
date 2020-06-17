'use strict';

const assert = require('assert');
const storage = require('./../src/storage');
const Facets = require('./../src/facets');
const data = require('./fixtures/items.json');
const movies = require('./fixtures/movies.json');
const addon = require('bindings')('itemsjs_addon.node');

var facets;

describe('query parser', function() {

  before(function() {
    facets = new Facets();
  });

  it('splits query', function test(done) {

    assert.deepEqual(facets.query_parser2('IPhone II'), ['iphone', 'ii']);
    assert.deepEqual(facets.query_parser2('ok! super'), ['ok', 'super']);
    assert.deepEqual(facets.query_parser2('ΟΔΥΣΣΕΥΣ'), ['ΟΔΥΣΣΕΥΣ']);
    assert.deepEqual(facets.query_parser2('domain.com http://www.domain2.com'), ['domain', 'com', 'http', 'www', 'domain2', 'com']);

    done();
  })

})


describe('proximity search', function() {

  before(function() {
    facets = new Facets();
    facets.index({
      json_object: movies,
      append: false
    });
  });

  it('makes simple search', function test(done) {

    var input = {
      query: 'shawshank redemption test'
    }

    var result = facets.proximity_search(input);

    assert.deepEqual(result.toArray(), [1]);

    done();
  })
})

describe('full text', function() {

  before(function() {
    facets = new Facets();
    facets.index({
      json_object: data,
      append: false
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

  it('makes simple search with not existing term', function test(done) {

    var input = {
      query: 'nnn'
    }

    var result = facets.fulltext(input);
    assert.deepEqual(result.toArray(), []);
    done();
  })

})

