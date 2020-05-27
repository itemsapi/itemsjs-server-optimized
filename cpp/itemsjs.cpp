#include "itemsjs.h"
//#include <iostream>
#include "roaring.hh"
#include "roaring.c"
#include <chrono>
#include <string>
#include <sstream>
#include "simdjson.h"
#include <bits/stdc++.h>
#include "lmdb2++.h"
#include <boost/tokenizer.hpp>
#include <boost/algorithm/string.hpp>
#include "json.hpp"
//https://github.com/gabime/spdlog

//#include <experimental/filesystem>
//namespace fs = std::experimental::filesystem;

using namespace std;

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

  simdjson::dom::element first = items.at(i);
  //std::cout << first << std::endl;
  string sv = simdjson::minify(first);
  return sv;
}

/**
 * native version of faceted search
 * it's gonna be 2,3x faster and have low RAM consumption
 */
std::tuple<std::string, std::optional<Roaring>, std::optional<Roaring>> itemsjs::search_facets(nlohmann::json input, nlohmann::json filters_array, nlohmann::json config, std::optional<Roaring> query_ids) {

  cout << "start searching facets in native cpp" << endl;

  // @TODO make unordered
  std::map<string, std::map<string, Roaring>> filters_indexes;
  std::map<string, std::map<string, Roaring>> not_filters_indexes;
  std::map<string, Roaring> combination;
  nlohmann::json output;

  auto env = lmdb::env::create();
  env.set_mapsize(100UL * 1024UL * 1024UL * 1024UL);
  env.set_max_dbs(3);
  env.open("./example.mdb", 0, 0664);

  auto rtxn = lmdb::txn::begin(env, nullptr, MDB_RDONLY);
  auto dbi = lmdb::dbi::open(rtxn, "filters");

  auto cursor = lmdb::cursor::open(rtxn, dbi);

  std::string_view key, value;

  Roaring filter_indexes;

  // fetch filters indexes
  // TODO replace input with filters array
  for (auto& [field, filters] : input["filters"].items()) {
    for (auto& filter : filters) {

      std::string_view ids_bytes;

      std::string sv(field);
      std::string sv2(filter);
      string name = sv + "." + sv2;

      if (dbi.get(rtxn, name, ids_bytes)) {
        Roaring ids = Roaring::read(ids_bytes.data());
        cout << "filter indexes: " << sv << " " << sv2 << " " << ids.cardinality() << endl;
        filters_indexes[sv][sv2] = ids;
        //filter_indexes = ids;
      }
    }
  }


  for (auto& [field, filters] : input["not_filters"].items()) {
    for (auto& filter : filters) {

      std::string_view ids_bytes;

      std::string sv(field);
      std::string sv2(filter);
      string name = sv + "." + sv2;

      if (dbi.get(rtxn, name, ids_bytes)) {
        Roaring ids = Roaring::read(ids_bytes.data());
        not_filters_indexes[sv][sv2] = ids;
      }
    }
  }


  // @TODO get these data from argument
  nlohmann::json facets_fields = {"tags", "actors", "category"};

  for (auto& name: facets_fields) {

    string key(name);
    //cout << key << endl;

    for (auto& object: filters_array) {
      //cout << object.dump() << endl;
      string field(object["key"]);

      for (auto& filter_temp : object["values"]) {
        //std::cout << filter_temp << '\n';
        string filter(filter_temp);

        //cout << config[key]["conjunction"] << endl;

        if ((config[key]["conjunction"] == false && key != field) or config[key]["conjunction"] != false) {

          if (!combination.count(key)) {
            combination[key] = filters_indexes[field][filter];
          } else {
            if (config[field]["conjunction"] != false) {
              combination[key] = combination[key] & filters_indexes[field][filter];
            } else {
              combination[key] = combination[key] | filters_indexes[field][filter];
            }
          }
        }
      }
    }
  }

  // cross combination with query ids
  if (query_ids) {
    for (auto& name: facets_fields) {
      string key(name);
      if (!combination.count(key)) {
        combination[key] = query_ids.value();
      } else {
        combination[key] &= query_ids.value();
      }
    }
  }


  std::optional<Roaring> not_ids;
  Roaring temp_not_ids;
  bool checked = false;
  for (auto& [field, filters] : input["not_filters"].items()) {
    for (auto& filter : filters) {

      std::string sv(field);
      std::string sv2(filter);

      //cout << field << " " << filter << endl;
      //cout << "not filtes petla" << endl;
      temp_not_ids |= not_filters_indexes[sv][sv2];
      checked = true;
    }
  }

  //cout << "not ids" << endl;
  //cout << temp_not_ids.cardinality() << endl;

  if (checked) {
    not_ids = temp_not_ids;
  }


  // intersection in native cpp is 2.5 x faster than in js
  auto start = std::chrono::high_resolution_clock::now();

  while (cursor.get(key, value, MDB_NEXT)) {

    Roaring ids = Roaring::read(value.data());

    std::string_view key1 = key;
    std::string_view key2 = key;

    key1.remove_suffix(key1.size() - key1.find_first_of("."));
    key2.remove_prefix(std::min(key2.find_first_of("."), key2.size()) + 1);
    std::string sv(key1);
    std::string sv2(key2);

    // negative filters
    if (not_ids) {
      ids -= not_ids.value();
    }

    if (combination.count(sv)) {
      ids &= combination[sv];

      // for calculating ids later
      if (filters_indexes.count(sv) and filters_indexes[sv].count(sv2)) {
        //filters_indexes[sv][sv2] &= combination[sv];
        filters_indexes[sv][sv2] &= ids;
        //cout << "combination" << endl;
        //cout << input.dump() << endl;
        //// calculating ids
        //temp_ids |= ids;
        //checked = true;
      }
    }


    output[sv][sv2] = ids.cardinality();
  }


  auto elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "facets search time: " << elapsed.count() / 1000000<< std::endl;

  // probably not needed because it's auto destroyed after going out of scope
  cursor.close();
  rtxn.abort();
  env.close();

  std::optional<Roaring> ids;
  Roaring temp_ids;
  checked = false;
  for (auto& [field, filters] : input["filters"].items()) {
    for (auto& filter : filters) {

      std::string sv(field);
      std::string sv2(filter);

      cout << field << " " << filter << endl;

      temp_ids |= filters_indexes[sv][sv2];
      checked = true;
    }
  }

  if (checked) {
    ids = temp_ids;
  }


  return {output.dump(), ids, not_ids};
}

