const _ = require('lodash');

var clone = function(val) {

  try {
    return JSON.parse(JSON.stringify(val));
  } catch (e) {
    return val;
  }
}

module.exports.mergeAggregations = function(aggregations, input) {

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
