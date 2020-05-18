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

    return _.chain(query).split(' ')
    .filter(v => {
      return v.trim();
    })
    .map(v => {
      return v.toLowerCase();
    })
    .value();
  },

  /*
   * makes full text search
   */
  fulltext: function(input) {

    var query = input.query || '';

    var tokens = this.query_parser(query);

    // union
    var bitmap = new RoaringBitmap32([]);
    tokens.forEach(token => {
      var index = storage.getSearchTermIndex(token);
      if (index) {
        bitmap = RoaringBitmap32.or(index, bitmap);
      }
    })

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

    return bitmap;
  },

  /*
   *
   * ids is optional only when there is query
   */
  search: function(input, data) {

    var configuration = this.configuration();
    var config = configuration.aggregations;

    if (!config) {
      throw new Error('Not found configuration for faceted search');
    }

    data = data || {};

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

      var array = key.split(/\.(.+)/);
      var key1 = array[0];
      var key2 = array[1];

      if (!temp_facet['bits_data_temp'][key1]) {
        temp_facet['bits_data_temp'][key1] = {};
      }

      if (!temp_facet['data'][key1]) {
        temp_facet['data'][key1] = {};
      }

      temp_facet['bits_data_temp'][key1][key2] = bitmap;
    })
    console.log(`load indexes from db + parsing: ${new Date().getTime() - time}`);
    console.log(`calculation done for: ${Object.keys(indexes).length} filters`);



    var time = new Date().getTime();
    var union = helpers2.disjunction_union(temp_facet['bits_data_temp'], input, config);
    time = new Date().getTime() - time;
    console.log('disjunction: ' + time);



    // -------------------------------
    var time = new Date().getTime();
    var combination = helpers2.combination(temp_facet['bits_data_temp'], input, config);
    time = new Date().getTime() - time;
    console.log('combination: ' + time);
    // -------------------------------



    // -------------------------------
    var time = new Date().getTime();
    var filters_indexes = {};

    // input_key tags, couriers
    // input_values real filters
    _.mapValues(input.filters, function(filters, field) {

      _.mapValues(filters, filter => {
      //filters.forEach(filter => {
      // filter - John, Arnold, Jean etc.



        // [1, 2, 3, 5, etc]
        var filter_indexes = temp_facet['bits_data_temp'][field][filter];

        // its 80ms slower
        //temp_facet['data'][field][filter] = helpers2.intersection(filter_indexes, query_ids);

        //console.log(filter_indexes)

        // if the filter does not exist then intersection is []
        if (!filter_indexes) {
          return [];
        }

        if (!temp_facet['bits_data_temp'][field]) {
          return;
        }

        _.mapValues(temp_facet['bits_data_temp'], function(values, key) {
          // values indexes of specific facet
          // key couriers, psp, actors, tags

          //temp_facet['bits_data'][key] = _.mapValues(temp_facet['bits_data'][key], function(facet_indexes, key2) {
          _.mapValues(temp_facet['bits_data_temp'][key], function(facet_indexes, key2) {

            var result;

            var cond = 0;
            if (config[key].conjunction === false && field === key) {
              result = facet_indexes;
              cond = 1;
            } else if (config[field].conjunction === false && field !== key) {
              result = RoaringBitmap32.and(facet_indexes, union[field]);
              cond = 2;
            } else if (config[key].conjunction === false && field !== key) {
              // it's new and it's gonna work
              result = RoaringBitmap32.and(facet_indexes, combination[field]);
              //result = facet_indexes.andInPlace(combination[field]);
              cond = 3;
            } else {
              result = RoaringBitmap32.and(filter_indexes, facet_indexes);
              //result = facet_indexes.andInPlace(filter_indexes);
              cond = 4;
            }

            temp_facet['bits_data_temp'][key][key2] = result;
          })
        })
      })
    })

    time = new Date().getTime() - time;
    console.log('crossing matrix: ' + time);


    // -------------------------------
    var time = new Date().getTime();
    _.mapValues(temp_facet['bits_data_temp'], function(values, key) {
      _.mapValues(temp_facet['bits_data_temp'][key], function(facet_indexes, key2) {

        if (data.query_ids) {
          temp_facet['bits_data_temp'][key][key2] = RoaringBitmap32.and(temp_facet['bits_data_temp'][key][key2], data.query_ids);
        }

        if (data.test) {
          temp_facet['data'][key][key2] = temp_facet['bits_data_temp'][key][key2].toArray();
        }
      })
    })
    time = new Date().getTime() - time;
    console.log('copying data  from bits_data_temp to data object: ' + time);
    // -------------------------------



    // -------------------------------
    /*var time = new Date().getTime();
    _.mapValues(temp_facet['bits_data_temp'], function(values, key) {
      _.mapValues(temp_facet['bits_data_temp'][key], function(facet_indexes, key2) {
        temp_facet['bits_data_temp'][key][key2].size;
      })
    })
    time = new Date().getTime() - time;
    console.log('calculating length from bits_data_temp: ' + time);*/
    // -------------------------------

    return temp_facet;
  }
}

module.exports = Facets;
