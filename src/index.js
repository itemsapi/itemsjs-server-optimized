const lib = require('./lib');
const _ = require('lodash');
const helpers = require('./helpers');
const Fulltext = require('./fulltext');
const Facets = require('./facets');
const storage = require('./storage');
const addon = require('bindings')('itemsjs_addon.node');

module.exports = function itemsjs() {

  //configuration = configuration || {};

  var facets = new Facets();

  return {

    /**
     * items as json_object
     * json_string
     * json_path
     */
    index: function(items, configuration) {
      facets.index(items, configuration);
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
    aggregation: function(input) {
    },

    /**
     * @TODO
     */
    reindex: function() {
    }
  }
}
