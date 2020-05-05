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

map<string_view, map<string_view, vector<int>>> facets3;
map<string_view, map<string_view, Roaring>> roar;

std::string itemsjs::hello(){

  return "hello";
}

std::string itemsjs::json(){

  return "json";
}

std::string itemsjs::index(string json_path, string json_string) {

  auto env = lmdb::env::create();
  env.set_mapsize(1UL * 1024UL * 1024UL * 1024UL); /* 1 GiB */
  env.set_max_dbs(3);
  env.open("./example.mdb", 0, 0664);

  //string filename = "/home/mateusz/node/items-benchmark/datasets/shoprank_full.json";

  simdjson::dom::parser parser;
  simdjson::dom::element items;


  if (!json_path.empty()) {
    items = parser.load(json_path);
  } else {
    items = parser.parse(json_string);
  }

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

      else if (key == "year" and value.type() == dom::element_type::INT64) {

        string year(to_string(int64_t(value)));
        char *char_array = new char [year.length()];
        strcpy(char_array, year.c_str());
        string_view filter (char_array, year.length());

        facets3[key][filter].push_back(i);
        roar[key][filter].add(i);
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
      cout << name << endl;

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

  Napi::Object first = info[0].As<Napi::Object>();
  //string nowy(first);
  //cout << first << endl;
  //cout << nowy << endl;

  //cout << first.Has("json_path") << endl;
  //cout << first.Has("json_object") << endl;
  //cout << first.Has("json_string") << endl;

  Napi::String returnValue;
  string json_string;

  if (first.Has("json_object")) {

    Napi::Value json_object = first.Get("json_object");

    Napi::Object json = env.Global().Get("JSON").As<Napi::Object>();
    Napi::Function stringify = json.Get("stringify").As<Napi::Function>();
    string json_string =  stringify.Call(json, { json_object }).As<Napi::String>();

    returnValue = Napi::String::New(env, itemsjs::index("", json_string));

  } else if (first.Has("json_path")) {

    Napi::Value json_path = first.Get("json_path");
    string json_path_string(json_path.ToString());

    returnValue = Napi::String::New(env, itemsjs::index(json_path_string, ""));

  } else if (first.Has("json_string")) {

    Napi::Value json_string = first.Get("json_string");
    string json_string_string(json_string.ToString());

    returnValue = Napi::String::New(env, itemsjs::index("", json_string_string));
  }



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
