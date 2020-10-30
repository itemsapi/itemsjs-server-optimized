'use strict';

const assert = require('assert');
const storage = require('./../src/storage');
const INDEX_PATH = './db.mdb';

describe('storage', function() {

  before(function() {
    storage.deleteConfiguration(INDEX_PATH);
  });

  it('cannot find configuration', function test(done) {

    assert.deepEqual(storage.getConfiguration(INDEX_PATH), null);
    done();
  })

  it('saves and get configuration', function test(done) {

    var configuration = {
      aggregations: {
        tags: {
          title: 'Tags',
          conjunction: true
        },
        actors: {
          title: 'Actors',
          conjunction: true
        },
        category: {
          title: 'Category',
          conjunction: true
        }
      }
    }


    storage.setConfiguration(INDEX_PATH, configuration);
    assert.deepEqual(configuration, storage.getConfiguration(INDEX_PATH));

    done();
  })

  it('saves different config and get configuration', function test(done) {

    var configuration = {
      aggregations: {
        tags: {
          title: 'Tags',
          conjunction: false
        },
        actors: {
          title: 'Actors',
          conjunction: false
        },
        category: {
          title: 'Category',
          conjunction: false
        }
      }
    }


    storage.setConfiguration(INDEX_PATH, configuration);
    assert.deepEqual(configuration, storage.getConfiguration(INDEX_PATH));

    done();
  })

  it('saves and get configuration', function test(done) {

    var configuration = {
      aggregations: {
        tags: {
          title: 'Tags',
          conjunction: true
        },
        actors: {
          title: 'Actors',
          conjunction: true
        },
        category: {
          title: 'Category',
          conjunction: true
        }
      }
    }

    storage.setConfiguration(INDEX_PATH, configuration);
    assert.deepEqual(configuration, storage.getConfiguration(INDEX_PATH));

    done();
  })
})
