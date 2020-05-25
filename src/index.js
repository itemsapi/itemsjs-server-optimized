const lib = require('./lib');
const _ = require('lodash');
const helpers = require('./helpers2');
const Facets = require('./facets');
const storage = require('./storage');
const addon = require('bindings')('itemsjs_addon.node');

module.exports = function itemsjs() {

  //configuration = configuration || {};

  var facets = new Facets();

  return {

    /**
     */
    index: function(data) {
      facets.index(data);
    },

    /**
     * put settings
     */
    set_configuration: function(data) {
      facets.set_configuration(data);
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

      configuration = storage.getConfiguration();

      if (!configuration) {
        throw new Error('index first then search');
      }

      /**
       * merge configuration aggregation with user input
       */
      input.aggregations = helpers.mergeAggregations(configuration.aggregations, input);



      return lib.search(input, configuration, facets);
    },

    /**
     * @TODO
     */
    similar: function(id, options) {
    },

    /**
     * @TODO
     */
    aggregation: function aggregation(input) {

      configuration = storage.getConfiguration();

      if (!configuration) {
        throw new Error('index first then search');
      }
      return lib.aggregation(input, configuration, facets);
    },

    /**
     * @TODO
     */
    reindex: function() {
    }
  }
}
