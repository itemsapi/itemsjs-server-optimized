'use strict';

const should = require('should');
const expect = require('expect');
const assert = require('assert');
const Facets = require('./../src/facets');
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

describe('indexing', function() {

  it('search 1', function test(done) {

    var facets = new Facets(configuration.aggregations);
    facets.index(items, configuration.aggregations);

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

    var itemsjs = require('./../src/index')(configuration);

    itemsjs.index(items);

    var result = itemsjs.search({
      filters: {
        tags: ['a'],
        category: ['drama']
      }
    });

    assert.equal(result.data.items.length, 2);

    done();
  })

})

