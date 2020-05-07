'use strict';

const assert = require('assert');
const storage = require('./../src/storage');

describe('storage', function() {

  before(function() {
    storage.deleteConfiguration();
  });

  it('cannot find configuration', function test(done) {

    assert.deepEqual(storage.getConfiguration(), null);
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


    storage.setConfiguration(configuration);
    assert.deepEqual(configuration, storage.getConfiguration());

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


    storage.setConfiguration(configuration);
    assert.deepEqual(configuration, storage.getConfiguration());

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

    storage.setConfiguration(configuration);
    assert.deepEqual(configuration, storage.getConfiguration());

    done();
  })
})
