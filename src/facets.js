const _ = require('lodash');
const helpers2 = require('./helpers2');
const algo = require('./algo');
const RoaringBitmap32 = require('roaring/RoaringBitmap32');

/**
 * responsible for making faceted search
 */
var Facets = function(items, config) {

  config = config || {};
  //config.searchableFields = config.searchableFields || [];
  this.items = items;
  this.config = config;

  this.facets = helpers2.index(items, config);
  //console.log(facets);
  //console.log(facets);

};

Facets.prototype = {

  items: function() {
    return this.items;
  },

  index: function() {
    return this.facets;
  },

  reindex: function() {
    this.facets = helpers2.index(this.items, this.config);

    return this.facets;
  },

  /*
   *
   * ids is optional only when there is query
   */
  search: function(input, data) {

    //console.log('search helper');
    //console.log(this.config);
    //console.log(input);
    //console.log(this.facets['data']);

    var config = this.config;
    //var fields = _.keys(input);
    // clone facets
    //var temp_facet = _.clone(this.facets);

    data = data || {};
    //query_ids
    // clone does not make sensee here
    var temp_facet = _.clone(this.facets);
    //var temp_facet = this.facets;


    // if elements to sort - sorted_ids is smaller number then items.length
    // then make this operation here


    // working copy
    _.mapValues(temp_facet['bits_data'], function(values, key) {
      _.mapValues(temp_facet['bits_data'][key], function(facet_indexes, key2) {
        temp_facet['bits_data_temp'][key][key2] = temp_facet['bits_data'][key][key2];
      })
    })

    //console.log(temp_facet['bits_data_temp']);

    // disjunction


    // this can be faster




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
              //result = RoaringBitmap32.and(filter_indexes, facet_indexes);
            } else if (config[field].conjunction === false && field !== key) {
              //result = RoaringBitmap32.and(facet_indexes, union[field]);
              result = RoaringBitmap32.and(facet_indexes, union[field]);
              //result = RoaringBitmap32.or(facet_indexes, filter_indexes);
              cond = 2;
            //} else if (config[key].conjunction === false && field !== key && combination[field]) {
            } else if (config[key].conjunction === false && field !== key) {

              // it's new and it's gonna work
              result = RoaringBitmap32.and(facet_indexes, combination[field]);
              //result = RoaringBitmap32.and(facet_indexes, filter_indexes);
              cond = 3;
            } else {
              result = RoaringBitmap32.and(filter_indexes, facet_indexes);
              cond = 4;
            }

            //if (filter === 'France' && key === 'country') {
            //if (key2 === 'Norway' || key2 === 'Nginx') {
            if (0 &&
              ['Norway', 'France', 'Nginx'].indexOf(key2) !== -1 &&
              ['Norway', 'France', 'Nginx'].indexOf(filter) !== -1
            ) {
              console.log(key2, filter, cond);
              console.log(facet_indexes.toArray());
              console.log(filter_indexes.toArray());
              console.log(result.toArray());
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
