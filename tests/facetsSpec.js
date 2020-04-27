'use strict';

const should = require('should');
const expect = require('expect');
const assert = require('assert');
const service = require('./../src/lib');
const sinon = require('sinon');
const Facets = require('./../src/facets');
const helpers2 = require('./../src/helpers2');
const RoaringBitmap32 = require('roaring/RoaringBitmap32');

//https://jsfiddle.net/38a2xc1j/4/


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

describe('indexing', function() {


})

describe('conjunctive search', function() {

  var aggregations = {
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

  var facets = new Facets(items, aggregations);
  var itemsjs = require('./../index')(items, {
    aggregations: aggregations
  });

  it('checks index', function test(done) {

    var result = facets.index();
    assert.deepEqual(result.data.tags.a, [1, 2, 3, 4]);
    assert.deepEqual(result.bits_data.tags.a.toArray(), [1, 2, 3, 4]);
    assert.deepEqual(result.data.tags.b, [1]);
    assert.deepEqual(result.bits_data.tags.b.toArray(), [1]);
    assert.deepEqual(result.data.tags.c, [1, 3, 4]);
    assert.deepEqual(result.data.tags.d, [1]);
    assert.deepEqual(result.data.tags.e, [2]);
    assert.deepEqual(result.data.tags.z, [4]);
    assert.deepEqual(result.data.actors.jean, [4]);
    assert.deepEqual(result.bits_data.actors.jean.toArray(), [4]);
    assert.deepEqual(result.data.actors.john, [1, 2]);
    assert.deepEqual(result.bits_data.actors.john.toArray(), [1, 2]);

    done();
  })

  it('returns facets for two fields (tags, actors)', function test(done) {

    var input = {
      filters: {
        tags: ['c']
      }
    }

    var result = facets.search(input, {
      test: true
    });

    assert.deepEqual(result.data.tags.a, [1, 3, 4]);
    assert.deepEqual(result.data.tags.c, [1, 3, 4]);
    assert.deepEqual(result.data.tags.e, []);
    assert.deepEqual(result.data.actors.john, [1]);
    assert.deepEqual(result.data.category.comedy, [3]);

    var ids = helpers2.facets_ids(result['bits_data_temp'], input, aggregations);
    assert.deepEqual(ids.toArray(), [1, 3, 4]);

    var buckets = helpers2.getBuckets(result, input, aggregations);
    //console.log(buckets.tags.buckets);
    assert.deepEqual(buckets.tags.buckets[0].doc_count, 3);
    assert.deepEqual(buckets.tags.buckets[0].key, 'c');



    var result = itemsjs.search(input);
    //console.log(result.data);
    //console.log(result.data.aggregations.tags);

    assert.deepEqual(result.pagination.total, 3);
    // omit _id in search result
    //assert.deepEqual(result.data.items[0]._id, undefined);
    assert.deepEqual(result.data.aggregations.tags.buckets[0].doc_count, 3);
    assert.deepEqual(result.data.aggregations.tags.buckets[0].key, 'c');



    done();
  })




  it('checks if search is working on copy data', function test(done) {

    var input = {
      filters: {
        tags: ['e']
      }
    }

    var result = facets.search(input, {
      test: true
    });

    //assert.deepEqual(result.bits_data.tags.a.toArray(), []);
    assert.deepEqual(result.data.tags.a, [2]);
    assert.deepEqual(result.data.tags.e, [2]);
    //assert.deepEqual(result.bits_data.tags.e.toArray(), [2]);
    //assert.deepEqual(result.data.actors.john, [1]);

    done();

  })

  it('returns facets for empty input', function test(done) {

    var input = {
      filters: {
      }
    }

    var result = facets.search(input, {
      test: true
    });

    assert.deepEqual(result.data.tags.a, [1, 2, 3, 4]);
    assert.deepEqual(result.data.tags.e, [2]);

    var ids = helpers2.facets_ids(result['bits_data_temp'], input, aggregations);
    assert.deepEqual(ids, null);

    var result = itemsjs.search(input);
    console.log(result.data);
    console.log(result.data.aggregations.tags);

    assert.deepEqual(result.pagination.total, 4);
    // omit _id in search result
    //assert.deepEqual(result.data.items[0]._id, undefined);
    assert.deepEqual(result.data.aggregations.tags.buckets[0].doc_count, 4);
    assert.deepEqual(result.data.aggregations.tags.buckets[0].key, 'a');





    var input = {
      filters: {
        tags: []
      }
    }





    var result = facets.search(input, {
      test: true
    });

    assert.deepEqual(result.data.tags.a, [1, 2, 3, 4]);
    assert.deepEqual(result.data.tags.e, [2]);

    done();
  })

  xit('returns facets for not existed filters (does not exist in index)', function test(done) {

    var input = {
      filters: {
        tags: ['kkk']
      }
    }

    var result = facets.search(input, {
      test: true
    });

    assert.deepEqual(result.data.tags.a, []);
    assert.deepEqual(result.data.tags.e, []);

    done();
  })

  it('returns facets for cross filters', function test(done) {

    var input = {
      filters: {
        tags: ['a'],
        actors: ['john']
      }
    }

    var result = facets.search(input, {
      test: true
    });

    assert.deepEqual(result.data.tags.a, [1, 2]);
    assert.deepEqual(result.data.tags.e, [2]);
    assert.deepEqual(result.data.actors.john, [1, 2]);
    assert.deepEqual(result.data.actors.jean, []);

    done();
  })
})

describe('disjunctive search', function() {

  var aggregations = {
    tags: {
      conjunction: false,
    },
    actors: {
      conjunction: false,
    },
    category: {
      conjunction: false,
    }
  }

  var facets = new Facets(items, aggregations);

  it('makes disjunction union', function test(done) {

    var facets_bits = {
      tags: {
        a: new RoaringBitmap32([1, 2, 3]),
        b: new RoaringBitmap32([1, 2, 3, 5]),
        c: new RoaringBitmap32([7, 9])
      },
      actors: {
        jean: new RoaringBitmap32([1, 2, 3])
      }
    }

    var input = {
      filters: {
        tags: ['a', 'b']
      }
    }

    var union = helpers2.disjunction_union(facets_bits, input, aggregations);
    assert.deepEqual(union.tags.toArray(), [1, 2, 3, 5]);
    assert.deepEqual(union.actors, undefined);

    var input = {
      filters: {
        tags: ['a']
      }
    }

    var union = helpers2.disjunction_union(facets_bits, input, aggregations);
    assert.deepEqual(union.tags.toArray(), [1, 2, 3]);

    done();
  })

  it('returns facets', function test(done) {

    var input = {
      filters: {
        tags: ['c']
      }
    }

    var result = facets.search(input, {
      test: true
    });

    assert.deepEqual(result.data.tags.a, [1, 2, 3, 4]);
    assert.deepEqual(result.data.tags.c, [1, 3, 4]);
    assert.deepEqual(result.data.tags.e, [2]);
    assert.deepEqual(result.data.actors.john, [1]);

    done();
  })

  it('returns facets for two filters', function test(done) {

    var input = {
      filters: {
        tags: ['z', 'f']
      }
    }

    var result = facets.search(input, {
      test: true
    });

    assert.deepEqual(result.data.tags.a, [1, 2, 3, 4]);
    assert.deepEqual(result.data.tags.c, [1, 3, 4]);
    assert.deepEqual(result.data.tags.f, [2]);
    assert.deepEqual(result.data.tags.z, [4]);

    assert.deepEqual(result.data.actors.brad, [2]);
    assert.deepEqual(result.data.actors.jean, [4]);
    assert.deepEqual(result.data.actors.brad, [2]);

    assert.deepEqual(result.data.category.comedy, [2]);
    assert.deepEqual(result.data.category.drama, [4]);

    done();
  })

})

describe('disjunctive and conjunctive search', function() {

  var aggregations = {
    tags: {
      conjunction: true,
    },
    actors: {
      conjunction: true,
    },
    category: {
      conjunction: false
    }
  }

  var facets = new Facets(items, aggregations);


  it('makes combination', function test(done) {

    var facets_bits = {
      tags: {
        a: new RoaringBitmap32([1, 2, 3]),
        b: new RoaringBitmap32([1, 2, 3, 5]),
        c: new RoaringBitmap32([7, 9])
      },
      category: {
        drama: new RoaringBitmap32([6, 7, 9]),
        comedy: new RoaringBitmap32([6, 7, 9])
      }
    }

    var input = {
      filters: {
        tags: ['a', 'b'],
        category: ['drama', 'comedy']
      }
    }

    var combination = helpers2.combination(facets_bits, input, aggregations);
    assert.deepEqual(combination.tags.toArray(), [1, 2, 3]);


    // make sure it's needed
    assert.deepEqual(combination.category.toArray(), [6, 7, 9]);


    done();
  })


  it('returns facets', function test(done) {

    var input = {
      filters: {
        tags: ['c']
      }
    }

    var result = facets.search(input, {
      test: true
    });


    assert.deepEqual(result.data.tags.a, [1, 3, 4]);
    assert.deepEqual(result.data.tags.e, []);
    assert.deepEqual(result.data.actors.john, [1]);
    assert.deepEqual(result.data.category.comedy, [3]);

    done();
  })

  it('returns facets for cross filters', function test(done) {

    var input = {
      filters: {
        tags: ['c'],
        category: ['drama']
      }
    }

    var result = facets.search(input, {
      test: true
    });

    assert.deepEqual(result.data.tags.a, [1, 4]);
    assert.deepEqual(result.data.tags.c, [1, 4]);
    assert.deepEqual(result.data.tags.e, []);
    assert.deepEqual(result.data.actors.john, [1]);
    assert.deepEqual(result.data.actors.alex, [1]);
    assert.deepEqual(result.data.category.comedy, [3]);
    assert.deepEqual(result.data.category.drama, [1, 4]);

    var ids = helpers2.facets_ids(result['bits_data_temp'], input, aggregations);
    assert.deepEqual(ids.toArray(), [1, 4]);

    done();

  })
})









describe('generates facets crossed with query', function() {

  var aggregations = {
    tags: {
      conjunction: true,
    },
    actors: {
      conjunction: true,
    },
    category: {
      conjunction: false
    }
  }

  var facets = new Facets(items, aggregations);
  var itemsjs = require('./../index')(items, {
    aggregations: aggregations,
    searchableFields: ['actors'],
  });

  it('returns facets for searched ids', function test(done) {

    var input = {
      filters: {
        tags: ['c']
      }
    }

    var result = facets.search(input, {
      test: true
    });

    assert.deepEqual(result.data.tags.a, [1, 3, 4]);
    assert.deepEqual(result.data.tags.e, []);
    assert.deepEqual(result.data.actors.john, [1]);
    assert.deepEqual(result.data.category.comedy, [3]);


    var input = {
      filters: {
        tags: ['c']
      }
    }

    var result = facets.search(input, {
      query_ids: new RoaringBitmap32([1]),
      test: true
    });

    assert.deepEqual(result.data.tags.a, [1]);
    assert.deepEqual(result.data.tags.e, []);
    assert.deepEqual(result.data.actors.john, [1]);
    assert.deepEqual(result.data.category.comedy, []);

    done();
  });

  it('returns facets for searched ids', function test(done) {

    var input = {
      query: 'john'
    }

    var result = itemsjs.search(input);
    //console.log(result.data);
    //console.log(result.data.aggregations.tags);

    assert.deepEqual(result.data.aggregations.tags.buckets[0].key, 'a');
    assert.deepEqual(result.data.aggregations.tags.buckets[0].doc_count, 2);

    done();
  })
})
