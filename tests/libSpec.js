'use strict';

const assert = require('assert');
const Facets = require('./../src/facets');
const storage = require('./../src/storage');
const lib = require('./../src/lib');
const items = require('./fixtures/items.json');
var facets = new Facets();

describe('search', function() {

  var configuration = {
    aggregations: {
      tags: {
        conjunction: true,
      },
      actors: {
        conjunction: true,
      },
      category: {
        conjunction: true,
      }
    }
  }

  before(async function() {
    storage.dropDB();
    await facets.index({
      json_object: items,
      configuration: configuration
    });
  });

  it('search 1', function test(done) {


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
      //console.log(result);
      assert.deepEqual(result.pagination.total, 2);
    }

    done();
  })

  it('search asceding / descending order', function test(done) {

    var input = {
      per_page: 100,
    }

    var result = lib.search(input, configuration, facets);
    assert.deepEqual(result.pagination.total, 4);
    assert.deepEqual(result.data.items[0].id, 1);

    var input = {
      per_page: 100,
      order: 'desc'
    }

    var result = lib.search(input, configuration, facets);
    assert.deepEqual(result.pagination.total, 4);
    assert.deepEqual(result.data.items[0].id, 4);

    done();
  })

  it('makes simple filter with two fields', function test(done) {

    var input = {
      filters: {
        tags: ['a'],
        category: ['drama']
      }
    }

    var result = lib.search(input, configuration, facets);
    assert.equal(result.data.items.length, 2);

    done();
  })

  it('searches with query', function test(done) {

    var input = {
      filters: {
        tags: ['a'],
        category: ['drama']
      },
      query: 'movie4'
    }

    var result = lib.search(input, configuration, facets);

    assert.equal(result.data.items.length, 1);

    done();
  })

})

describe('movies search', function() {

  var configuration = {
    aggregations: {
      director: {
        conjunction: true,
      },
      actors: {
        conjunction: true,
      },
      genres: {
        conjunction: true,
      },
      tags: {
        conjunction: true,
      },
      country: {
        conjunction: true,
      }
    }
  }

  before(async function() {
    storage.dropDB();
    await facets.index({
      json_path: './tests/fixtures/movies.json',
      faceted_fields: ['actors', 'genres', 'year', 'director'],
      sorting_fields: ['votes', 'year'],
      configuration: configuration
    });
  });

  it('search with sorting', function test(done) {

    var input = {
      per_page: 5,
      sort_field: 'year',
      order: 'asc'
    }

    var result = lib.search(input, configuration, facets);
    console.log(result.data.items.map(v => {
      return {
        name: v.name, year: v.year
      }
    }));
    assert.deepEqual(1957, result.data.items[0].year);

    var input = {
      per_page: 5,
      sort_field: 'year',
      order: 'desc'
    }

    var result = lib.search(input, configuration, facets);
    assert.deepEqual(2016, result.data.items[0].year);

    done();
  })
})

describe('proximity search', function() {

  var configuration = {
    aggregations: {
    }
  }

  before(async function() {
    storage.dropDB();
    await facets.index({
      json_path: './tests/fixtures/movies.json',
      configuration: configuration
    });
  });

  it('search', function test(done) {

    var input = {
      per_page: 5,
      query: 'shawshank redemption'
    }

    var result = lib.search(input, configuration, facets);
    assert.deepEqual(result.data.items[0].name, 'The Shawshank Redemption');

    done();
  })

  it('makes proximity search', function test(done) {

    var input = {
      per_page: 5,
      query: 'in the'
    }

    var result = lib.search(input, configuration, facets);
    //assert.deepEqual(result.pagination.total, 12);
    assert.deepEqual(result.pagination.total, 18);

    done();
  })
})
