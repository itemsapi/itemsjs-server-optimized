const _ = require('lodash');
const helpers2 = require('./helpers2');
const storage = require('./storage');
const algo = require('./algo');
//const fs = require('fs-extra');
const RoaringBitmap32 = require('roaring/RoaringBitmap32');
const addon = require('bindings')('itemsjs_addon.node');


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

  index: function(data) {

    //data.configuration.aggregations = data.configuration.aggregations || {};

    var configuration = data.configuration;

    if (configuration) {
      storage.setConfiguration(configuration);
    } else {
      configuration = this.configuration();
      if (!configuration) {
        throw new Error('Configuration needed first for indexing');
      }
    }

    if (configuration.aggregations) {
      data.faceted_fields = _.keys(configuration.aggregations);
    }

    addon.index(data);
  },

  get_index: function() {
    return this.facets;
  },

  set_configuration: function(configuration) {
    storage.setConfiguration(configuration);
  },

  configuration: function() {
    return storage.getConfiguration();
  },

  /*
   * split query for normalized tokens
   */
  query_parser: function(query) {

    return query.split(' ')
    .map(v => {
      return v.trim().toLowerCase();
    })
  },

  /*
   * makes full text search
   */
  fulltext: function(input) {

    var query = input.query || '';

    var tokens = this.query_parser(query);

    // and
    var bitmap = null;
    tokens.forEach(token => {
      var index = storage.getSearchTermIndex(token);
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


  /*
   *
   * ids is optional only when there is query
   * @TODO:
   * add disjunction_fields, conjunction_fields for custom behaviour
   * add facets_list which only makes computation for specific facets (not all like now)
   */
  search: function(input, data) {

    var configuration = this.configuration();
    var config = configuration.aggregations;

    if (!config) {
      throw new Error('Not found configuration for faceted search');
    }

    data = data || {};
    input = input || {};

    var temp_facet = this.load_indexes();

    var time = new Date().getTime();
    var combination = helpers2.combination(temp_facet['bits_data_temp'], input, config);
    time = new Date().getTime() - time;
    console.log('combination: ' + time);

    // -------------------------------
    // cross combination with query ids
    var time = new Date().getTime();
    if (data.query_ids) {

      _.mapValues(temp_facet['bits_data_temp'], function(values, key) {
        if (!combination[key]) {
          combination[key] = data.query_ids;
        } else {
          combination[key] = RoaringBitmap32.and(combination[key], data.query_ids);
        }
      })
    }
    time = new Date().getTime() - time;
    console.log('cross query ids with combination: ' + time);
    // -------------------------------

    /**
     * calculating not ids
     */
    temp_facet.not_ids = helpers2.facets_ids(temp_facet['bits_data_temp'], input.not_filters, config);

    /**
     * not filters calculations
     *
     */

    var time = new Date().getTime();
    var i = 0;

    // @TODO it can be improved with crossing only combinations
    // not crossing all filters is required
    _.mapValues(temp_facet['bits_data_temp'], function(values, key) {
      _.mapValues(temp_facet['bits_data_temp'][key], function(facet_indexes, key2) {

        if (temp_facet.not_ids) {
          var result = RoaringBitmap32.andNot(facet_indexes, temp_facet.not_ids);
          temp_facet['bits_data_temp'][key][key2] = result;
          ++i;
        }
      })
    })

    time = new Date().getTime() - time;
    console.log('not filters crossing matrix: ' + time);
    console.log(`not filters calculated: ${i} times`);

    /**
     * end of not filters calculations
     */

    // -------------------------------
    var time = new Date().getTime();
    var i = 0 ;

    _.mapValues(temp_facet['bits_data_temp'], function(values, key) {
      _.mapValues(temp_facet['bits_data_temp'][key], function(facet_indexes, key2) {

        if (combination[key]) {
          temp_facet['bits_data_temp'][key][key2] = RoaringBitmap32.and(facet_indexes, combination[key]);
          ++i;
        }
      })
    })

    time = new Date().getTime() - time;
    console.log('crossing matrix: ' + time);
    console.log(`filters calculated: ${i} times`);


    // -------------------------------
    var time = new Date().getTime();
    _.mapValues(temp_facet['bits_data_temp'], function(values, key) {
      _.mapValues(temp_facet['bits_data_temp'][key], function(facet_indexes, key2) {

        if (data.test) {
          temp_facet['data'][key][key2] = temp_facet['bits_data_temp'][key][key2].toArray();
        }
      })
    })

    time = new Date().getTime() - time;
    console.log('copying data  from bits_data_temp to data object: ' + time);
    // -------------------------------

    /**
     * calculating ids
     */
    temp_facet.ids = helpers2.facets_ids(temp_facet['bits_data_temp'], input.filters, config);

    return temp_facet;
  }
}

module.exports = Facets;
