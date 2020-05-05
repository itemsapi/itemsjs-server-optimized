#include "itemsjs.h"
//#include <iostream>
#include "roaring.hh"
#include "roaring.c"
#include <chrono>
#include <string>
#include "simdjson.h"
#include <bits/stdc++.h>
#include "lmdb2++.h"

#include <node.h>
#include <node_buffer.h>

using namespace simdjson;
using namespace std;

map<string, vector<int>> facets;
map<string_view, vector<int>> facets2;
map<string_view, map<string_view, vector<int>>> facets3;
map<string_view, map<string_view, Roaring>> roar;

std::string itemsjs::hello(){

  return "hello";
}

std::string itemsjs::json(){

  return "json";
}

std::string itemsjs::index(string filename = "") {

  auto env = lmdb::env::create();
  env.set_mapsize(1UL * 1024UL * 1024UL * 1024UL); /* 1 GiB */
  env.set_max_dbs(3);
  env.open("./example.mdb", 0, 0664);

  //string filename = "/home/mateusz/node/items-benchmark/datasets/shoprank_full.json";

  simdjson::dom::parser parser;
  simdjson::dom::element items = parser.load(filename);

  /*auto env = lmdb::env::create();
  env.set_mapsize(1UL * 1024UL * 1024UL * 1024UL * 5UL);
  env.set_max_readers(100);
  env.open("./db.mdb", 0, 0664);*/

  /*dom::element first = items.at(0);
  string sv = simdjson::minify(first);
  std::cout << sv << std::endl;*/



  auto wtxn = lmdb::txn::begin(env);
  auto dbi = lmdb::dbi::open(wtxn, nullptr);

  auto start = std::chrono::high_resolution_clock::now();

  int i = 1;
  for (dom::element item : items) {

    string sv = simdjson::minify(item);
    string name = to_string(i) + "";
    //dbi.del(wtxn, name);
    dbi.put(wtxn, name.c_str(), sv.c_str());

    ++i;
  }

  auto elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "items put time: " << elapsed.count() / 1000000<< std::endl;

  start = std::chrono::high_resolution_clock::now();
  wtxn.commit();

  std::cout << "start tokenizing and indexing: " << std::endl;
  start = std::chrono::high_resolution_clock::now();

  i = 1;
  for (dom::object item : items) {

    for (auto [key, value] : item) {

      if (value.type() == dom::element_type::ARRAY) {

        for (auto filter : value) {
          //cout << "key: " << key <<  " filter: " << filter << endl;
          facets3[key][filter].push_back(i);

          roar[key][filter].add(i);
        }
      }
    }

    ++i;
  }

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "roaring time: " << elapsed.count() / 1000000 << std::endl;


  wtxn = lmdb::txn::begin(env);
  dbi = lmdb::dbi::open(wtxn, nullptr);


  start = std::chrono::high_resolution_clock::now();
  for (auto&& [key, value] : roar) {
    // use first and second
    //std::cout << key << '\n';
    for (auto&& [key2, roar_object] : value) {

      std::string sv(key);
      std::string sv2(key2);
      string name = sv + "." + sv2;

      int expectedsize = roar_object.getSizeInBytes();


      //cout << "key: " << key <<  " filter: " << filter << endl;
      //cout << name << endl;

      // ensure to free memory somewhere
      char *serializedbytes = new char [expectedsize];
      roar_object.write(serializedbytes);
      std::string_view nowy(serializedbytes, expectedsize);
      //serializedbytes[expectedsize] = '\0';
      //dbi.del(wtxn, name);
      dbi.put(wtxn, name, nowy);
      //dbi.put(wtxn, name.c_str(), serializedbytes);
    }
  }

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "put time: " << elapsed.count() / 1000000<< std::endl;

  start = std::chrono::high_resolution_clock::now();
  wtxn.commit();

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "commit time: " << elapsed.count() / 1000000<< std::endl;


  return "index";

}

Napi::String itemsjs::HelloWrapped(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::String returnValue = Napi::String::New(env, itemsjs::hello());
  return returnValue;
}

Napi::String itemsjs::JsonWrapped(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::String json_string = info[0].As<Napi::String>();
  cout << json_string << endl;
  Napi::String returnValue = Napi::String::New(env, itemsjs::json());
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
  exports.Set("json", Napi::Function::New(env, itemsjs::JsonWrapped));
  //exports.Set("add", Napi::Function::New(env, itemsjs::IndexWrapped));
  //exports.Set("update", Napi::Function::New(env, itemsjs::IndexWrapped));
  //exports.Set("delete", Napi::Function::New(env, itemsjs::IndexWrapped));
  //exports.Set("search", Napi::Function::New(env, itemsjs::IndexWrapped));
  //exports.Set("aggregation", Napi::Function::New(env, itemsjs::IndexWrapped));
  //exports.Set("reindex", Napi::Function::New(env, itemsjs::IndexWrapped));
  return exports;
}
