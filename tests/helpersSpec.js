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
})

