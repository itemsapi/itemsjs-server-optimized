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

  before(function() {
    storage.deleteConfiguration();
  });

  it('index is empty so cannot search', function test(done) {

    var itemsjs = require('./../src/index')();


    try {

      var result = itemsjs.search();
    } catch (err) {
      assert.equal(err.message, 'index first then search');
    }

    done();
  })


  it('search 1', function test(done) {

    var facets = new Facets();
    facets.index({
      json_object: items,
      configuration: configuration
    });

    var input = {
      filters: {
        tags: ['a'],
        category: ['drama']
      }
    }

    var result = lib.search(input, configuration, facets);

    //console.log(result);
    //console.log(result.data.items);
    //console.log(result.data.aggregations.tags);

    assert.equal(result.data.items.length, 2);

    done();
  })

  it('search 2', function test(done) {

    var itemsjs = require('./../src/index')();

    itemsjs.index({
      json_object: items,
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

  it('search 3', function test(done) {

    var itemsjs = require('./../src/index')();

    itemsjs.index({
      json_object: items,
      configuration: configuration
    });

    var result = itemsjs.search({
      filters: {
      }
    });

    assert.equal(result.data.items.length, 4);

    done();
  })


})

