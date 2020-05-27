'use strict';

const lib = require('./src/lib');

var itemsjs = require('./src/index')();

for (let i = 0; i < 1E10; i++) {

  var result = itemsjs.search({
    per_page: 1,
    page: 1,
    query: '',
    filters: {
      couriers: []
    }
  });
}

