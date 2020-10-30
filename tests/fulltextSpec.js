'use strict';

const assert = require('assert');
const storage = require('./../src/storage');
const Facets = require('./../src/facets');
const data = require('./fixtures/items.json');
const movies = require('./fixtures/movies.json');
const addon = require('bindings')('itemsjs_addon.node');
const RoaringBitmap32 = require('roaring/RoaringBitmap32');

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

  before(async function() {
    facets = new Facets();
    await facets.index({
      json_object: movies,
      index_path: INDEX_PATH,
      append: false
    });
  });

  it('makes simple search', function test(done) {

    var input = {
      query: 'shawshank redemption test'
    }

    var result = facets.proximity_search(INDEX_PATH, input);

    assert.deepEqual(result.toArray(), [1]);

    done();
  })

  it('returns empty bitmap if empty query', function test(done) {

    var input = {
    }

    var result = facets.proximity_search(INDEX_PATH, input);

    assert.deepEqual(result.toArray(), []);

    done();
  })

  it('returns empty bitmap if empty query and not empty query_ids', function test(done) {

    var input = {
    }

    var result = facets.proximity_search(INDEX_PATH, input, new RoaringBitmap32([1]));

    assert.deepEqual(result.toArray(), []);

    done();
  })
})

describe('full text', function() {

  before(async function() {
    facets = new Facets();
    await facets.index({
      json_object: data,
      index_path: INDEX_PATH,
      append: false
    });
  });

  it('makes simple search', function test(done) {

    var input = {
      query: 'drama'
    }

    var result = facets.fulltext(INDEX_PATH, input);

    assert.deepEqual(result.toArray(), [1, 4]);

    var input = {
      query: 'john'
    }

    var result = facets.fulltext(INDEX_PATH, input);

    assert.deepEqual(result.toArray(), [1, 2]);

    done();
  })

  xit('makes two words (union) search', function test(done) {

    var input = {
      query: 'drama john'
    }

    var result = facets.fulltext(INDEX_PATH, input);
    assert.deepEqual(result.toArray(), [1, 2, 4]);

    done();
  })

  it('makes simple search with not existing term', function test(done) {

    var input = {
      query: 'drama2123'
    }

    var result = facets.fulltext(INDEX_PATH, input);
    assert.deepEqual(result.toArray(), []);
    done();
  })

  it('makes simple search with not existing term', function test(done) {

    var input = {
      query: 'nnn'
    }

    var result = facets.fulltext(INDEX_PATH, input);
    assert.deepEqual(result.toArray(), []);
    done();
  })
})
