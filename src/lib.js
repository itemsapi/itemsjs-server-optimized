const _ = require('lodash');
const helpers = require('./helpers');
const helpers2 = require('./helpers2');
const storage = require('./storage');
const algo = require('./algo');
const RoaringBitmap32 = require('roaring/RoaringBitmap32');

/**
 * search by filters
 */
//module.exports.search = function(items, input, configuration, fulltext, facets) {
module.exports.search = function(input, configuration, facets) {


  input = input || {};

  var per_page = parseInt(input.per_page || 12);
  var page = parseInt(input.page || 1);
  var query_ids;
  var search_time = new Date().getTime();

  if (input.query) {
    query_ids = facets.fulltext(input);
    //console.log(query_ids);
  }

  search_time = new Date().getTime() - search_time;

  var total_time_start = new Date().getTime();

  /**
   * ------------------------------------------
   * new facets sort
   * sort query ids
   */
  var sort_time = new Date().getTime();
  sort_time = new Date().getTime() - sort_time;

  // -------------------------------------------

  var new_facet_time = new Date().getTime();

  /**
   * new facet search also by using sort
   */

  //var facet_result = facets.search(input, {
    //query_ids: input.query ? new RoaringBitmap32(sorted_ids) : undefined
  //});
  var facet_result = facets.search(input, {
    // it will be loaded with query ids
    query_ids: query_ids
  });


  console.log('finished facets');

  new_facet_time = new Date().getTime() - new_facet_time;


  // new filters to items
  // -------------------------------------

  var facets_ids_time = new Date().getTime();
  // it's super fast around 5ms on 500K records
  var facets_ids_bits = helpers2.facets_ids(facet_result['bits_data_temp'], input, configuration.aggregations);

  //var _ids = storage.getIds();
  var _ids_bitmap = storage.getIdsBitmap();


  if (input.query) {
    _ids_bitmap = query_ids;
  }

  var filtered_indexes;

  var filtered_indexes_bitmap = _ids_bitmap;

  if (facets_ids_bits) {
    filtered_indexes_bitmap = RoaringBitmap32.and(_ids_bitmap, facets_ids_bits);
  }


  // the ids should be sorted here if necessary

  var new_items_indexes = filtered_indexes_bitmap.rangeUint32Array((page - 1) * per_page, per_page);

  var new_items = storage.getItems(new_items_indexes);

  facets_ids_time = new Date().getTime() - facets_ids_time;
  // -------------------------------------

  /**
   * sorting items
   */
  var sorting_time = 0;
  if (input.sort) {
    var sorting_start_time = new Date().getTime();
    filtered_items = module.exports.sorted_items(filtered_items, input.sort, configuration.sortings);
    sorting_time = new Date().getTime() - sorting_start_time;
  }

  /**
   * calculating facets
   */
  var facets_start_time = new Date().getTime();
  //var aggregations = module.exports.aggregations(items, input.aggregations);
  var facets_time = new Date().getTime() - facets_start_time;
  var total_time = new Date().getTime() - total_time_start;

  return {
    pagination: {
      per_page: per_page,
      page: page,
      total: filtered_indexes_bitmap.size
    },
    timings: {
      total: total_time,
      sort: sort_time,
      facets: new_facet_time,
      filters: facets_ids_time,
      search: search_time,
      sorting: sorting_time
    },
    data: {
      items: new_items,
      //aggregations: aggregations,
      aggregations: helpers2.getBuckets(facet_result, input, configuration.aggregations),
    }
  };
}

/**
 * return items by sort
 */
module.exports.sorted_items = function(items, sort, sortings) {
  if (sortings && sortings[sort]) {
    sort = sortings[sort];
  }

  if (sort.field) {
    return _.orderBy(
      items,
      sort.field,
      sort.order || 'asc'
    );
  }

  return items;
}


/**
 * returns list of elements in specific facet
 * useful for autocomplete or list all aggregation options
 */
module.exports.aggregation = function (input, configuration, facets) {
  var per_page = input.per_page || 10;
  var page = input.page || 1;

  console.log(configuration);

  if (input.name && (!configuration.aggregations || !configuration.aggregations[input.name])) {
    throw new Error("Please define aggregation \"".concat(input.name, "\" in config"));
  }

  var search_input = _.cloneDeep(input);

  search_input.page = 1;
  search_input.per_page = 0;

  if (!input.name) {
    throw new Error('field name is required');
  }

  configuration.aggregations[input.name].size = 10000;

  var result = module.exports.search(search_input, configuration, facets);
  var buckets = result.data.aggregations[input.name].buckets;

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