std::vector<int> lista;

std::string itemsjs::index(string json_path, string json_string, vector<string> &faceted_fields, bool append = true) {

  map<string_view, map<string_view, vector<int>>> facets3;
  map<string_view, map<string_view, Roaring>> roar;
  //map<string_view, Roaring> search_roar;

  // @TODO change to string_view for 2x performance on tokenizing search terms
  map<string, Roaring> search_roar;
  vector<string> keys_list;
  Roaring ids;
  int starting_id = 1;


  typedef boost::tokenizer<boost::char_separator<char>> tokenizer;

  //system( "rm -rf ./example.mdb/*" );

  //if (!fs::is_directory("example.mdb") || !fs::exists("example.mdb")) {
    //fs::create_directory("example.mdb");
  //}

  //fs::create_directory("aha");
  //fs::create_directory("./aha");
  //fs::create_directory("./example.mdb");

  auto env = lmdb::env::create();
  env.set_mapsize(100UL * 1024UL * 1024UL * 1024UL); /* 10 GiB */
  env.set_max_dbs(3);
  env.open("./example.mdb", 0, 0664);

  if (append) {
    // local scope
    // probably not needed in if though
    {
      auto rtxn2 = lmdb::txn::begin(env, nullptr, MDB_RDONLY);
      auto dbi2 = lmdb::dbi::open(rtxn2, nullptr);

      std::string_view last_ids;

      if (dbi2.get(rtxn2, "ids", last_ids)) {

        ids = Roaring::read(last_ids.data());
        //cout << "size of new roar..." << t4.getSizeInBytes() << endl;
        //cout << "minimum..." << t4.minimum() << endl;
        //cout << "minimum..." << t4.maximum() << endl;

        starting_id = ids.maximum() + 1;
      }
    }
  }

  cout << "starting id: " << starting_id << endl;




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

  int id = starting_id;
  for (simdjson::dom::element item : items) {

    string ok = "";

    string sv = simdjson::minify(item);
    string name = to_string(id) + "";
    //dbi.del(wtxn, name);
    dbi.put(wtxn, name.c_str(), sv.c_str());

    ids.add(id);
    ++id;
  }

  /**
   * write ids to db
   */
  int expectedsize = ids.getSizeInBytes();
  char *serializedbytes = new char [expectedsize];
  ids.write(serializedbytes);
  std::string_view nowy(serializedbytes, expectedsize);
  dbi.put(wtxn, "ids", nowy);
  delete serializedbytes;

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "items put time: " << elapsed.count() / 1000000<< std::endl;

  start = std::chrono::high_resolution_clock::now();
  wtxn.commit();

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "items put commit time: " << elapsed.count() / 1000000<< std::endl;

  //std::cout << "start indexing facets: " << std::endl;
  start = std::chrono::high_resolution_clock::now();

  id = starting_id;
  for (simdjson::dom::object item : items) {

    for (auto [key, value] : item) {

      /**
       * enumerate over faceted fields
       */
      for(auto field : faceted_fields) {

        if (key == field and value.type() == simdjson::dom::element_type::ARRAY) {

          for (auto filter : value) {

            facets3[key][filter].push_back(id);
            roar[key][filter].add(id);
          }
        }

        else if (key == field and value.type() == simdjson::dom::element_type::INT64) {

          string year(to_string(int64_t(value)));
          char *char_array = new char [year.length()];
          strcpy(char_array, year.c_str());
          string_view filter (char_array, year.length());

          facets3[key][filter].push_back(id);
          roar[key][filter].add(id);
          //delete char_array;
        }

        else if (key == field and value.type() == simdjson::dom::element_type::STRING) {

          string_view filter (value);
          facets3[key][filter].push_back(id);
          roar[key][filter].add(id);
        }
      }

    }

    ++id;
  }

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "roaring facets time: " << elapsed.count() / 1000000 << std::endl;


  wtxn = lmdb::txn::begin(env);
  dbi = lmdb::dbi::open(wtxn, nullptr);
  auto dbi2 = lmdb::dbi::open(wtxn, "filters", MDB_CREATE);

  start = std::chrono::high_resolution_clock::now();
  for (auto&& [key, value] : roar) {
    // use first and second
    //std::cout << key << '\n';
    for (auto&& [key2, roar_object] : value) {

      std::string sv(key);
      std::string sv2(key2);
      string name = sv + "." + sv2;

      if (append) {

        std::string_view filter_indexes;
        if (dbi.get(wtxn, name, filter_indexes)) {
          //roar_object = roar_object | Roaring::read(filter_indexes.data());
          roar_object |= Roaring::read(filter_indexes.data());
          roar_object.runOptimize();
        }
      }


      int expectedsize = roar_object.getSizeInBytes();

      // ensure to free memory somewhere
      char *serializedbytes = new char [expectedsize];
      roar_object.write(serializedbytes);
      std::string_view nowy(serializedbytes, expectedsize);
      dbi.put(wtxn, name, nowy);
      dbi2.put(wtxn, name, nowy);

      delete serializedbytes;

      // we should remove it and use cursors
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




  //std::cout << "start tokenizing full text: " << std::endl;
  start = std::chrono::high_resolution_clock::now();

  /**
   * full text indexing
   */
  id = starting_id;
  for (simdjson::dom::object item : items) {

    for (auto [key, value] : item) {


      if (value.type() == simdjson::dom::element_type::ARRAY) {

        for (auto filter : value) {

          //cout << filter.type() << endl;

          if (filter.type() == simdjson::dom::element_type::STRING) {

            string_view filter2 (filter);
            tokenizer tok{filter2};
            for (const auto &t : tok) {
              string_view token1 (t);
              string token2(token1);
              boost::algorithm::to_lower(token2);
              search_roar[token2].add(id);
            }
          }

          //facets3[key][filter].push_back(i);
          //roar[key][filter].add(i);
        }
      }

      else if (value.type() == simdjson::dom::element_type::STRING) {

        string_view filter (value);

        tokenizer tok{filter};
        for (const auto &t : tok) {
          string_view token1 (t);
          string token2(token1);
          boost::algorithm::to_lower(token2);

          //std::string_view largeStringView{large.c_str(), large.size()};
          //std::string_view token4 {token2.c_str(), token2.size()};

          //string_view token3 (token2);
          //cout << token4 << endl;
          search_roar[token2].add(id);
        }
      }
    }

    ++id;
  }

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "roaring full text time: " << elapsed.count() / 1000000 << std::endl;




  wtxn = lmdb::txn::begin(env);
  dbi = lmdb::dbi::open(wtxn, nullptr);

  start = std::chrono::high_resolution_clock::now();
  //i = 1;
  for (auto&& [key, roar_object] : search_roar) {

    std::string sv(key);

    if (sv.length() > 100) {
      continue;
    }

    string name = "term|||" + sv;

    if (append) {

      std::string_view filter_indexes;
      if (dbi.get(wtxn, name, filter_indexes)) {
        roar_object |= Roaring::read(filter_indexes.data());
        roar_object.runOptimize();
      }
    }


    //cout << key << endl;
    //cout << roar_object.cardinality() << endl;
    int expectedsize = roar_object.getSizeInBytes();

    // ensure to free memory somewhere
    char *serializedbytes = new char [expectedsize];
    roar_object.write(serializedbytes);
    std::string_view nowy(serializedbytes, expectedsize);

    //cout << name << endl;

    // ignore long key like
    //✯✯✯✯✯reviews
    //term|||✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱ᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇᴇ

    dbi.put(wtxn, name, nowy);
    delete serializedbytes;
  }

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "search terms put time: " << elapsed.count() / 1000000<< std::endl;

  start = std::chrono::high_resolution_clock::now();
  wtxn.commit();

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "search terms commit time: " << elapsed.count() / 1000000<< std::endl;

  cout << "finished indexing" << endl;


  // global variable
  lista.push_back(1);
  cout << "lista size: " << lista.size() << endl;

  env.close();

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

Napi::Object itemsjs::SearchFacetsWrapped(const Napi::CallbackInfo& info) {

  Napi::Env env = info.Env();
  Napi::String returnValue;

  Napi::Object json = env.Global().Get("JSON").As<Napi::Object>();
  Napi::Function stringify = json.Get("stringify").As<Napi::Function>();

  Napi::Object first = info[0].As<Napi::Object>();
  string input_string = stringify.Call(json, { first }).As<Napi::String>();
  nlohmann::json input = nlohmann::json::parse(input_string);

  Napi::Object second = info[1].As<Napi::Object>();
  string filters_array_string = stringify.Call(json, { second }).As<Napi::String>();
  nlohmann::json filters_array = nlohmann::json::parse(filters_array_string);

  Napi::Object third = info[2].As<Napi::Object>();
  string conf_string = stringify.Call(json, { third }).As<Napi::String>();
  nlohmann::json conf = nlohmann::json::parse(conf_string);

  // buffers
  // https://github.com/nodejs/node-addon-api/blob/master/doc/buffer.md
  // https://github.com/nodejs/node-addon-api/issues/405
  Napi::Value forth = info[3];

  std::optional<Roaring> query_ids;

  Napi::Object obj = Napi::Object::New(env);

  if (!forth.IsNull()) {
    Napi::Buffer<char> buffer = info[3].As<Napi::Buffer<char>>();
    query_ids = Roaring::read(buffer.Data());
  }

  //nlohmann::json result;
  auto [result, ids, not_ids] = itemsjs::search_facets(input, filters_array, conf, query_ids);
  obj.Set("facets", result);

  if (ids) {

    int expectedsize = ids.value().getSizeInBytes();
    char *serializedbytes = new char [expectedsize];
    ids.value().write(serializedbytes);
    std::string_view nowy(serializedbytes, expectedsize);

    // bit slowier than "new" because copy but at least no leak
    Napi::Buffer<char> buffer3 = Napi::Buffer<char>::Copy(env, nowy.data(), nowy.length());
    delete serializedbytes;
    obj.Set("ids", buffer3);
  }

  // this can be removed
  if (not_ids) {

    int expectedsize = not_ids.value().getSizeInBytes();
    char *serializedbytes = new char [expectedsize];
    not_ids.value().write(serializedbytes);
    std::string_view nowy(serializedbytes, expectedsize);

    // bit slowier than "new" because copy but at least no leak
    Napi::Buffer<char> buffer3 = Napi::Buffer<char>::Copy(env, nowy.data(), nowy.length());
    delete serializedbytes;
    obj.Set("not_ids", buffer3);
  }

  return obj;
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


  vector<string> faceted_fields_array;
  Napi::Value faceted_fields_value = first.Get("faceted_fields");

  if (faceted_fields_value.IsArray()) {
    Napi::Array faceted_fields = faceted_fields_value.As<Napi::Array>();

    for (unsigned int i = 0 ; i < faceted_fields.Length() ; ++i) {

      Napi::Value element = faceted_fields.Get(to_string(i));
      string v = element.ToString();

      faceted_fields_array.push_back(v);
    }
  }

  //cout << faceted_fields.IsArray() << endl;
  //cout << faceted_fields.Length() << endl;
  //cout << faceted_fields.Get("0").IsString() << endl;
  //cout << faceted_fields.Get("0").ToString() << endl;
  //cout << faceted_fields.Get("1").As<Napi::String>() << endl;

  bool append = true;
  Napi::Value append_value = first.Get("append");

  //Napi::Boolean append_value2 = append_value.As<Napi::Boolean>();
  //cout << "append " << append_value2 << endl;

  if (append_value.IsBoolean() and (bool) append_value.As<Napi::Boolean>() == false) {
    //Napi::Boolean append_value2 = append_value.As<Napi::Boolean>();
    append = false;
  }

  cout << "append " << append << endl;


  if (first.Has("json_object")) {

    Napi::Value json_object = first.Get("json_object");

    Napi::Object json = env.Global().Get("JSON").As<Napi::Object>();
    Napi::Function stringify = json.Get("stringify").As<Napi::Function>();
    string json_string =  stringify.Call(json, { json_object }).As<Napi::String>();

    returnValue = Napi::String::New(env, itemsjs::index("", json_string, faceted_fields_array, append));

  } else if (first.Has("json_path")) {

    Napi::Value json_path = first.Get("json_path");
    string json_path_string(json_path.ToString());

    returnValue = Napi::String::New(env, itemsjs::index(json_path_string, "", faceted_fields_array, append));

  } else if (first.Has("json_string")) {

    Napi::Value json_string = first.Get("json_string");
    string json_string_string(json_string.ToString());

    returnValue = Napi::String::New(env, itemsjs::index("", json_string_string, faceted_fields_array, append));
  }



  return returnValue;
}

Napi::Object itemsjs::Init(Napi::Env env, Napi::Object exports) {
  exports.Set("hello", Napi::Function::New(env, itemsjs::HelloWrapped));
  exports.Set("index", Napi::Function::New(env, itemsjs::IndexWrapped));
  exports.Set("search_facets", Napi::Function::New(env, itemsjs::SearchFacetsWrapped));
  //exports.Set("query_parser", Napi::Function::New(env, itemsjs::IndexWrapped));
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
