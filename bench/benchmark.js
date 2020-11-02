'use strict';

const assert = require('assert');
const storage = require('./../src/storage');
const addon = require('./../src/addon');
const Facets = require('./../src/facets');
//const data = require('./fixtures/items.json');
const _ = require('lodash');
const Promise = require('bluebird');

var facets = new Facets();


var config = {
  aggregations: {
    year: {
      size: 10,
      conjunction: true
    },
    genres: {
      size: 10,
      conjunction: false
    },
    tags: {
      size: 10,
      conjunction: true
    },
    country: {
      size: 10,
      conjunction: true
    }
  }
}

var input = {
  filters: {
    tags: ['prison']
    //genres: ['Action']
  }
}

var filters_array = _.map(input.filters, function(filter, key) {
  return {
    key: key,
    values: filter,
    conjunction: config.aggregations[key].conjunction !== false
  }
})

filters_array.sort(function(a, b) {
  return a.conjunction > b.conjunction ? 1 : -1;
})

var facets_fields = Object.keys(config.aggregations);

(async function() {

  for (var i = 0 ; i < 10 ; ++i) {

    var index = storage.index({
      json_path: './imdb.json',
      index_path: './data/db_' + i + '.mdb',
      faceted_fields: ['actors', 'genres', 'year', 'tags'],
      append: false
    });
  }

  var time = new Date().getTime();

  // 1000 req in 700 ms
  // 1428 req / s
  await Promise.all(_.range(0, 1000, 1))
  .map(async i => {

    var number = i % 10;
    await addon.search_facets_async({
      input: input,
      filters_array: filters_array,
      aggregations: config.aggregations,
      facets_fields, facets_fields,
      query_ids: null,
      index_path: './data/db_' + number + '.mdb'
    })
    .then(res => {
      //console.log('res')
      //console.log(res)
    })
    .catch(res => {
      //console.log('catch')
      //console.log(res)
    });


  }, {
    concurrency: 10
  })

  console.log(`bench: ${new Date().getTime() - time}`);

  var time = new Date().getTime();
  var number = i % 10;

  addon.search_facets({
    input: input,
    filters_array: filters_array,
    aggregations: config.aggregations,
    facets_fields, facets_fields,
    query_ids: null,
    index_path: './data/db_' + number + '.mdb'
  })

  console.log(`bench: ${new Date().getTime() - time}`);

})();
