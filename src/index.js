const service = require('./lib');
const _ = require('lodash');
const helpers = require('./helpers');
const Fulltext = require('./fulltext');
const Facets = require('./facets');
const addon = require('bindings')('itemsjs_addon.node');

module.exports = function itemsjs(configuration) {

  configuration = configuration || {};

  var facets = new Facets(configuration.aggregations);

  return {

    /**
     * items as json_object
     * json_string
     * json_path
     */
    index: function(items) {

      facets.index(items, configuration.aggregations);
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

      return service.search(input, configuration, facets);
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
