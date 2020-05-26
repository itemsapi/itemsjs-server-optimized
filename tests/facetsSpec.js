'use strict';

const assert = require('assert');
const service = require('./../src/lib');
const Facets = require('./../src/facets');
const helpers2 = require('./../src/helpers2');
const storage = require('./../src/storage');
const RoaringBitmap32 = require('roaring/RoaringBitmap32');
const items = require('./fixtures/items.json');

//https://jsfiddle.net/apsq2goz/4/

var facets;

describe('conjunctive search', function() {

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
    storage.dropDB();
    facets = new Facets();
    facets.index({
      json_object: items,
      append: false,
      configuration: configuration
    });
  });

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

    var ids = helpers2.facets_ids(result['bits_data_temp'], input.filters, configuration.aggregations);
    //assert.deepEqual(ids.toArray(), [1, 3, 4]);
    assert.deepEqual(result.ids.toArray(), [1, 3, 4]);

    var buckets = helpers2.getBuckets(result, input, configuration.aggregations);
    //console.log(buckets.tags.buckets);
    assert.deepEqual(buckets.tags.buckets[0].doc_count, 3);
    assert.deepEqual(buckets.tags.buckets[0].key, 'c');



    //var result = itemsjs.search(input);
    //assert.deepEqual(result.pagination.total, 3);
    //assert.deepEqual(result.data.aggregations.tags.buckets[0].doc_count, 3);
    //assert.deepEqual(result.data.aggregations.tags.buckets[0].key, 'c');

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

  xit('returns facets for empty input', function test(done) {

    var input = {
      filters: {
      }
    }

    var result = facets.search(input, {
      test: true
    });

    assert.deepEqual(result.data.tags.a, [1, 2, 3, 4]);
    assert.deepEqual(result.data.tags.e, [2]);

    var ids = helpers2.facets_ids(result['bits_data_temp'], input, configuration.aggregations);
    assert.deepEqual(ids, null);

    //var result = itemsjs.search(input);
    //assert.deepEqual(result.pagination.total, 4);
    //assert.deepEqual(result.data.aggregations.tags.buckets[0].doc_count, 4);
    //assert.deepEqual(result.data.aggregations.tags.buckets[0].key, 'a');





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

  var configuration = {
    aggregations: {
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
  }


  before(function() {
    storage.dropDB();
    facets = new Facets();
    facets.index({
      json_object: items,
      append: false,
      configuration: configuration
    });
  });




  it('checks configuration', function test(done) {
    assert.deepEqual(facets.configuration(), configuration);
    done();
  })

  it('calculates combination 2', function test(done) {


    var result = facets.load_indexes(input);

    var input = {
      filters: {
        tags: ['c']
      }
    }

    var union = helpers2.combination(result.bits_data_temp, input, configuration.aggregations);

    assert.deepEqual(union.tags, null);
    assert.deepEqual(union.actors.toArray(), [1, 3, 4]);
    assert.deepEqual(union.category.toArray(), [1, 3, 4]);


    var input = {
      filters: {
        tags: ['z']
      }
    }

    var union = helpers2.combination(result.bits_data_temp, input, configuration.aggregations);
    assert.deepEqual(union.tags, null);
    assert.deepEqual(union.actors.toArray(), [4]);
    assert.deepEqual(union.category.toArray(), [4]);


    var input = {
      filters: {
        tags: ['a']
      }
    }

    var union = helpers2.combination(result.bits_data_temp, input, configuration.aggregations);
    assert.deepEqual(union.tags, null);
    assert.deepEqual(union.actors.toArray(), [1, 2, 3, 4]);

    var input = {
      filters: {
        tags: ['z', 'f']
      }
    }

    var union = helpers2.combination(result.bits_data_temp, input, configuration.aggregations);
    assert.deepEqual(union.tags, null);
    assert.deepEqual(union.actors.toArray(), [2, 4]);
    assert.deepEqual(union.category.toArray(), [2, 4]);


    var input = {
      filters: {
        tags: ['z'],
        actors: ['jean']
      }
    }

    var union = helpers2.combination(result.bits_data_temp, input, configuration.aggregations);
    assert.deepEqual(union.tags.toArray(), [4]);
    assert.deepEqual(union.actors.toArray(), [4]);
    assert.deepEqual(union.category.toArray(), [4]);


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

  var configuration = {
    aggregations: {
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
  }

  before(function() {
    storage.dropDB();
    facets = new Facets();
    facets.index({
      json_object: items,
      append: false,
      configuration: configuration
    });
  });


  it('checks configuration', function test(done) {
    assert.deepEqual(facets.configuration(), configuration);
    done();
  })


  it('calculates combination 2', function test(done) {

    var result = facets.load_indexes(input);

    var input = {
      filters: {
        category: ['comedy']
      }
    }

    var union = helpers2.combination(result.bits_data_temp, input, configuration.aggregations);

    assert.deepEqual(union.tags.toArray(), [2, 3]);
    assert.deepEqual(union.actors.toArray(), [2, 3]);
    assert.deepEqual(union.category, null);

    var input = {
      filters: {
        category: ['comedy', 'drama']
      }
    }

    var union = helpers2.combination(result.bits_data_temp, input, configuration.aggregations);

    assert.deepEqual(union.tags.toArray(), [1, 2, 3, 4]);
    assert.deepEqual(union.actors.toArray(), [1, 2, 3, 4]);
    assert.deepEqual(union.category, null);

    var input = {
      filters: {
        category: ['comedy'],
        actors: ['john']
      }
    }

    var union = helpers2.combination(result.bits_data_temp, input, configuration.aggregations);

    assert.deepEqual(union.tags.toArray(), [2]);
    assert.deepEqual(union.actors.toArray(), [2]);
    assert.deepEqual(union.category.toArray(), [1, 2]);


    var input = {
      filters: {
        category: ['comedy', 'drama'],
        actors: ['john']
      }
    }

    var union = helpers2.combination(result.bits_data_temp, input, configuration.aggregations);

    assert.deepEqual(union.tags.toArray(), [1, 2]);
    assert.deepEqual(union.actors.toArray(), [1, 2]);
    assert.deepEqual(union.category.toArray(), [1, 2]);

    var input = {
      filters: {
        category: ['comedy', 'drama']
      }
    }

    var union = helpers2.combination(result.bits_data_temp, input, configuration.aggregations);

    assert.deepEqual(union.tags.toArray(), [1, 2, 3, 4]);
    assert.deepEqual(union.actors.toArray(), [1, 2, 3, 4]);
    assert.deepEqual(union.category, null);


    var input = {
      filters: {
        category: ['comedy', 'drama'],
        actors: ['john'],
        tags: ['b']
      }
    }

    var union = helpers2.combination(result.bits_data_temp, input, configuration.aggregations);

    assert.deepEqual(union.tags.toArray(), [1]);
    assert.deepEqual(union.actors.toArray(), [1]);
    assert.deepEqual(union.category.toArray(), [1]);

    var input = {
      filters: {
        category: ['drama'],
        tags: ['c']
      }
    }

    var union = helpers2.combination(result.bits_data_temp, input, configuration.aggregations);

    assert.deepEqual(union.tags.toArray(), [1, 4]);
    assert.deepEqual(union.actors.toArray(), [1, 4]);
    assert.deepEqual(union.category.toArray(), [1, 3, 4]);

    // reverse order of input
    var input = {
      filters: {
        tags: ['c'],
        category: ['drama'],
      }
    }

    var union = helpers2.combination(result.bits_data_temp, input, configuration.aggregations);

    assert.deepEqual(union.tags.toArray(), [1, 4]);
    assert.deepEqual(union.actors.toArray(), [1, 4]);
    assert.deepEqual(union.category.toArray(), [1, 3, 4]);



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
        category: ['drama'],
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

    var ids = helpers2.facets_ids(result['bits_data_temp'], input.filters, configuration.aggregations);
    assert.deepEqual(ids.toArray(), [1, 4]);

    done();

  })
})

describe('generates facets crossed with query', function() {

  var configuration =  {
    aggregations: {
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
  }


  before(function() {
    storage.dropDB();
    facets = new Facets();
    facets.index({
      json_object: items,
      append: false,
      configuration: configuration
    });
  });

  it('checks configuration', function test(done) {
    assert.deepEqual(facets.configuration(), configuration);
    done();
  })

  //var itemsjs = require('./../index')(items, {
    //aggregations: aggregations,
    //searchableFields: ['actors'],
  //});

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

    //var result = itemsjs.search(input);
    //assert.deepEqual(result.data.aggregations.tags.buckets[0].key, 'a');
    //assert.deepEqual(result.data.aggregations.tags.buckets[0].doc_count, 2);

    done();
  })
})

describe('negative filters', function() {

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
    storage.dropDB();
    facets = new Facets();
    facets.index({
      json_object: items,
      append: false,
      configuration: configuration
    });
  });

  it('excludes filter from search', function test(done) {

    var input = {
      not_filters: {
        tags: ['c']
      }
    }

    var result = facets.search(input, {
      test: true
    });

    assert.deepEqual(result.data.tags.a, [2]);
    assert.deepEqual(result.data.tags.c, []);
    assert.deepEqual(result.data.tags.e, [2]);
    assert.deepEqual(result.data.actors.john, [2]);

    assert.deepEqual(result.not_ids.toArray(), [1, 3, 4]);

    done();
  })

})


describe('small configuration', function() {

  var configuration = {
    aggregations: {
      category: {
        conjunction: false
      }
    }
  }

  before(function() {
    storage.dropDB();
    facets = new Facets();
    facets.index({
      json_object: items,
      append: false,
      configuration: configuration
    });
  });

  it('returns facets', function test(done) {

    var input = {
      filters: {
        category: ['drama']
      }
    }

    var result = facets.search(input, {
      test: true
    });

    assert.deepEqual(result.data.category.comedy, [2, 3]);

    done();
  })
})

describe('no configuration', function() {

  var configuration = {
    aggregations: {
    }
  }

  before(function() {
    storage.dropDB();
    facets = new Facets();
    facets.index({
      json_object: items,
      append: false,
      configuration: configuration
    });
  });

  it('returns facets', function test(done) {

    var input = {
      filters: {
      }
    }

    var result = facets.search(input, {
      test: true
    });

    assert.deepEqual(result.data, {});
    assert.deepEqual(result.ids, null);
    assert.deepEqual(result.not_ids, null);

    done();
  })

})
