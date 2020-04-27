const _ = require('lodash');
const helpers = require('./helpers');
const helpers2 = require('./helpers2');
const algo = require('./algo');
const Fulltext = require('./fulltext');
const RoaringBitmap32 = require('roaring/RoaringBitmap32');

/**
 * search by filters
 */
module.exports.search = function(items, input, configuration, fulltext, facets) {


  input = input || {};

  var per_page = parseInt(input.per_page || 12);
  var page = parseInt(input.page || 1);

  var search_time = 0;
  var total_time_start = new Date().getTime();
  // make search by query first
  if (fulltext) {

    var search_start_time = new Date().getTime();
    items = fulltext.search(input.query);
    search_time = new Date().getTime() - search_start_time;
  }

  /**
   * making a items filtering after search and before faceting
   */
  if (input.filter instanceof Function) {
    items = items.filter(input.filter);
  }

  // @deprecated
  if (input.prefilter instanceof Function) {
    items = input.prefilter(items);
  }


  /**
   * ------------------------------------------
   * new facets sort
   * sort query ids
   */

  var sort_time = new Date().getTime();
  //var sorted_ids =
  var sorted_ids;

  if (input.query) {
    sorted_ids = algo.quick_sort(_.map(items, v => {
      return parseInt(v.id);
    }));
    console.log('elements to sort: ' + sorted_ids.length);
  }
  sort_time = new Date().getTime() - sort_time;

  // -------------------------------------------

  var new_facet_time = new Date().getTime();

  /**
   * new facet search also by using sort
   */

  var facet_result = facets.search(input, {
    query_ids: input.query ? new RoaringBitmap32(sorted_ids) : undefined
  });
  new_facet_time = new Date().getTime() - new_facet_time;


  // new filters to items
  // -------------------------------------

  var facets_ids_time = new Date().getTime();
  // it's super fast around 5ms on 500K records
  var facets_ids_bits = helpers2.facets_ids(facet_result['bits_data_temp'], input, configuration.aggregations);

  //console.log(facets_ids.toArray().length);

  var facets_ids = null;

  if (facets_ids_bits !== null) {
    facets_ids = facets_ids_bits.toArray();
  }

  var _ids = fulltext.internal_ids();
  if (input.query) {
    _ids = sorted_ids;
  }

  var filtered_indexes;



  /**
   * if query does not exist then take ids from index
   * if query exists then take newly created (it should be precalculated once making search)
   */

  if (facets_ids === null) {
    //filtered_indexes = _.map(items, 'id');
    filtered_indexes = _ids;
  } else if (input.query) {


    // it could be improved
    filtered_indexes = _.map(items, 'id').filter(v => {
      return _.sortedIndexOf(facets_ids, v) !== -1;
    })
  } else {

    // it could be improved

    //console.log(fulltext.bits_ids().toArray());
    //console.log(fulltext._ids);

    filtered_indexes = RoaringBitmap32.and(fulltext.bits_ids(), facets_ids_bits).toArray();

    //filtered_indexes = _ids.filter(v => {
      //return _.sortedIndexOf(facets_ids, v) !== -1;
    //})
  }

  var new_items_indexes = filtered_indexes.slice((page - 1) * per_page, page * per_page);
  var new_items;

  new_items = _.map(new_items_indexes, id => {
    return fulltext.get_item(id);
  })

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
      total: filtered_indexes.length
    },
    timings: {
      total: total_time,
      sort: sort_time,
      facets: facets_time,
      //filters: filters_time,
      new_facets: new_facet_time,
      new_filters: facets_ids_time,
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
 * returns list of elements in aggregation
 * useful for autocomplete or list all aggregation options
 */
module.exports.similar = function(items, id, options) {

  var result = [];
  var per_page = options.per_page || 10;
  var minimum = options.minimum || 0;
  var page = options.page || 1;

  var item;

  for (var i = 0 ; i < items.length ; ++i) {
    if (items[i].id == id) {
      item = items[i];
      break;
    }
  }

  if (!options.field) {
    throw new Error(`Please define field in options`);
  }

  var field = options.field;
  var sorted_items = [];

  for (var i = 0 ; i < items.length ; ++i) {

    if (items[i].id !== id) {
      var intersection = _.intersection(item[field], items[i][field])

      if (intersection.length >= minimum) {
        sorted_items.push(items[i]);
        sorted_items[sorted_items.length - 1].intersection_length = intersection.length;
      }
    }
  }

  sorted_items = _.orderBy(
    sorted_items,
    ['intersection_length'],
    ['desc']
  );

  return {
    pagination: {
      per_page: per_page,
      page: page,
      total: sorted_items.length
    },
    data: {
      items: sorted_items.slice((page - 1) * per_page, page * per_page),
    }
  }
}
