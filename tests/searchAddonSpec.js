'use strict';

const assert = require('assert');
const service = require('./../src/lib');
const Facets = require('./../src/facets');
const helpers2 = require('./../src/helpers2');
const storage = require('./../src/storage');
const RoaringBitmap32 = require('roaring/RoaringBitmap32');
const items = require('./fixtures/items.json');
const INDEX_PATH = './db.mdb';
const addon = require('./../src/addon');
const _ = require('lodash');

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

  var facets_fields = Object.keys(configuration.aggregations);

  var input = {
    filters: {
      //tags: ['c']
    }
  }

  var filters_array = _.map(input.filters, function(filter, key) {
    return {
      key: key,
      values: filter,
      conjunction: configuration.aggregations[key].conjunction !== false
    }
  })

  filters_array.sort(function(a, b) {
    return a.conjunction > b.conjunction ? 1 : -1;
  })

  before(async function() {
    storage.dropDB(INDEX_PATH);

    var index = storage.index({
      json_object: items,
      index_path: './data/test.mdb',
      faceted_fields: ['actors', 'genres', 'year', 'tags'],
      append: false
    });
  });

  it('returns facets for two fields (tags, actors)', async function test() {


    var result1 = addon.search_facets({
      input: input,
      filters_array: filters_array,
      aggregations: configuration.aggregations,
      facets_fields, facets_fields,
      query_ids: null,
      index_path: './data/test.mdb'
    });

    var result2 = await addon.search_facets_async({
      input: input,
      filters_array: filters_array,
      aggregations: configuration.aggregations,
      facets_fields, facets_fields,
      query_ids: null,
      index_path: './data/test.mdb'
    });

    assert.deepEqual(result1.raw, result2.raw);
  })
})
