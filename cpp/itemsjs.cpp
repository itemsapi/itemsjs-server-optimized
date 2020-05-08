#include "itemsjs.h"
//#include <iostream>
#include "roaring.hh"
#include "roaring.c"
#include <chrono>
#include <string>
#include "simdjson.h"
#include <bits/stdc++.h>
#include "lmdb2++.h"

using namespace simdjson;
using namespace std;

map<string_view, map<string_view, vector<int>>> facets3;
map<string_view, map<string_view, Roaring>> roar;
vector<string> keys_list;
Roaring ids;

std::string itemsjs::hello(){
  return "hello";
}

std::string itemsjs::json(){

  return "json";
}

std::string itemsjs::json_at(string json_path, int i) {

  simdjson::dom::parser parser;
  simdjson::dom::element items;

  items = parser.load(json_path);

  dom::element first = items.at(i);
  //std::cout << first << std::endl;
  string sv = simdjson::minify(first);
  return sv;
}

std::string itemsjs::index(string json_path, string json_string) {

  auto env = lmdb::env::create();
  env.set_mapsize(10UL * 1024UL * 1024UL * 1024UL); /* 10 GiB */
  env.set_max_dbs(3);
  env.open("./example.mdb", 0, 0664);

  //string filename = "/home/mateusz/node/items-benchmark/datasets/shoprank_full.json";

  simdjson::dom::parser parser;
  simdjson::dom::element items;


  auto start = std::chrono::high_resolution_clock::now();

  if (!json_path.empty()) {
    items = parser.load(json_path);
  } else {
    items = parser.parse(json_string);
  }

  auto elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "parse time: " << elapsed.count() / 1000000<< std::endl;


  auto wtxn = lmdb::txn::begin(env);
  auto dbi = lmdb::dbi::open(wtxn, nullptr);

  start = std::chrono::high_resolution_clock::now();

  int i = 1;
  for (dom::element item : items) {

    string ok = "";

    string sv = simdjson::minify(item);
    string name = to_string(i) + "";
    //dbi.del(wtxn, name);
    dbi.put(wtxn, name.c_str(), sv.c_str());

    ids.add(i);
    ++i;
  }

  /**
   * write ids to db
   */
  int expectedsize = ids.getSizeInBytes();
  char *serializedbytes = new char [expectedsize];
  ids.write(serializedbytes);
  std::string_view nowy(serializedbytes, expectedsize);
  dbi.put(wtxn, "ids", nowy);

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "items put time: " << elapsed.count() / 1000000<< std::endl;

  start = std::chrono::high_resolution_clock::now();
  wtxn.commit();

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "items put commit time: " << elapsed.count() / 1000000<< std::endl;

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

      else if (key == "category" and value.type() == dom::element_type::STRING) {

        string_view filter (value);
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

      int expectedsize = roar_object.getSizeInBytes();


      //cout << "key: " << key <<  " filter: " << filter << endl;
      //cout << name << endl;

      // ensure to free memory somewhere
      char *serializedbytes = new char [expectedsize];
      roar_object.write(serializedbytes);
      std::string_view nowy(serializedbytes, expectedsize);
      dbi.put(wtxn, name, nowy);

      keys_list.push_back(name);

      //dbi.put(wtxn, name.c_str(), serializedbytes);
    }
  }

  string keys_list_joined = "";
  for (auto const& s : keys_list) {
    keys_list_joined += s;
    keys_list_joined += "|||";
  }
  //std::cout << keys_list_joined;

  dbi.put(wtxn, "keys_list", keys_list_joined);

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "facets put time: " << elapsed.count() / 1000000<< std::endl;

  start = std::chrono::high_resolution_clock::now();
  wtxn.commit();

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "facets commit time: " << elapsed.count() / 1000000<< std::endl;

  cout << "finished indexing" << endl;

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

Napi::String itemsjs::JsonAtWrapped(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  Napi::String returnValue;


  Napi::String json_path = info[0].As<Napi::String>();
  Napi::Number at = info[1].As<Napi::Number>();
  return Napi::String::New(env, itemsjs::json_at(json_path, at));

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
  exports.Set("json_at", Napi::Function::New(env, itemsjs::JsonAtWrapped));
  //exports.Set("add", Napi::Function::New(env, itemsjs::IndexWrapped));
  //exports.Set("update", Napi::Function::New(env, itemsjs::IndexWrapped));
  //exports.Set("delete", Napi::Function::New(env, itemsjs::IndexWrapped));
  //exports.Set("search", Napi::Function::New(env, itemsjs::IndexWrapped));
  //exports.Set("aggregation", Napi::Function::New(env, itemsjs::IndexWrapped));
  //exports.Set("reindex", Napi::Function::New(env, itemsjs::IndexWrapped));
  return exports;
}
