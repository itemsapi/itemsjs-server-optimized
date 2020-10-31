/*
 * Author: Mateusz Rzepa
 * Copyright: 2015-2020, ItemsAPI
 */
const _ = require('lodash');
const helpers2 = require('./helpers2');
const storage = require('./storage');
const addon = require('bindings')('itemsjs_addon.node');
const RoaringBitmap32 = require('roaring/RoaringBitmap32');

/**
 * search by filters
 */
module.exports.search = function(index_path, input, configuration, facets) {

  input = input || {};

  //console.log(input);

  var per_page = parseInt(input.per_page || 12);
  var page = parseInt(input.page || 1);
  var order = input.order;
  var sort_field = input.sort_field;
  var query_ids;
  var search_time = new Date().getTime();
  var total_time = new Date().getTime();

  if (input.query) {
    query_ids = facets.fulltext(index_path, input);
    //query_ids = facets.proximity_search(input);
    //console.log(query_ids);
  }

  search_time = new Date().getTime() - search_time;


  /**
   * ------------------------------------------
   * new facets sort
   * sort query ids
   */
  var sort_time = new Date().getTime();
  sort_time = new Date().getTime() - sort_time;

  // -------------------------------------------

  var new_facet_time = new Date().getTime();

  var facet_result;

  facet_result = facets.search_native(index_path, input, {
    query_ids: query_ids
  });

  new_facet_time = new Date().getTime() - new_facet_time;
  // ------------------------------------------

  var facets_ids_time = new Date().getTime();

  var _ids_bitmap = storage.getIdsBitmap(index_path);

  if (input.query) {
    _ids_bitmap = query_ids;
  }

  var filtered_indexes_bitmap = _ids_bitmap;

  if (facet_result.ids) {
    filtered_indexes_bitmap = RoaringBitmap32.and(filtered_indexes_bitmap, facet_result.ids);
  }

  if (facet_result.not_ids) {
    filtered_indexes_bitmap = RoaringBitmap32.andNot(filtered_indexes_bitmap, facet_result.not_ids);
  }

  var new_items_indexes;

  var proximity_ids_bitmap = facets.proximity_search(index_path, input, filtered_indexes_bitmap);
  var total = filtered_indexes_bitmap.size;

  if (proximity_ids_bitmap.size) {
    filtered_indexes_bitmap = RoaringBitmap32.andNot(filtered_indexes_bitmap, proximity_ids_bitmap);
  }

  /**
   * sorting items
   */
  var sorting_time = 0;

  var sorting_start_time = new Date().getTime();

  var time = new Date().getTime();
  new_items_indexes = facets.pagination_sort_ids(filtered_indexes_bitmap, sort_field, order, per_page, page);
  console.log(`sort time: ${new Date().getTime() - time}`);

  if (proximity_ids_bitmap.size) {

    var time = new Date().getTime();
    var proximity_ids = facets.pagination_sort_ids(proximity_ids_bitmap, sort_field, order, per_page, page)
    console.log(`sort 2 time: ${new Date().getTime() - time}`);

    // make proximity search results first
    new_items_indexes = proximity_ids.concat(new_items_indexes);
    // pagination again after proximity concatenation
    new_items_indexes = new_items_indexes.slice((page - 1) * per_page, page * per_page);
  }

  sorting_time = new Date().getTime() - sorting_start_time;
  var new_items = storage.getItems(index_path, new_items_indexes);
  facets_ids_time = new Date().getTime() - facets_ids_time;
  // -------------------------------------

  var time = new Date().getTime();
  var aggregations = helpers2.getBuckets(facet_result, input, configuration.aggregations);
  console.log(`aggregations process time: ${new Date().getTime() - time}`);
  total_time = new Date().getTime() - total_time;

  console.log(`facets search time: ${new_facet_time}`);
  //console.log(`filters time: ${facets_ids_time}`);
  console.log(`total total search time: ${total_time}`);

  return {
    pagination: {
      per_page: per_page,
      page: page,
      total: total
    },
    timings: {
      total: total_time,
      sort: sort_time,
      facets: new_facet_time,
      //filters: facets_ids_time,
      search: search_time,
      sorting: sorting_time
    },
    data: {
      items: new_items,
      aggregations: aggregations,
    }
  };
}

/**
 * returns list of elements in specific facet
 * useful for autocomplete or list all aggregation options
 */
module.exports.aggregation = function (index_path, input, configuration, facets) {

  if (!input || !input.name) {
    throw new Error('field name is required');
  }

  var per_page = input.per_page || 10;
  var page = input.page || 1;
  var query = input.query;

  //console.log(configuration);

  if (input.name && (!configuration.aggregations || !configuration.aggregations[input.name])) {
    throw new Error("Please define aggregation \"".concat(input.name, "\" in config"));
  }

  var search_input = _.cloneDeep(input);

  search_input.page = 1;
  search_input.per_page = 0;


  configuration.aggregations[input.name].size = 10000;

  var result = module.exports.search(index_path, search_input, configuration, facets);
  var buckets = result.data.aggregations[input.name].buckets;

  if (query) {
    buckets = buckets.filter(v => {
      var key = v.key.toLowerCase();
      return helpers2.wildcard_search(key, query);
    });
  }

  return {
    pagination: {
      per_page: per_page,
      page: page,
      total: buckets.length
    },
    data: {
      buckets: buckets.slice((page - 1) * per_page, page * per_page)
    }
  };
};
