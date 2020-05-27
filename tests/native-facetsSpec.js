'use strict';

const assert = require('assert');
const service = require('./../src/lib');
const Facets = require('./../src/facets');
const helpers2 = require('./../src/helpers2');
const storage = require('./../src/storage');
const RoaringBitmap32 = require('roaring/RoaringBitmap32');
const items = require('./fixtures/items.json');

var facets;

var assert_results = function(data1, data2) {

  /*assert.deepEqual(
    data1['ids'],
    data2['ids']
  );*/

  Object.keys(data1['bits_data_temp']).forEach(field => {
    Object.keys(data1['bits_data_temp'][field]).forEach((filter) => {
      assert.deepEqual(
        data1['bits_data_temp'][field][filter].size,
        data2['bits_data_temp'][field][filter],
      );
    })
  })
}


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

    var result = facets.search(input);

    var nresult = facets.search_native(input);
    assert_results(result, nresult);

    done();
  })

  it('checks if search is working on copy data', function test(done) {

    var input = {
      filters: {
        tags: ['e']
      }
    }

    var result = facets.search(input);
    var nresult = facets.search_native(input);
    assert_results(result, nresult);

    done();
  })

  it('returns facets for empty input', function test(done) {

    var input = {
      filters: {
      }
    }

    var result = facets.search(input);
    var nresult = facets.search_native(input);
    assert_results(result, nresult);

    var input = {
      filters: {
        tags: []
      }
    }

    var result = facets.search(input);
    var nresult = facets.search_native(input);
    assert_results(result, nresult);

    done();
  })

  it('returns facets for cross filters', function test(done) {

    var input = {
      filters: {
        tags: ['a'],
        actors: ['john']
      }
    }

    var result = facets.search(input);
    var nresult = facets.search_native(input);
    assert_results(result, nresult);

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

  it('returns facets', function test(done) {

    var input = {
      filters: {
        tags: ['c']
      }
    }

    var result = facets.search(input);
    var nresult = facets.search_native(input);
    assert_results(result, nresult);

    done();
  })

  it('returns facets for two filters', function test(done) {

    var input = {
      filters: {
        tags: ['z', 'f']
      }
    }

    var result = facets.search(input);
    var nresult = facets.search_native(input);
    assert_results(result, nresult);

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

  it('returns facets', function test(done) {

    var input = {
      filters: {
        tags: ['c']
      }
    }

    var result = facets.search(input);
    var nresult = facets.search_native(input);
    assert_results(result, nresult);

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

    var result = facets.search(input);
    var nresult = facets.search_native(input);
    assert_results(result, nresult);

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

  it('returns facets for searched ids', function test(done) {

    var input = {
      filters: {
        tags: ['c']
      }
    }

    var result = facets.search(input);
    var nresult = facets.search_native(input);
    assert_results(result, nresult);


    var input = {
      filters: {
        tags: ['c']
      }
    }

    var query_ids = new RoaringBitmap32([1]);
    var result = facets.search(input, {
      query_ids: query_ids,
      test: true
    });
    var nresult = facets.search_native(input, {
      query_ids: query_ids,
    });
    assert_results(result, nresult);

    done();
  });
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

  xit('excludes filter from search', function test(done) {

    var input = {
      not_filters: {
        tags: ['c']
      }
    }

    var result = facets.search(input);
    var nresult = facets.search_native(input);
    assert_results(result, nresult);

    done();
  })

})
