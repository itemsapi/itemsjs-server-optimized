'use strict';

const assert = require('assert');
const helper = require('./../src/helpers2');

describe('helpers', function() {

  it('split filter key', function test(done) {

    var result = helper.parse_filter_key('actors.Al Pacino');
    assert.deepEqual(result, ['actors', 'Al Pacino']);

    var result = helper.parse_filter_key('tech.Google.Analytics');
    assert.deepEqual(result, ['tech', 'Google.Analytics']);

    var result = helper.parse_filter_key('tech..Google.Analytics');
    assert.deepEqual(result, ['tech', '.Google.Analytics']);

    //var result = helper.parse_filter_key('tech.');
    //assert.deepEqual(result, ['tech']);

    done();
  })

  it('makes wildcard string test', function test(done) {

    assert.deepEqual(helper.wildcard_search('action', 'act*'), 1);
    assert.deepEqual(helper.wildcard_search('action', 'acto*'), 0);
    assert.deepEqual(helper.wildcard_search('action', '*cti*'), 1);
    assert.deepEqual(helper.wildcard_search('action', 'action'), 1);
    assert.deepEqual(helper.wildcard_search('action', 'actio'), 0);
    assert.deepEqual(helper.wildcard_search('action', 'ACTION'), 0);

    done();
  })
})

