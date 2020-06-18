'use strict';

const assert = require('assert');
const Facets = require('./../src/facets');
const storage = require('./../src/storage');
const lib = require('./../src/lib');
const items = require('./fixtures/movies.json');
var facets = new Facets();

var configuration = {
  aggregations: {
    actors: {
      conjunction: true,
    },
    genres: {
      conjunction: true,
      //size: 5,
    },
    year: {
      conjunction: true,
    },
    director: {
      conjunction: true,
    }
  }
}

describe('aggregation / facet', function() {

  before(function(done) {
    storage.dropDB();

    facets.index({
      json_object: items,
      append: false,
      configuration: configuration
    });

    done();
  });

  it('makes error if name does not exist', function test(done) {

    try {
      var result = lib.aggregation({
        name: 'category2'
      }, configuration, facets);
    } catch (err) {
      assert.equal(err.message, 'Please define aggregation "category2" in config');
    }

    done();
  })

  it('makes single facet', function test(done) {

    var result = lib.aggregation({
      name: 'genres'
    }, configuration, facets);

    assert.equal(result.data.buckets.length, 10);

    done();
  })

  it('makes single facet with pagination', function test(done) {

    var result = lib.aggregation({
      name: 'genres',
      page: 1,
      per_page: 1
    }, configuration, facets);

    assert.equal(result.data.buckets.length, 1);

    done();
  })

  it('makes single facet pagination', function test(done) {

    var result = lib.aggregation({
      name: 'genres',
      page: 1,
      per_page: 12
    }, configuration, facets);

    assert.equal(result.data.buckets.length, 12);
    console.log(result.data);

    done();
  })

  it('makes single facet with query', function test(done) {

    var result = lib.aggregation({
      name: 'genres',
      page: 1,
      query: 'action',
      per_page: 12
    }, configuration, facets);

    assert.equal(result.data.buckets.length, 1);

    done();
  })

  it('makes single facet with wildcard query', function test(done) {

    var result = lib.aggregation({
      name: 'genres',
      page: 1,
      query: 'acti*',
      per_page: 12
    }, configuration, facets);

    assert.equal(result.data.buckets.length, 1);

    done();
  })

  it('makes single facet with wildcard query 2', function test(done) {

    var result = lib.aggregation({
      name: 'genres',
      page: 1,
      query: '*ctio*',
      per_page: 12
    }, configuration, facets);

    assert.equal(result.data.buckets.length, 1);

    done();
  })
})

