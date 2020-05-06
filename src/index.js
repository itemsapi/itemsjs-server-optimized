const service = require('./lib');
const _ = require('lodash');
const helpers = require('./helpers');
const Fulltext = require('./fulltext');
const Facets = require('./facets');
const addon = require('bindings')('itemsjs_addon.node');

module.exports = function itemsjs(items, configuration) {

  configuration = configuration || {};


  // upsert id to items
  // throw error in tests if id does not exists

  // responsible for full text search over the items
  // it makes inverted index and it is very fast
  var fulltext = new Fulltext(items, configuration);

  // index facets
  var facets = new Facets(items, configuration.aggregations);

  return {

    /**
     * items as json_object
     * json_string
     * json_path
     */
    index: function(items) {
      input = input || {};

      addon.index({
        json_object: items
        //json_path: "/home/mateusz/node/items-benchmark/datasets/shoprank_full.json"
      })
    },



    /**
     * per_page
     * page
     * query
     * sort
     * filters
     */
    search: function(input) {
      input = input || {};

      /**
       * merge configuration aggregation with user input
       */
      input.aggregations = helpers.mergeAggregations(configuration.aggregations, input);

      return service.search(items, input, configuration, fulltext, facets);
    },

    /**
     * @TODO
     */
    similar: function(id, options) {
    },

    /**
     * @TODO
     */
    aggregation: function(input) {
    },

    /**
     * @TODO
     */
    reindex: function() {
    }
  }
}
