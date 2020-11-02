'use strict';

const assert = require('assert');
const Facets = require('./../src/facets');
const storage = require('./../src/storage');
const lib = require('./../src/lib');
const items = require('./fixtures/movies.json');
const INDEX_PATH = './data/db.mdb';
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

  before(async function() {
    storage.dropDB(INDEX_PATH);

    await facets.index(INDEX_PATH, {
      json_object: items,
      append: false,
      configuration: configuration
    });
  });

  it('makes error if name does not exist', async function test() {

    try {
      var result = await lib.aggregation(INDEX_PATH, {
        name: 'category2'
      }, configuration, facets);
    } catch (err) {
      assert.equal(err.message, 'Please define aggregation "category2" in config');
    }

  })

  it('makes single facet', async function test() {

    var result = await lib.aggregation(INDEX_PATH, {
      name: 'genres'
    }, configuration, facets);

    assert.equal(result.data.buckets.length, 10);

  })

  it('makes single facet with pagination', async function test() {

    var result = await lib.aggregation(INDEX_PATH, {
      name: 'genres',
      page: 1,
      per_page: 1
    }, configuration, facets);

    assert.equal(result.data.buckets.length, 1);
  })

  it('makes single facet pagination', async function test() {

    var result = await lib.aggregation(INDEX_PATH, {
      name: 'genres',
      page: 1,
      per_page: 12
    }, configuration, facets);

    assert.equal(result.data.buckets.length, 12);
  })

  it('makes single facet with query', async function test() {

    var result = await lib.aggregation(INDEX_PATH, {
      name: 'genres',
      page: 1,
      query: 'action',
      per_page: 12
    }, configuration, facets);

    assert.equal(result.data.buckets.length, 1);
  })

  it('makes single facet with wildcard query', async function test() {

    var result = await lib.aggregation(INDEX_PATH, {
      name: 'genres',
      page: 1,
      query: 'acti*',
      per_page: 12
    }, configuration, facets);

    assert.equal(result.data.buckets.length, 1);
  })

  it('makes single facet with wildcard query 2', async function test() {

    var result = await lib.aggregation(INDEX_PATH, {
      name: 'genres',
      page: 1,
      query: '*ctio*',
      per_page: 12
    }, configuration, facets);

    assert.equal(result.data.buckets.length, 1);
  })
})
