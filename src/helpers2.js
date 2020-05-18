const _ = require('lodash');
const RoaringBitmap32 = require('roaring/RoaringBitmap32');


const uniq_merge_sorted_arrays = function(array1, array2) {
  var merged = [];
  var index1 = 0;
  var index2 = 0;
  var current = 0;
  var last;

  while (current < (array1.length + array2.length)) {

    if (index1 < array1.length && (index2 >= array2.length || (array1[index1] < array2[index2]))) {
    //if (((array1[index1] < array2[index2]))) {

      if (last !== array1[index1]) {
        merged.push(array1[index1]);
      }
      last = array1[index1];
      index1++;
    } else {

      if (last !== array2[index2]) {
        merged.push(array2[index2]);
      }
      last = array2[index2];
      index2++;
    }

    current++;
  }

  return merged;
}


const intersection2 = function(arr1, arr2) {
  var i = 0;
  var j = 0;
  var output = [];
  var k = 0;

  while (i < arr1.length && j < arr2.length) {

    if (arr1[i] == arr2[j]) {
      output.push(arr1[i]);
      ++i;
      ++j;

    } else if(arr1[i] > arr2[j]) {
      ++j;

    }
    else {
      ++i;

    }
  }

  return output;
}


const intersection = function(array1, array2) {

  if (array1.length < array2.length) {
    return array1.filter(v => {
      return _.sortedIndexOf(array2, v) !== -1;
    })
  } else {
    return array2.filter(v => {
      return _.sortedIndexOf(array1, v) !== -1;
    })
  }
};

const findex = function(items, config) {

  var facets = {
    data: {},
    bits_data: {},
    bits_data_temp: {},
  };

  var id = 1;
  var fields = _.keys(config);
  //var field = 'tags';

  items = _.map(items, item => {

    /*if (!item['id']) {
      item['id'] = id;
      ++id;
    }*/

    item['id'] = id;
    ++id;

    return item;
  });

  var list = _.chain(items)
    .map(item => {

      fields.forEach(field => {

        if (!item || !item[field]) {
          return;
        }

        if (!Array.isArray(item[field])) {
          item[field] = [item[field]];
        }

        item[field].forEach(v => {

          if (!item[field]) {
            return;
          }

          if (!facets['data'][field]) {
            facets['data'][field] = {};
          }

          if (!facets['data'][field][v]) {
            facets['data'][field][v] = [];
          }

          facets['data'][field][v].push(parseInt(item.id));
        })



      })

      /*
       * we are setting up a bit vector indexes
       */
      /*_.mapValues(facets['data'][field], (indexes, key) => {

        if (!facets['bits_data'][field]) {
          facets['bits_data'][field] = {};
        }

        console.log(indexes);

        facets['bits_data'][field][key] = new FastBitSet(indexes);
      })*/

      return item;
    })
    .value();

  //console.log(list);


  facets['data'] = _.mapValues(facets['data'], function(values, field) {


    if (!facets['bits_data'][field]) {
      facets['bits_data'][field] = {};
      facets['bits_data_temp'][field] = {};
    }

    //console.log(values);
    return _.mapValues(values, function(indexes, filter) {

      var sorted_indexes = _.sortBy(indexes);


      //console.log(field, filter)
      //console.log(sorted_indexes);
      //facets['bits_data'][field][filter] = new FastBitSet(sorted_indexes);
      facets['bits_data'][field][filter] = new RoaringBitmap32(sorted_indexes);
      facets['bits_data'][field][filter].runOptimize()

      //console.log(values2)
      //return values2;
      return sorted_indexes;
      //return algo.quick_sort(values2);
    })
  });

  return facets;
}

/**
 * intersection or unique merge for each facet groups
 * it's working probably only for disjunction
 * and for facets being filtered
 */
// change name to disjunction_facet_sum

const combination = function(facets_data, input, config) {

  var output = {};

  _.mapValues(input.filters, function(filters, field) {

    filters.forEach(filter => {

      if (!output[field]) {
        output[field] = new RoaringBitmap32(facets_data[field][filter]);
      } else if (facets_data[field][filter]) {
        output[field] = RoaringBitmap32.and(output[field], facets_data[field][filter]);
      }
    })
  })

  //return new RoaringBitmap32(output);
  return output;
}

const disjunction_union = function(facets_data, input, config) {

  var output = {};

  _.mapValues(input.filters, function(filters, field) {

    // it's only for disjunctive filters
    if (config[field].conjunction !== false) {
      return;
    }

    if (!output[field]) {
      output[field] = new RoaringBitmap32([]);
    }

    filters.forEach(filter => {

      _.mapValues(facets_data[field], function(values2, key2) {

        if (key2 === filter) {

          output[field] = RoaringBitmap32.or(output[field], values2);
          //output[field] = uniq_merge_sorted_arrays(output[field], values2);
          //output = intersection(output, values2);
        }
      })
    })
  })

  //return new RoaringBitmap32(output);
  return output;
}

/**
 * calculates ids for facets
 * if there is no facet input then return null to not save resources for OR calculation
 * null means facets haven't crossed searched items
 */
const ids = function(facets_data, input, config) {

  var output = new RoaringBitmap32([]);
  var i = 0;

  _.mapValues(input.filters, function(filters, field) {

    filters.forEach(filter => {

      ++i;
      output = RoaringBitmap32.or(output, facets_data[field][filter]);
    })
  })

  if (i === 0) {
    return null;
  }

  return output;
}

/**
 * cross each facet filters with query ids
 */
const facets_intersection = function(data, ids) {

  return _.mapValues(data, (v, k) => {
    return _.mapValues(v, (v2, k2) => {
      return intersection(v2, ids);
    })
  })

}

const getBuckets = function(data, input, aggregations) {

  //return _.mapValues(data['data'], (v, k) => {
  return _.mapValues(data['bits_data_temp'], (v, k) => {

    var order;
    var sort;
    var size;

    if (aggregations[k]) {
      order = aggregations[k].order;
      sort = aggregations[k].sort;
      size = aggregations[k].size;
    }

    var buckets = _.chain(v)
    .toPairs().map(v2 => {

      var filters = [];

      if (input && input.filters && input.filters[k]) {
        filters = input.filters[k];
      }

      return {
        key: v2[0],
        //doc_count: v2[1].length,
        doc_count: v2[1].size,
        selected: filters.indexOf(v2[0]) !== -1
      }
    })
    .value();

    if (sort === 'term') {
      buckets = _.orderBy(buckets, ['selected', 'key'], ['desc', order || 'asc']);
    } else {
      buckets = _.orderBy(buckets, ['selected', 'doc_count', 'key'], ['desc', order || 'desc', 'asc']);
    }

    buckets = buckets.slice(0, size || 10);

    return {
      buckets: buckets
    };

  })
}

module.exports.uniq_merge_sorted_arrays = uniq_merge_sorted_arrays;
module.exports.facets_intersection = facets_intersection;
//module.exports.intersection = intersection;
module.exports.intersection = intersection2;
module.exports.facets_ids = ids;
module.exports.disjunction_union = disjunction_union;
module.exports.combination = combination;
module.exports.index = findex;
module.exports.getBuckets = getBuckets;
module.exports.getFacets = getBuckets;
