const Facets = require('./src/facets');

const configuration = {
  searchableFields: ['couriers'],
  aggregations: {
    couriers: {
      title: 'Couriers',
      size: 10,
      conjunction: true
      //conjunction: false
    },
    psp_providers: {
      title: 'PSP',
      size: 10,
      conjunction: true
      //conjunction: false
    },
    country: {
      title: 'Country',
      size: 10,
      conjunction: false
      //conjunction: false
    },
    tech: {
      title: 'Tech',
      size: 10,
      conjunction: true
      //conjunction: false
    }
  }
}

var path = '/home/mateusz/node/items-benchmark/datasets/shoprank_full.json';
//var path = '/home/mateusz/node/items-benchmark/datasets/shoprank_full_3.json';
//var path = '/home/mateusz/node/items-benchmark/datasets/shoprank.json';
//var path = '/mnt/3baefc02-13c3-4d4f-b95d-ab31da255608/datasets/shoprank_full_concatenated.json';

/*var facets = new Facets(configuration.aggregations);
facets.index(path, configuration.aggregations);

var result = facets.search({
  filters: {
    couriers: ['DHL'],
    psp_providers: ['VISA'],
  }
})


console.log(result.bits_data_temp.couriers.DHL)
console.log(result.bits_data_temp.couriers.UPS)*/


var itemsjs = require('./src/index')(configuration);

//itemsjs.index(path);

var result = itemsjs.search({
  page: 5,
  per_page: 10,
  filters: {
    couriers: ['DHL', 'Hermes']
  }
});

console.log(result)
console.log(result.data.aggregations.couriers)
