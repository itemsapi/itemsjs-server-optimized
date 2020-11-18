/*
 * Author: Mateusz Rzepa
 * Copyright: 2015-2020, ItemsAPI
 */

// @TODO change file name from facets to index
const _ = require('lodash');
const helpers2 = require('./helpers2');
const storage = require('./storage');
const algo = require('./algo');
const fs = require('fs');
const RoaringBitmap32 = require('roaring/RoaringBitmap32');
const addon = require('./addon');

/**
 * responsible for making faceted search
 */
var Facets = function() {
  this.config = {};
  this.indexes_cache;
};

Facets.prototype = {

  items: function() {
    return this.items;
  },

  /**
   * had a problem with c++ filesystem so nodejs is responsible for it so far
   */
  delete_index: function() {
    //return fs.emptyDirSync('./example.mdb');
  },

  partial_update_item: function(index_path, id, item) {

    var configuration = this.configuration(index_path);
    var data = {
      faceted_fields: []
    };

    if (configuration.aggregations) {
      data.faceted_fields = _.keys(configuration.aggregations);
    }

    data.sorting_fields = configuration.sorting_fields ? configuration.sorting_fields : [];

    storage.partialUpdateItem(index_path, id, item, data);
  },


  update_item: function(index_path, item) {

    var configuration = this.configuration(index_path);
    var data = {
      faceted_fields: []
    };

    if (configuration.aggregations) {
      data.faceted_fields = _.keys(configuration.aggregations);
    }

    data.sorting_fields = configuration.sorting_fields ? configuration.sorting_fields : [];

    storage.updateItem(index_path, item, data);
  },

  load_sort_index: function(index_path) {

    var configuration = this.configuration(index_path);
    if (configuration.sorting_fields && Array.isArray(configuration.sorting_fields)) {
      addon.load_sort_index(index_path, configuration.sorting_fields);
    }
  },

  index: async function(index_path, data) {

    /*if (!data.index_path) {
      throw new Error('Index Path needed');
    }*/

    var configuration = data.configuration;

    //var time = new Date().getTime();
    if (configuration) {
      storage.setConfiguration(index_path, configuration);
    } else {
      configuration = this.configuration(index_path);
      if (!configuration) {
        throw new Error('Configuration needed first for indexing');
      }
    }

    if (configuration.aggregations) {
      data.faceted_fields = _.keys(configuration.aggregations);
    }

    if (configuration.sorting_fields && Array.isArray(configuration.sorting_fields)) {
      data.sorting_fields  = configuration.sorting_fields;
    }

    data.index_path = index_path;

    if (configuration.async_indexing === true) {
      console.log(`async indexing`);
      await addon.indexAsync(data);
    } else {
      addon.index(data);
    }

    //var time = new Date().getTime();
    //addon.index(data);
    //console.log(`index data time: ${new Date().getTime() - time}`);
  },

  get_index: function() {
    return this.facets;
  },

  set_configuration: function(index_path, configuration) {

    storage.setConfiguration(index_path, configuration);
  },

  list_indexes: async function() {

    var output = [];

    fs.readdirSync('./data').forEach(file => {

      if (file.match(/\.mdb$/)) {
        output.push(file.slice(0, -4));
      }
    });

    return {
      data: output
    }
  },


  configuration: function(index_path) {
    return storage.getConfiguration(index_path);
  },


  /*
   * split query for normalized tokens
   */
  query_parser: function(query) {

    return query.split(' ')
    .filter(v => !!v)
    .map(v => {
      return v.trim().toLowerCase();
    })
  },

  /*
   * split query for normalized tokens
   */
  query_parser2: function(query) {

    return addon.tokenize(query);
  },

  /*
   */
  pagination_sort_ids: function(index_path, ids, sort_field, order, per_page, page) {

    if (!sort_field) {
      if (order === 'desc') {
        return Array.from(ids.rangeUint32Array(Math.max(0, ids.size - page * per_page), per_page)).reverse();
      } else {
        return Array.from(ids.rangeUint32Array((page - 1) * per_page, per_page));
      }

    } else {
      // supports multi threading
      return Array.from(addon.sort_index_2(index_path, ids.serialize(true), sort_field, order, (page - 1) * per_page, per_page));

      // does not support multi threading
      //return Array.from(addon.sort_index(index_path, ids.serialize(true), sort_field, order, (page - 1) * per_page, per_page));
    }
  },

  /*
   * makes proximity search using input bigrams
   */
  proximity_search: function(index_path, input, query_ids) {
    var query = input.query || '';

    var tokens = this.query_parser2(query);

    var bigrams = helpers2.bigrams(tokens);

    var bitmap = null;

    bigrams.forEach(tokens => {
      var index = storage.getSearchTermIndex(index_path, tokens[0] + '_' + tokens[1]);
      if (index) {
        if (!bitmap) {
          bitmap = index;
        } else {
          bitmap = RoaringBitmap32.and(index, bitmap);
        }
      }
    })

    if (bitmap === null) {
      return new RoaringBitmap32([]);
    }

    if (query_ids) {
      bitmap = RoaringBitmap32.and(bitmap, query_ids);
    }

    return bitmap;
  },

  /*
   * makes full text search
   */
  fulltext: function(index_path, input) {

    var query = input.query || '';

    var tokens = this.query_parser2(query);

    // and
    var bitmap = null;
    tokens.forEach(token => {
      var index = storage.getSearchTermIndex(index_path, token);
      if (index) {
        if (!bitmap) {
          bitmap = index;
        } else {
          bitmap = RoaringBitmap32.and(index, bitmap);
        }
      }
    })

    if (bitmap === null) {
      return new RoaringBitmap32([])
    }

    return bitmap;
  },

  load_indexes: function() {

    /**
     * get facets from file memory db
     */
    var temp_facet = {
      bits_data_temp: {},
      data: {}
    };

    var time = new Date().getTime();
    var indexes = storage.getFilterIndexes();

    if (!indexes) {
      throw new Error('Not found any indexes');
    }

    console.log(`load indexes: ${new Date().getTime() - time}`);

    _.mapValues(indexes, function(bitmap, key) {

      var [key1, key2] = helpers2.parse_filter_key(key);

      if (key1 && key2) {

        if (!temp_facet['bits_data_temp'][key1]) {
          temp_facet['bits_data_temp'][key1] = {};
          temp_facet['data'][key1] = {};
        }

        temp_facet['bits_data_temp'][key1][key2] = bitmap;
      }
    })
    console.log(`load indexes from db + parsing: ${new Date().getTime() - time}`);
    console.log(`calculation will be done for: ${Object.keys(indexes).length} indexes`);

    return temp_facet;
  },

  search_native: async function(index_path, input, data) {

    data = data || {};

    // this makes segmentation fault in async environment
    var configuration = this.configuration(index_path);
    var aggregations = configuration.aggregations;

    if (!aggregations) {
      throw new Error('Not found configuration for faceted search');
    }

    /*
     * this is really slow in stress test
     */
    var filters_array = _.map(input.filters, function(filter, key) {
      return {
        key: key,
        values: filter,
        conjunction: aggregations[key].conjunction !== false,
      }
    })

    filters_array.sort(function(a, b) {
      return a.conjunction > b.conjunction ? 1 : -1;
    })

    var query_ids = data.query_ids ? data.query_ids.serialize(true) : null;

    var facets_fields = _.keys(aggregations);

    if (input.facets_fields) {
      facets_fields = _.intersection(facets_fields, input.facets_fields);
    }

    var time = new Date().getTime();

    var query = {
      input: input,
      filters_array: filters_array,
      aggregations: aggregations,
      facets_fields, facets_fields,
      query_ids: query_ids,
      index_path: index_path,
      testing: data.testing
    }

    var result;

    //console.log(data);

    if (data.is_async === true) {
      console.log(`async searching`);
      result = await addon.search_facets_async(query);
    } else {
      result = addon.search_facets(query);
    }

    console.log(`native search time: ${new Date().getTime() - time}`);

    var ids = result.ids ? RoaringBitmap32.deserialize(result.ids, true) : null;
    var not_ids = result.not_ids ? RoaringBitmap32.deserialize(result.not_ids, true) : null;

    var json = JSON.parse(result.raw);

    return {
      data: json.data || {},
      counters: json.counters || {},
      ids: ids,
      not_ids: not_ids
    }
  },
}

module.exports = Facets;
