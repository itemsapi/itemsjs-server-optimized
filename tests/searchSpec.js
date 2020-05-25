'use strict';

const assert = require('assert');
const Facets = require('./../src/facets');
const storage = require('./../src/storage');
const lib = require('./../src/lib');
const items = require('./fixtures/items.json');
var itemsjs = require('./../src/index')();

describe('search', function() {

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

  before(function(done) {
    storage.deleteConfiguration();
    done();
  });

  beforeEach(function(done) {
    storage.dropDB();
    done();
  });

  it('index is empty so cannot search', function test(done) {

    try {

      var result = itemsjs.search();
    } catch (err) {
      assert.equal(err.message, 'index first then search');
    }

    done();
  })

  it('searches with two filters', function test(done) {


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

  it('makes search with empty filters', function test(done) {

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

  it('makes search with not filters', function test(done) {

    itemsjs.index({
      json_object: items,
      configuration: configuration,
      append: false
    });

    var result = itemsjs.search({
      not_filters: {
        tags: ['c']
      }
    });

    assert.equal(result.data.items.length, 1);

    done();
  })

  it('makes search with many not filters', function test(done) {

    itemsjs.index({
      json_object: items,
      configuration: configuration,
      append: false
    });

    var result = itemsjs.search({
      not_filters: {
        tags: ['c', 'e']
      }
    });

    assert.equal(result.data.items.length, 0);

    done();
  })
})


describe('no configuration', function() {

  var configuration = {
    aggregations: {
    }
  }

  before(function(done) {
    storage.deleteConfiguration();
    storage.dropDB();
    itemsjs.index({
      json_object: items,
      append: false,
      configuration: configuration
    });
    done();
  });

  it('searches with two filters', function test(done) {

    var result = itemsjs.search({
    });

    assert.equal(result.data.items.length, 4);

    done();
  })
})
