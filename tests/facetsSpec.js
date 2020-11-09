'use strict';

const assert = require('assert');
const service = require('./../src/lib');
const Facets = require('./../src/facets');
const helpers2 = require('./../src/helpers2');
const storage = require('./../src/storage');
const RoaringBitmap32 = require('roaring/RoaringBitmap32');
const items = require('./fixtures/items.json');
const INDEX_PATH = './data/db.mdb';

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

  before(async function() {
    storage.dropDB(INDEX_PATH);
    facets = new Facets();
    await facets.index(INDEX_PATH, {
      json_object: items,
      append: false,
      configuration: configuration
    });
  });

  it('returns facets for two fields (tags, actors)', async function test() {

    var input = {
      filters: {
        tags: ['c']
      }
    }

    var result = await facets.search_native(INDEX_PATH, input, {
      testing: true
    });

    assert.deepEqual(result.data.tags.a, [1, 3, 4]);
    assert.deepEqual(result.data.tags.c, [1, 3, 4]);
    assert.deepEqual(result.data.tags.e, []);
    assert.deepEqual(result.data.actors.john, [1]);
    assert.deepEqual(result.data.category.comedy, [3]);
    assert.deepEqual(result.ids.toArray(), [1, 3, 4]);

    var buckets = helpers2.getBuckets(result, input, configuration.aggregations);
    assert.deepEqual(buckets.tags.buckets[0].doc_count, 3);
    assert.deepEqual(buckets.tags.buckets[0].key, 'c');
  })

  it('checks if search is working on copy data', async function test() {

    var input = {
      filters: {
        tags: ['e']
      }
    }

    var result = await facets.search_native(INDEX_PATH, input, {
      testing: true
    });
    assert.deepEqual(result.data.tags.a, [2]);
    assert.deepEqual(result.data.tags.e, [2]);
  })

  it('returns facets for empty input', async function test() {

    var input = {
      filters: {
      }
    }

    var result = await facets.search_native(INDEX_PATH, input, {
      testing: true
    });

    assert.deepEqual(result.data.tags.a, [1, 2, 3, 4]);
    assert.deepEqual(result.data.tags.e, [2]);

    var input = {
      filters: {
        tags: []
      }
    }

    var result = await facets.search_native(INDEX_PATH, input, {
      testing: true
    });

    assert.deepEqual(result.data.tags.a, [1, 2, 3, 4]);
    assert.deepEqual(result.data.tags.e, [2]);
  })

  it('returns facets for not existed filters (does not exist in index)', async function test() {

    var input = {
      filters: {
        tags: ['kkk']
      }
    }

    var result = await facets.search_native(INDEX_PATH, input, {
      testing: true
    });

    assert.deepEqual(result.data.tags.a, []);
    assert.deepEqual(result.data.tags.e, []);
  })

  it('returns facets for cross filters', async function test() {

    var input = {
      filters: {
        tags: ['a'],
        actors: ['john']
      }
    }

    var result = await facets.search_native(INDEX_PATH, input, {
      testing: true
    });

    assert.deepEqual(result.data.tags.a, [1, 2]);
    assert.deepEqual(result.data.tags.e, [2]);
    assert.deepEqual(result.data.actors.john, [1, 2]);
    assert.deepEqual(result.data.actors.jean, []);
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


  before(async function() {
    storage.dropDB(INDEX_PATH);
    facets = new Facets();
    await facets.index(INDEX_PATH, {
      json_object: items,
      append: false,
      configuration: configuration
    });
  });

  it('checks configuration', async function test() {
    assert.deepEqual(facets.configuration(INDEX_PATH), configuration);
  })

  it('returns facets', async function test() {

    var input = {
      filters: {
        tags: ['c']
      }
    }

    var result = await facets.search_native(INDEX_PATH, input, {
      testing: true
    });

    assert.deepEqual(result.data.tags.a, [1, 2, 3, 4]);
    assert.deepEqual(result.data.tags.c, [1, 3, 4]);
    assert.deepEqual(result.data.tags.e, [2]);
    assert.deepEqual(result.data.actors.john, [1]);
  })

  it('returns facets for two filters', async function test() {

    var input = {
      filters: {
        tags: ['z', 'f']
      }
    }

    var result = await facets.search_native(INDEX_PATH, input, {
      testing: true
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

  before(async function() {
    storage.dropDB(INDEX_PATH);
    facets = new Facets();
    await facets.index(INDEX_PATH, {
      json_object: items,
      append: false,
      configuration: configuration
    });
  });


  it('checks configuration', async function test() {
    assert.deepEqual(facets.configuration(INDEX_PATH), configuration);
  })

  it('returns facets', async function test() {

    var input = {
      filters: {
        tags: ['c']
      }
    }

    var result = await facets.search_native(INDEX_PATH, input, {
      testing: true
    });

    assert.deepEqual(result.data.tags.a, [1, 3, 4]);
    assert.deepEqual(result.data.tags.e, []);
    assert.deepEqual(result.data.actors.john, [1]);
    assert.deepEqual(result.data.category.comedy, [3]);
  })

  it('returns facets for cross filters', async function test() {

    var input = {
      filters: {
        tags: ['c'],
        category: ['drama'],
      }
    }

    var result = await facets.search_native(INDEX_PATH, input, {
      testing: true
    });

    assert.deepEqual(result.data.tags.a, [1, 4]);
    assert.deepEqual(result.data.tags.c, [1, 4]);
    assert.deepEqual(result.data.tags.e, []);
    assert.deepEqual(result.data.actors.john, [1]);
    assert.deepEqual(result.data.actors.alex, [1]);
    assert.deepEqual(result.data.category.comedy, [3]);
    assert.deepEqual(result.data.category.drama, [1, 4]);
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


  before(async function() {
    storage.dropDB(INDEX_PATH);
    facets = new Facets();
    await facets.index(INDEX_PATH, {
      json_object: items,
      append: false,
      configuration: configuration
    });
  });

  it('checks configuration', async function test() {
    assert.deepEqual(facets.configuration(INDEX_PATH), configuration);
  })

  it('returns facets for searched ids', async function test() {

    var input = {
      filters: {
        tags: ['c']
      }
    }

    var result = await facets.search_native(INDEX_PATH, input, {
      testing: true
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

    var result = await facets.search_native(INDEX_PATH, input, {
      query_ids: new RoaringBitmap32([1]),
      testing: true
    });

    assert.deepEqual(result.data.tags.a, [1]);
    assert.deepEqual(result.data.tags.e, []);
    assert.deepEqual(result.data.actors.john, [1]);
    assert.deepEqual(result.data.category.comedy, []);
  });

  it('returns facets for searched ids', async function test() {

    var input = {
      query: 'john'
    }

    //var result = itemsjs.search(input);
    //assert.deepEqual(result.data.aggregations.tags.buckets[0].key, 'a');
    //assert.deepEqual(result.data.aggregations.tags.buckets[0].doc_count, 2);
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

  before(async function() {
    storage.dropDB(INDEX_PATH);
    facets = new Facets();
    await facets.index(INDEX_PATH, {
      json_object: items,
      append: false,
      configuration: configuration
    });
  });

  it('excludes filter from search', async function test() {

    var input = {
      not_filters: {
        tags: ['c']
      }
    }

    var result = await facets.search_native(INDEX_PATH, input, {
      testing: true
    });

    assert.deepEqual(result.data.tags.a, [2]);
    assert.deepEqual(result.data.tags.c, []);
    assert.deepEqual(result.data.tags.e, [2]);
    assert.deepEqual(result.data.actors.john, [2]);

    assert.deepEqual(result.not_ids.toArray(), [1, 3, 4]);
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

  before(async function() {
    storage.dropDB(INDEX_PATH);
    facets = new Facets();
    await facets.index(INDEX_PATH, {
      json_object: items,
      append: false,
      configuration: configuration
    });
  });

  it('returns facets', async function test() {

    var input = {
      filters: {
        category: ['drama']
      }
    }

    var result = await facets.search_native(INDEX_PATH, input, {
      testing: true
    });
    assert.deepEqual(result.data.category.comedy, [2, 3]);
  })
})

describe('no configuration', function() {

  var configuration = {
    aggregations: {
    }
  }

  before(async function() {
    storage.dropDB(INDEX_PATH);
    facets = new Facets();
    await facets.index(INDEX_PATH, {
      json_object: items,
      append: false,
      configuration: configuration
    });
  });

  it('returns facets', async function test() {

    var input = {
      filters: {
      }
    }

    var result = await facets.search_native(INDEX_PATH, input, {
      testing: true
    });

    assert.deepEqual(result.data, {});
    assert.deepEqual(result.counters, {});
    assert.deepEqual(result.ids, null);
    assert.deepEqual(result.not_ids, null);
  })
})
