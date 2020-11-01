/*
 * Author: Mateusz Rzepa
 * Copyright: 2015-2020, ItemsAPI
 */
const _ = require('lodash');
const RoaringBitmap32 = require('roaring/RoaringBitmap32');

var clone = function(val) {

  try {
    return JSON.parse(JSON.stringify(val));
  } catch (e) {
    return val;
  }
}

var mergeAggregations = function(aggregations, input) {

  return _.mapValues(clone(aggregations), (val, key) => {

    if (!val.field) {
      val.field = key;
    }

    var filters = [];
    if (input.filters && input.filters[key]) {
      filters = input.filters[key];
    }

    val.filters = filters;

    var not_filters = [];
    if (input.not_filters && input.not_filters[key]) {
      not_filters = input.not_filters[key];
    }

    if (input.exclude_filters && input.exclude_filters[key]) {
      not_filters = input.exclude_filters[key];
    }

    val.not_filters = not_filters;


    return val;
  });
}

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

const getBuckets = function(data, input, aggregations) {

  //return _.mapValues(data['data'], (v, k) => {
  return _.mapValues(data['counters'], (v, k) => {

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
        doc_count: Number.isInteger(v2[1]) ? v2[1] : v2[1].size,
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

const parse_filter_key = function(key) {

  var array = key.split(/\.(.+)/);
  var key1 = array[0];
  var key2 = array[1];

  return [key1, key2];
}

const bigrams = function(list) {

  var res = [];
  for (var i = 0 ; i < list.length - 1 ; ++i) {
    res.push([list[i], list[i+1]]);
  }
  return res;
}

const wildcard_search = function (str, rule) {
  var escapeRegex = (str) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
  return new RegExp("^" + rule.split("*").map(escapeRegex).join(".*") + "$").test(str);
}

module.exports.wildcard_search = wildcard_search;
module.exports.mergeAggregations = mergeAggregations;
module.exports.parse_filter_key = parse_filter_key;
module.exports.uniq_merge_sorted_arrays = uniq_merge_sorted_arrays;
module.exports.bigrams = bigrams;
module.exports.getBuckets = getBuckets;
module.exports.getFacets = getBuckets;
