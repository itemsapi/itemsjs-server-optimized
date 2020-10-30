/*
 * Author: Mateusz Rzepa
 * Copyright: 2015-2020, ItemsAPI
 */
const lib = require('./lib');
const _ = require('lodash');
const helpers = require('./helpers2');
const Facets = require('./facets');
const storage = require('./storage');

module.exports = function itemsjs() {

  //configuration = configuration || {};

  var facets = new Facets();

  return {

    /**
     */
    index: async function(index_name, data) {

      var index_path = `./data/${index_name}.mdb`
      await facets.index(index_path, data);
    },

    /**
     */
    indexes_list: async function(index_name, data) {
    },

    load_sort_index: function() {
      facets.load_sort_index();
    },

    tokenize: function(query) {
      return facets.query_parser2(query);
    },

    get_item: function(id) {
      return storage.getItemByPkey(id);
    },

    update_item: function(data) {
      facets.update_item(data);
    },

    delete_item: function(id) {
      storage.deleteItem(id);
    },

    partial_update_item: function(id, data) {
      facets.partial_update_item(id, data);
    },

    /**
     * put settings
     */
    set_configuration: function(data) {
      facets.set_configuration(data);
    },

    get_configuration: function(data) {
      return facets.configuration();
    },

    reset: function(data) {
      storage.dropDB();
    },

    /**
     * per_page
     * page
     * query
     * sort
     * filters
     */
    search: function(index_name, input) {
      input = input || {};

      // @TODO
      if (0) {
        throw new Error('invalid index name');
      }

      //const index_regex = /[A-Z0-9_]/g;
      //const found = index_path.match(regex);

      var index_path = `./data/${index_name}.mdb`

      configuration = storage.getConfiguration(index_path);

      if (!configuration) {
        throw new Error('index first then search');
      }

      /**
       * merge configuration aggregation with user input
       */
      input.aggregations = helpers.mergeAggregations(configuration.aggregations, input);

      return lib.search(index_path, input, configuration, facets);
    },

    aggregation: function aggregation(input) {

      configuration = storage.getConfiguration();

      if (!configuration) {
        throw new Error('index first then search');
      }
      return lib.aggregation(input, configuration, facets);
    },
  }
}
