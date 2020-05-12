'use strict';

const assert = require('assert');
const storage = require('./../src/storage');
const helpers2 = require('./../src/helpers2');
const addon = require('bindings')('itemsjs_addon.node');

var data = [{
  id: 1,
  name: 'movie1',
  tags: ['a', 'b', 'c', 'd'],
  actors: ['john', 'alex'],
  category: 'drama'
}, {
  id: 2,
  name: 'movie2',
  tags: ['a', 'e', 'f'],
  actors: ['john', 'brad'],
  category: 'comedy'
}, {
  id: 3,
  name: 'movie3',
  tags: ['a', 'c'],
  actors: ['jeff'],
  category: 'comedy'
}, {
  id: 4,
  name: 'movie4',
  tags: ['c', 'a', 'z'],
  actors: ['jean'],
  category: 'drama'
}]

describe('indexing', function() {

  it('checks index', function test(done) {

    //var index = addon.index('/home/mateusz/node/items-benchmark/datasets/shoprank_full.json');
    var index = addon.index({
      json_path: './tests/fixtures/movies.json',
      faceted_fields: ['actors', 'genres', 'year', 'director']
      //fields: ['actors', 'genres', 'year']
    });

    var filter_index = storage.getFilterIndex('actors.Al Pacino');
    assert.deepEqual(2, filter_index.size);
    assert.deepEqual([2, 4], filter_index.toArray());

    var filter_index = storage.getFilterIndex('genres.Drama');
    assert.deepEqual(15, filter_index.size);

    var filter_index = storage.getFilterIndex('year.1974');
    assert.deepEqual(1, filter_index.size);

    var filter_index = storage.getFilterIndex('year.2008');
    assert.deepEqual(1, filter_index.size);

    var filter_index = storage.getFilterIndex('director.Sergio Leone');
    assert.deepEqual(1, filter_index.size);


    var filter_indexes = storage.getFilterIndexes();
    assert.deepEqual(1, filter_indexes['director.Sergio Leone'].size);


    var keys_list = storage.getKeysList('keys_list');
    //console.log(JSON.stringify(keys_list));
    assert.deepEqual('actors.Aamir Khan', keys_list[0]);

    var item = storage.getItem(1);
    assert.deepEqual(item.name, 'The Shawshank Redemption');

    var item = storage.getItem(1);
    assert.deepEqual(item.name, 'The Shawshank Redemption');

    var items = storage.getItems([1, 2]);
    assert.deepEqual(items[0].name, 'The Shawshank Redemption');

    var ids = storage.getIdsBitmap();
    assert.deepEqual(ids.size, 20);

    var index = storage.getSearchTermIndex('shawshank');
    assert.deepEqual(1, index.size);

    var index = storage.getSearchTermIndex('lead');
    assert.deepEqual(1, index.size);

    var index = storage.getSearchTermIndex('men');
    console.log(index.toArray());
    assert.deepEqual(6, index.size);

    var index = storage.getSearchTermIndex('henry');
    assert.deepEqual(2, index.size);

    var index = storage.getSearchTermIndex('fonda');
    assert.deepEqual(1, index.size);

    var index = storage.getSearchTermIndex('ojojoj');
    assert.deepEqual(undefined, index);

    done();
  })

  it('checks index creating from non json object', function test(done) {

    var index = addon.index({
      json_object: data,
      faceted_fields: ['category', 'actors', 'tags']
    });

    var item = storage.getItem(1);
    assert.deepEqual(item.name, 'movie1');

    var item = storage.getItem(2);
    assert.deepEqual(item.name, 'movie2');

    var items = storage.getItems([1, 2]);
    assert.deepEqual(items[0].name, 'movie1');


    var filter_index = storage.getFilterIndex('category.drama');
    assert.deepEqual(2, filter_index.size);

    var filter_index = storage.getFilterIndex('actors.john');
    assert.deepEqual(2, filter_index.size);

    var filter_index = storage.getFilterIndex('id.1');
    assert.deepEqual(undefined, filter_index);

    done();
  })

  it('checks index creating from stringified json', function test(done) {

    var index = addon.index({
      json_string: JSON.stringify(data),
      faceted_fields: ['category', 'actors', 'tags']
    });

    var item = storage.getItem(1);
    assert.deepEqual(item.name, 'movie1');

    done();
  })
})

