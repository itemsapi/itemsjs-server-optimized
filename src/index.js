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
    list_indexes: async function(params) {
      return facets.list_indexes(params);
    },

    load_sort_index: function(index_name) {

      var index_path = `./data/${index_name}.mdb`
      facets.load_sort_index(index_path);
    },

    tokenize: function(query) {
      return facets.query_parser2(query);
    },

    get_item: function(index_name, id) {

      var index_path = `./data/${index_name}.mdb`
      return storage.getItemByPkey(index_path, id);
    },

    update_item: function(index_name, data) {

      var index_path = `./data/${index_name}.mdb`
      facets.update_item(index_path, data);
    },

    delete_item: function(index_name, id) {

      var index_path = `./data/${index_name}.mdb`
      storage.deleteItem(index_path, id);
    },

    partial_update_item: function(index_name, id, data) {

      var index_path = `./data/${index_name}.mdb`
      facets.partial_update_item(index_path, id, data);
    },

    /**
     * put settings
     */
    set_configuration: function(index_name, data) {

      var index_path = `./data/${index_name}.mdb`
      facets.set_configuration(index_path, data);
    },

    get_configuration: function(index_name) {

      var index_path = `./data/${index_name}.mdb`
      return facets.configuration(index_path);
    },

    reset: function(index_name, data) {

      var index_path = `./data/${index_name}.mdb`
      storage.dropDB(index_path);
    },

    /**
     * per_page
     * page
     * query
     * sort
     * filters
     */
    search: async function(index_name, input, options) {
      input = input || {};
      options = options || {};

      // @TODO
      //if (0) {
        //throw new Error('invalid index name');
      //}

      var index_path = `./data/${index_name}.mdb`

      configuration = storage.getConfiguration(index_path);

      if (!configuration) {
        throw new Error('index first then search');
      }

      /**
       * merge configuration aggregation with user input
       */
      input.aggregations = helpers.mergeAggregations(configuration.aggregations, input);

      return await lib.search(index_path, input, configuration, facets, options);
    },

    aggregation: async function aggregation(index_name, input) {

      var index_path = `./data/${index_name}.mdb`

      configuration = storage.getConfiguration(index_path);

      if (!configuration) {
        throw new Error('index first then search');
      }
      return await lib.aggregation(index_path, input, configuration, facets);
    },
  }
}
