#include "itemsjs.h"
#include <iostream>
#include "roaring.hh"
#include "roaring.c"
#include <chrono>
#include <string>
#include "simdjson.h"
#include <bits/stdc++.h>
#include "lmdb2++.h"

using namespace simdjson;
using namespace std;

map<string, vector<int>> facets;
map<string_view, vector<int>> facets2;
map<string_view, map<string_view, vector<int>>> facets3;
map<string_view, map<string_view, Roaring>> roar;


std::string itemsjs::hello(){

  return "hello";
}

std::string itemsjs::index(string filename = ""){

  //string filename = "/home/mateusz/node/items-benchmark/datasets/shoprank_full.json";

  simdjson::dom::parser parser;
  //dom::element doc2 = parser.parse(" [ 1 , 2 , 3 ] "_padded);
  simdjson::dom::element items = parser.load(filename);

  dom::element item = items.at(9);
  //std::cout << first << std::endl;

  string sv = simdjson::minify(item);


  auto env = lmdb::env::create();
  env.set_mapsize(1UL * 1024UL * 1024UL * 1024UL * 5UL);
  env.set_max_readers(100);
  env.open("./db.mdb", 0, 0664);



  std::cout << "start tokenizing and indexing: " << std::endl;
  auto start = std::chrono::high_resolution_clock::now();

  int i = 1;
  for (dom::object item : items) {

    for (auto [key, value] : item) {

      if (value.type() == dom::element_type::ARRAY) {

        for (auto filter : value) {
          //cout << "filter: " << filter << endl;
          //std::string_view name = courier;
          //facets2[name].push_back(i);
          facets3[key][filter].push_back(i);

          roar[key][filter].add(i);
          //r1.add(i);
        }
        //facets3[key]
      }
    }

    ++i;
  }

  auto elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "roaring time: " << elapsed.count() / 1000000 << std::endl;

  auto wtxn = lmdb::txn::begin(env);
  auto dbi = lmdb::dbi::open(wtxn, nullptr);

  start = std::chrono::high_resolution_clock::now();

  i = 1;
  for (dom::element item : items) {

    string sv = simdjson::minify(item);
    string name = to_string(i) + "";
    dbi.del(wtxn, name);
    dbi.put(wtxn, name, sv);

    ++i;
  }

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "items put time: " << elapsed.count() / 1000000<< std::endl;

  start = std::chrono::high_resolution_clock::now();
  wtxn.commit();


  return sv;

}

Napi::String itemsjs::HelloWrapped(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::String returnValue = Napi::String::New(env, itemsjs::hello());
  return returnValue;
}

Napi::String itemsjs::IndexWrapped(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  Napi::String first = info[0].As<Napi::String>();
  string nowy(first);
  //cout << first << endl;
  //cout << nowy << endl;

  Napi::String returnValue = Napi::String::New(env, itemsjs::index(nowy));

  return returnValue;
}

Napi::Object itemsjs::Init(Napi::Env env, Napi::Object exports) {
  exports.Set("hello", Napi::Function::New(env, itemsjs::HelloWrapped));
  exports.Set("index", Napi::Function::New(env, itemsjs::IndexWrapped));
  //exports.Set("add", Napi::Function::New(env, itemsjs::IndexWrapped));
  //exports.Set("update", Napi::Function::New(env, itemsjs::IndexWrapped));
  //exports.Set("delete", Napi::Function::New(env, itemsjs::IndexWrapped));
  //exports.Set("search", Napi::Function::New(env, itemsjs::IndexWrapped));
  //exports.Set("aggregation", Napi::Function::New(env, itemsjs::IndexWrapped));
  //exports.Set("reindex", Napi::Function::New(env, itemsjs::IndexWrapped));
  return exports;
}
