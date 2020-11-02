'use strict';

const assert = require('assert');
const Facets = require('./../src/facets');
const storage = require('./../src/storage');
const lib = require('./../src/lib');
const items = require('./fixtures/items.json');
var itemsjs = require('./../src/index')();
const INDEX_PATH = './data/db.mdb';
//const INDEX_PATH_2 = './data/test.mdb';
const INDEX_NAME = 'db';

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
    storage.deleteConfiguration(INDEX_PATH);
    done();
  });

  beforeEach(function(done) {
    storage.dropDB(INDEX_PATH);
    done();
  });

  it('index is empty so cannot search', async function test() {

    try {

      var result = await itemsjs.search(INDEX_NAME);
    } catch (err) {
      assert.equal(err.message, 'index first then search');
    }
  })

  /*it('cannot search with invalid index name', function test(done) {

    try {

      var result = itemsjs.search('A A A');
    } catch (err) {
      assert.equal(err.message, 'invalid index name');
    }

    done();
  })*/

  it('searches with two filters', async function test() {

    await itemsjs.index(INDEX_NAME, {
      json_object: items,
      append: false,
      configuration: configuration
    });

    var result = await itemsjs.search(INDEX_NAME, {
      filters: {
        tags: ['a'],
        category: ['drama']
      }
    });

    assert.equal(result.data.items.length, 2);
    assert.equal(result.data.aggregations.tags.buckets[0].doc_count, 2);

  })

  it('async search with two filters', async function test() {

    await itemsjs.index(INDEX_NAME, {
      json_object: items,
      append: false,
      configuration: configuration
    });

    var result = await itemsjs.search(INDEX_NAME, {
      filters: {
        tags: ['a'],
        category: ['drama']
      }
    }, {
      is_async: true
    });

    assert.equal(result.data.items.length, 2);
    assert.equal(result.data.aggregations.tags.buckets[0].doc_count, 2);
    //process.exit();
  })


  it('searches with filter and query', async function test() {


    await itemsjs.index(INDEX_NAME, {
      json_object: items,
      append: false,
      configuration: configuration
    });

    var result = await itemsjs.search(INDEX_NAME, {
      filters: {
        tags: ['a'],
      },
      query: 'comedy'
    });

    assert.equal(result.data.items.length, 2);
    assert.equal(result.data.aggregations.tags.buckets[0].doc_count, 2);
    assert.equal(result.data.aggregations.category.buckets[0].key, 'comedy');
    assert.equal(result.data.aggregations.category.buckets[0].doc_count, 2);
  })


  it('makes search with empty filters', async function test() {

    await itemsjs.index(INDEX_NAME, {
      json_object: items,
      configuration: configuration,
      append: false
    });

    var result = await itemsjs.search(INDEX_NAME, {
      filters: {
      }
    });

    assert.equal(result.data.items.length, 4);
  })

  it('makes search with not filters', async function test() {

    await itemsjs.index(INDEX_NAME, {
      json_object: items,
      configuration: configuration,
      append: false
    });

    var result = await itemsjs.search(INDEX_NAME, {
      not_filters: {
        tags: ['c']
      }
    });

    assert.equal(result.data.items.length, 1);
  })

  it('makes search with many not filters', async function test() {

    await itemsjs.index(INDEX_NAME, {
      json_object: items,
      configuration: configuration,
      append: false
    });

    var result = await itemsjs.search(INDEX_NAME, {
      not_filters: {
        tags: ['c', 'e']
      }
    });

    assert.equal(result.data.items.length, 0);
  })
})


describe('no configuration', function() {

  var configuration = {
    aggregations: {
    }
  }

  before(async function() {
    storage.deleteConfiguration(INDEX_PATH);
    storage.dropDB(INDEX_PATH);
    await itemsjs.index(INDEX_NAME, {
      json_object: items,
      append: false,
      configuration: configuration
    });
  });

  it('searches with two filters', async function test() {

    var result = await itemsjs.search(INDEX_NAME);

    assert.equal(result.data.items.length, 4);
  })
})

describe('crud', function() {

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
    storage.deleteConfiguration(INDEX_PATH);
    storage.dropDB(INDEX_PATH);
    await itemsjs.index(INDEX_NAME, {
      json_object: items,
      append: false,
      configuration: configuration
    });
  });

  it('searches', async function test() {

    var result = await itemsjs.search(INDEX_NAME);
    assert.equal(result.data.items.length, 4);
  })

  it('get first item', async function test() {

    var result = itemsjs.get_item(INDEX_NAME, 1);
    assert.equal(result.id, 1);
    assert.equal(result.name, 'movie1');
  })

  it('delete last item', async function test() {

    var result = itemsjs.delete_item(INDEX_NAME, 4);

    var result = await itemsjs.search(INDEX_NAME);
    assert.equal(result.data.items.length, 3);
  })

  it('partial update first item', async function test() {

    var result = itemsjs.partial_update_item(INDEX_NAME, 1, {
      name: 'movie100'
    });

    var result = itemsjs.get_item(INDEX_NAME, 1);
    assert.equal(result.id, 1);
    assert.equal(result.name, 'movie100');
  })

  it('update first item', async function test() {

    var result = itemsjs.partial_update_item(INDEX_NAME, 1, {
      name: 'movie1000'
    });

    var result = itemsjs.get_item(INDEX_NAME, 1);
    assert.equal(result.id, 1);
    assert.equal(result.name, 'movie1000');
  })

  it('gets configuration', async function test() {

    var result = itemsjs.get_configuration(INDEX_NAME);
    assert.deepEqual(result, configuration);
  })

  it('makes aggregation', async function test() {

    var result = await itemsjs.aggregation(INDEX_NAME, {
      name: 'tags'
    });

    assert.deepEqual(result.data.buckets[0].key, 'a');
  })

  it('list all indexes', async function test() {

    var result = await itemsjs.list_indexes();
    console.log(result);

    //assert.deepEqual(result.data.buckets[0].key, 'a');
  })

  it('reset index', async function test() {

    var result = itemsjs.reset(INDEX_NAME);

    try {
      var result = await itemsjs.search(INDEX_NAME);
    } catch (err) {
      assert.equal(err.message, 'index first then search');
    }
  })
})

describe('multi tenancy', function() {

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
    storage.dropDB('./data/test1.mdb');
    storage.dropDB('./data/test2.mdb');

    await itemsjs.index('test1', {
      json_object: items,
      append: false,
      configuration: configuration
    });

    await itemsjs.index('test2', {
      json_object: items,
      append: false,
      configuration: configuration
    });
  });

  it('searches', async function test() {

    var result = await itemsjs.search('test1');
    assert.equal(result.data.items.length, 4);
    var result = await itemsjs.search('test2');
    assert.equal(result.data.items.length, 4);

    var result = itemsjs.delete_item('test1', 4);

    var result = await itemsjs.search('test1');
    assert.equal(result.data.items.length, 3);
    var result = await itemsjs.search('test2');
    assert.equal(result.data.items.length, 4);
  })

})
