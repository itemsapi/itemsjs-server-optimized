/*
 * Author: Mateusz Rzepa
 * Copyright: 2015-2020, ItemsAPI
 */
#include "itemsjs.h"
#include "roaring.hh"
#include "roaring.c"
#include <chrono>
#include <string>
//#include <sstream>
#include "simdjson.h"
#include <bits/stdc++.h>
#include "lmdb2++.h"
#include <boost/tokenizer.hpp>
#include <boost/algorithm/string.hpp>
#include <boost/bimap.hpp>
#include <boost/bimap/multiset_of.hpp>
#include "json.hpp"
#include <thread>
#include <mutex>

#include "napi-thread-safe-callback.hpp"

//https://github.com/gabime/spdlog

using namespace std;

const char *DELIMITERS = "!\"#$%&'()*+,-./:;<=>?@\[\\]^_`{|}~\n\v\f\r ";
unsigned int WRITER_FLAGS = MDB_NOSYNC | MDB_WRITEMAP | MDB_MAPASYNC | MDB_NOMETASYNC | MDB_NORDAHEAD;
//unsigned int WRITER_FLAGS = 0;

// mutex is used so MDB_NOTLS not needed
unsigned int READER_FLAGS = MDB_NOTLS;
//unsigned int READER_FLAGS = 0;


std::mutex super_mutex;

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
  string sv = simdjson::minify(first);
  return sv;
}

/**
 * native version of faceted search
 */
std::tuple<std::string, std::optional<Roaring>, std::optional<Roaring>> itemsjs::search_facets(nlohmann::json input, nlohmann::json filters_array, nlohmann::json config, nlohmann::json facets_fields, std::optional<Roaring> query_ids) {

  // @TODO make unordered
  std::map<string, std::map<string, Roaring>> filters_indexes;
  std::map<string, std::map<string, Roaring>> not_filters_indexes;
  std::map<string, Roaring> combination;
  std::set<string> filters_fields_set = facets_fields;
  nlohmann::json output;

  auto env = lmdb::env::create();
  env.set_mapsize(100UL * 1024UL * 1024UL * 1024UL);
  env.set_max_dbs(20);
  env.open("./db.mdb", READER_FLAGS, 0664);

  auto rtxn = lmdb::txn::begin(env, nullptr, MDB_RDONLY);
  auto dbi = lmdb::dbi::open(rtxn, "filters");

  auto cursor = lmdb::cursor::open(rtxn, dbi);

  std::string_view key, value;

  Roaring filter_indexes;

  auto start = std::chrono::high_resolution_clock::now();
  auto elapsed = std::chrono::high_resolution_clock::now() - start;


  start = std::chrono::high_resolution_clock::now();

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
        //cout << "filter indexes: " << sv << " " << sv2 << " " << ids.cardinality() << endl;
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

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "load filters indexes time: " << elapsed.count() / 1000000<< std::endl;

  start = std::chrono::high_resolution_clock::now();

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

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "combination time: " << elapsed.count() / 1000000<< std::endl;

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
      temp_not_ids |= not_filters_indexes[sv][sv2];
      checked = true;
    }
  }

  if (checked) {
    not_ids = temp_not_ids;
  }

  // intersection in native cpp is 2.5 x faster than in js
  start = std::chrono::high_resolution_clock::now();
  int i = 0;

  while (cursor.get(key, value, MDB_NEXT)) {

    std::string_view key1 = key;
    std::string_view key2 = key;

    key1.remove_suffix(key1.size() - key1.find_first_of("."));
    key2.remove_prefix(std::min(key2.find_first_of("."), key2.size()) + 1);
    std::string sv(key1);
    std::string sv2(key2);

    if (!filters_fields_set.count(sv)) {
      continue;
    }

    Roaring ids = Roaring::read(value.data());

    // negative filters
    if (not_ids) {
      ids -= not_ids.value();
    }

    if (combination.count(sv)) {

      // @TODO
      // use and_cardinality
      ids &= combination[sv];

      // for calculating ids later
      if (filters_indexes.count(sv) and filters_indexes[sv].count(sv2)) {
        //filters_indexes[sv][sv2] &= combination[sv];
        filters_indexes[sv][sv2] &= ids;
      }
    }


    output[sv][sv2] = ids.cardinality();
    ++i;
  }

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "cursor facets search time: " << elapsed.count() / 1000000<< std::endl;
  std::cout << "facets crossed times: " << i << std::endl;

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


      temp_ids |= filters_indexes[sv][sv2];
      checked = true;
    }
  }

  if (checked) {
    ids = temp_ids;
  }

  return {output.dump(), ids, not_ids};
}

// @TODO
// better to extend lmdb class
bool db_put_roaring(auto &db, MDB_txn* const txn, const std::string_view key, Roaring &ids, const unsigned int flags = 0) {

  int expectedsize = ids.getSizeInBytes();
  char *serializedbytes = new char [expectedsize];
  ids.write(serializedbytes);
  std::string_view nowy(serializedbytes, expectedsize);

  bool result = db.put(txn, key, nowy);
  delete serializedbytes;
  return result;
}

std::tuple<std::set<string>, std::set<string>> tokenize_item(simdjson::dom::object &item) {

  typedef boost::tokenizer<boost::char_separator<char>> tokenizer;
  boost::char_separator<char> sep(DELIMITERS);

  std::set<string> filters;
  std::set<string> terms;

  for (auto [key, value] : item) {

    string name;
    string field(key);

    if (value.type() == simdjson::dom::element_type::ARRAY) {
      for (auto&& filter : value) {
        filters.emplace(field + "." + std::string(filter));

        string text = std::string(filter);
        tokenizer tok{text, sep};
        string last;

        for (const auto &t : tok) {

          string token2(t);
          boost::algorithm::to_lower(token2);

          terms.emplace(std::string(token2));

          if (!last.empty()) {
            string double_token = last + "_" + token2;
            terms.emplace(double_token);
          }

          last = token2;
        }
      }
    }

    else if (value.type() == simdjson::dom::element_type::INT64) {
      filters.emplace(field + "." + std::string(to_string(int64_t(value))));
    }

    else if (value.type() == simdjson::dom::element_type::STRING) {
      filters.emplace(field + "." + std::string(value));

      string text = std::string(value);
      tokenizer tok{text, sep};
      string last;

      for (const auto &t : tok) {

        string token2(t);
        boost::algorithm::to_lower(token2);

        terms.emplace(token2);

        if (!last.empty()) {
          string double_token = last + "_" + token2;
          terms.emplace(double_token);
        }

        last = token2;
      }
    }
  }

  return {filters, terms};
}

void itemsjs::delete_item(int id) {

  const std::lock_guard<std::mutex> lock(super_mutex);

  auto env = lmdb::env::create();
  env.set_mapsize(100UL * 1024UL * 1024UL * 1024UL); /* 10 GiB */
  env.set_max_dbs(20);

  env.open("./db.mdb", WRITER_FLAGS, 0664);
  //env.set_flags();

  auto wtxn = lmdb::txn::begin(env);
  auto dbi = lmdb::dbi::open(wtxn, nullptr);
  auto dbi_pkeys = lmdb::dbi::open(wtxn, "pkeys", MDB_CREATE);
  auto dbi_filters = lmdb::dbi::open(wtxn, "filters", MDB_CREATE);
  auto dbi_terms = lmdb::dbi::open(wtxn, "terms", MDB_CREATE);
  auto dbi_items = lmdb::dbi::open(wtxn, "items", MDB_CREATE);

  simdjson::dom::parser parser;
  //std::set<string> filters;
  //std::set<string> terms;

  std::string_view val;

  string string_id = to_string(int64_t(id));

  // counting filters and terms
  // get item
  if (dbi_items.get(wtxn, string_id, val)) {

    string json_string(val);

    simdjson::dom::element item;
    item = parser.parse(json_string);
    simdjson::dom::object item2;
    item2 = item;

    auto [filters, terms] = tokenize_item(item2);

    // deleting or decreasing filters index
    for (auto&& filter : filters) {

      Roaring ids;
      std::string_view val;
      if (dbi_filters.get(wtxn, filter, val)) {
        ids = Roaring::read(val.data());
        ids.remove(id);

        if (ids.cardinality()) {
          db_put_roaring(dbi_filters, wtxn, filter, ids);
        } else {
          dbi_filters.del(wtxn, filter);
        }

      }
    }

    // deleting or decreasing terms index
    for (auto&& filter : terms) {

      Roaring ids;
      std::string_view val;

      if (dbi_terms.get(wtxn, filter, val)) {
        ids = Roaring::read(val.data());
        ids.remove(id);

        if (ids.cardinality()) {
          db_put_roaring(dbi_terms, wtxn, filter, ids);
        } else {
          dbi_terms.del(wtxn, filter);
        }
      }
    }
  }

  // deleting "id" from "ids"
  std::string_view last_ids;
  Roaring ids;
  if (dbi.get(wtxn, "ids", last_ids)) {
    ids = Roaring::read(last_ids.data());
    ids.remove(id);
    db_put_roaring(dbi, wtxn, "ids", ids);
  }

  // deleting internal id referencing to user pkey
  dbi_pkeys.del(wtxn, string_id.c_str());

  // deleting data
  dbi_items.del(wtxn, string_id.c_str());

  wtxn.commit();
}


std::vector<int> lista;
map<string, map<string, double>> sorting;
//typedef boost::bimap<boost::bimaps::set_of<int>, boost::bimaps::multiset_of<double>> results_bimap;
typedef boost::bimap<int, boost::bimaps::multiset_of<double>> results_bimap;
typedef results_bimap::value_type position;

map<string, results_bimap> sorting2;



void itemsjs::load_sort_index(std::vector<std::string> &sorting_fields) {

  sorting2.clear();

  auto env = lmdb::env::create();
  env.set_mapsize(100UL * 1024UL * 1024UL * 1024UL);
  env.set_max_dbs(20);
  env.open("./db.mdb", 0, 0664);

  auto rtxn = lmdb::txn::begin(env, nullptr, MDB_RDONLY);

  std::map<string, lmdb::dbi> sorting_dbs;

  for(const auto & field : sorting_fields) {
    string name = "sorting_" + field;

    //sorting_dbs[field] = lmdb::dbi::open(rtxn, name.c_str(), MDB_CREATE);

    //terminate called after throwing an instance of 'lmdb::not_found_error'
    //what():  mdb_dbi_open: MDB_NOTFOUND: No matching key/data pair found

    try {
      //int result = lmdb::dbi::open(rtxn, name.c_str());
      //sorting_dbs[field] = lmdb::dbi::open(rtxn, name.c_str(), MDB_CREATE);
      sorting_dbs[field] = lmdb::dbi::open(rtxn, name.c_str());
      auto cursor = lmdb::cursor::open(rtxn, sorting_dbs[field]);
      std::string_view key, value;

      while (cursor.get(key, value, MDB_NEXT)) {
        double val = std::stod ((string)value);
        int id = std::stoi ((string)(key));

        // only add
        sorting2[field].insert(position(id, (double) val));
        //sorting2[field].left[id] = val;
      }
    }
    catch (lmdb::not_found_error) {
    }
    catch (...) {
      //std::cerr << "Unknown exception caught\n";
    }
  }
}


std::vector<int> itemsjs::sort_index(const Roaring &ids, std::string field, std::string order, int offset, int limit) {

  std::vector<int> sorted_ids;
  std::set<int> found_ids;

  // lambda allows for bidirectional iteration
  auto loop = [&ids, &sorted_ids, &found_ids, &field, &offset, &limit](auto begin, auto end)
  {
    int i = 0;
    int j = 0;
    for (auto it = begin; it != end; ++it) {

      if (ids.contains(it->second)) {

        if (j >= offset) {
          sorted_ids.push_back(it->second);
          //found_ids.emplace(it->second);
          ++i;
        }

        ++j;

        if (i >= limit) {
          break;
        }
      }
    }


    // @TODO
    // add missing ids with NULL values to the end
    /*if (ids.cardinality() > sorted_ids.size() and i < limit and j < (int) ids.cardinality()) {

      //cout << field << " " << ids.cardinality() << " " << sorted_ids.size() << " " << i << " " << j << " " << limit << " there is a place to add more ids" << endl;

      int i = 0;
      //int j = 0;
      for(const auto & id : ids) {

        //cout << id << endl;

        if (!found_ids.count(id)) {

          //if (j >= offset) {
            sorted_ids.push_back(id);
            ++i;
          //}

          //++j;

          if (i >= limit) {
            break;
          }
        }
      }
    }*/
  };

  if (order == "asc") {
    loop(sorting2[field].right.begin(), sorting2[field].right.end());
  } else if (order == "desc") {
    loop(sorting2[field].right.rbegin(), sorting2[field].right.rend());
  }

  return sorted_ids;
}

/**
 * it is used for making concurrency test with threading
 * one open lmdb writer globally is possible
 */
std::string concurrency_test() {

  // thanks to that we are sure there is only one lmdb writer
  const std::lock_guard<std::mutex> lock(super_mutex);

  auto env = lmdb::env::create();
  env.set_mapsize(100UL * 1024UL * 1024UL * 1024UL);
  env.set_max_dbs(1000);
  env.open("./db.mdb", WRITER_FLAGS, 0664);

  auto wtxn = lmdb::txn::begin(env);
  auto dbi = lmdb::dbi::open(wtxn, "concurrency_test", MDB_CREATE);

  Roaring ids;

  for (int i = 1 ; i < 10000 ; ++i ) {
    ids.add(i);
  }

  db_put_roaring(dbi, wtxn, "ids", ids);

  cout << "put data" << endl;
  wtxn.commit();

  env.close();

  return "result cncn";
}


std::string itemsjs::index(const string& json_path, const string& json_string, const vector<string> faceted_fields, const std::vector<std::string> sorting_fields, bool append = true) {

  const std::lock_guard<std::mutex> lock(super_mutex);

  auto start_all = std::chrono::high_resolution_clock::now();

  map<string_view, map<string_view, Roaring>> roar;
  //map<string_view, Roaring> search_roar;

  // @TODO change to string_view for 2x performance on tokenizing search terms
  map<string, Roaring> search_roar;
  //vector<string> keys_list;
  Roaring ids;
  int starting_id = 1;

  auto env = lmdb::env::create();
  env.set_mapsize(100UL * 1024UL * 1024UL * 1024UL); /* 10 GiB */
  env.set_max_dbs(20);
  env.open("./db.mdb", WRITER_FLAGS, 0664);

  if (append) {
    // local scope
    // probably not needed in if though
    {
      auto rtxn2 = lmdb::txn::begin(env, nullptr, MDB_RDONLY);
      auto dbi2 = lmdb::dbi::open(rtxn2, nullptr);

      std::string_view last_ids;

      if (dbi2.get(rtxn2, "ids", last_ids)) {

        ids = Roaring::read(last_ids.data());
        starting_id = ids.maximum() + 1;
      }
    }
  }

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
  auto dbi_pkeys = lmdb::dbi::open(wtxn, "pkeys", MDB_CREATE);
  auto dbi_items = lmdb::dbi::open(wtxn, "items", MDB_CREATE);

  //lmdb::dbi sorting_items = lmdb::dbi::open(wtxn, "sorting", MDB_CREATE);

  start = std::chrono::high_resolution_clock::now();

  std::map<string, lmdb::dbi> sorting_dbs;

  for(const auto & field : sorting_fields) {
    string name = "sorting_" + field;

    sorting_dbs[field] = lmdb::dbi::open(wtxn, name.c_str(), MDB_CREATE);
  }

  /**
   * write items to db
   */
  int id = starting_id;
  for (simdjson::dom::element item : items) {

    string sv = simdjson::minify(item);
    string string_id = to_string(id) + "";
    //dbi.put(wtxn, string_id.c_str(), sv.c_str());
    dbi_items.put(wtxn, string_id.c_str(), sv.c_str());

    simdjson::error_code error;
    uint64_t value;
    item.at_key("id").get<uint64_t>().tie(value, error);

    if (!error) {
      string pkey(to_string(value));
      dbi_pkeys.put(wtxn, pkey.c_str(), string_id.c_str());
    }

    for(const auto & field : sorting_fields) {

      simdjson::error_code error;
      double value;
      item.at_key(field).get<double>().tie(value, error);

      if (!error) {
        string val(to_string(value));
        sorting_dbs[field].put(wtxn, string_id.c_str(), val.c_str());

        // this is insert or update sort index value
        sorting2[field].left.erase(id);
        sorting2[field].insert(position(id, value));
        // does not work with right map
        //sorting2[field].left[id] = value;
      }
    }


    ids.add(id);
    ++id;
  }


  /**
   * write ids to db
   */
  db_put_roaring(dbi, wtxn, "ids", ids);

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "items put time: " << elapsed.count() / 1000000<< std::endl;

  start = std::chrono::high_resolution_clock::now();
  wtxn.commit();

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "items put commit time: " << elapsed.count() / 1000000<< std::endl;

  //std::cout << "start indexing facets: " << std::endl;
  start = std::chrono::high_resolution_clock::now();

  /**
   * tokenize items to facets indexes
   */
  id = starting_id;
  for (simdjson::dom::object item : items) {

    for (auto [key, value] : item) {

      /**
       * enumerate over faceted fields
       */
      for(auto field : faceted_fields) {

        if (key == field and value.type() == simdjson::dom::element_type::ARRAY) {

          for (auto filter : value) {

            roar[key][filter].add(id);
          }
        }

        // there is small memory leak
        else if (key == field and value.type() == simdjson::dom::element_type::INT64) {

          string year(to_string(int64_t(value)));
          char *char_array = new char [year.length()];
          strcpy(char_array, year.c_str());
          string_view filter (char_array, year.length());

          roar[key][filter].add(id);
          //delete char_array;
        }

        else if (key == field and value.type() == simdjson::dom::element_type::STRING) {

          string_view filter (value);
          roar[key][filter].add(id);
        }
      }
    }

    ++id;
  }

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "roaring facets time: " << elapsed.count() / 1000000 << std::endl;


  wtxn = lmdb::txn::begin(env);
  auto dbi_filters = lmdb::dbi::open(wtxn, "filters", MDB_CREATE);

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
        if (dbi_filters.get(wtxn, name, filter_indexes)) {
          //roar_object = roar_object | Roaring::read(filter_indexes.data());
          roar_object |= Roaring::read(filter_indexes.data());
          roar_object.runOptimize();
        }
      }

      db_put_roaring(dbi_filters, wtxn, name, roar_object);
    }
  }

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

    auto [filters, terms] = tokenize_item(item);

    (void) filters;

    for (auto&& term : terms) {
      search_roar[term].add(id);
    }

    ++id;
  }

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "roaring full text time: " << elapsed.count() / 1000000 << std::endl;

  wtxn = lmdb::txn::begin(env);
  auto dbi_terms = lmdb::dbi::open(wtxn, "terms", MDB_CREATE);

  start = std::chrono::high_resolution_clock::now();
  //i = 1;
  for (auto&& [key, roar_object] : search_roar) {

    std::string name(key);

    if (name.length() > 100) {
      continue;
    }

    if (append) {

      std::string_view filter_indexes;
      if (dbi_terms.get(wtxn, name, filter_indexes)) {
        roar_object |= Roaring::read(filter_indexes.data());
        roar_object.runOptimize();
      }
    }

    // ignore long key like
    //✯✯✯✯✯reviews
    //term|||✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱✱ᴇᴇᴇᴇᴇᴇ......
    db_put_roaring(dbi_terms, wtxn, name, roar_object);
  }

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "search terms put time: " << elapsed.count() / 1000000<< std::endl;

  start = std::chrono::high_resolution_clock::now();
  wtxn.commit();

  elapsed = std::chrono::high_resolution_clock::now() - start;
  std::cout << "search terms commit time: " << elapsed.count() / 1000000<< std::endl;


  // global variable
  lista.push_back(1);
  cout << "finished indexing, lista size: " << lista.size() << endl;

  env.close();

  auto elapsed_all = std::chrono::high_resolution_clock::now() - start_all;
  std::cout << "time index whole block: " << elapsed_all.count() / 1000000<< std::endl;

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

Napi::Array itemsjs::TokenizeWrapped(const Napi::CallbackInfo& info) {

  Napi::String query_input = info[0].As<Napi::String>();
  string query (query_input);

  typedef boost::tokenizer<boost::char_separator<char>> tokenizer;
  boost::char_separator<char> sep(DELIMITERS);

  tokenizer tok{query, sep};
  vector<string> tokens;

  for (const auto &t : tok) {
    string token2(t);
    boost::algorithm::to_lower(token2);
    tokens.emplace_back(token2);
  }

  Napi::Array output = Napi::Array::New(info.Env(), tokens.size());

  uint32_t i = 0;
  for (auto&& it : tokens) {
    output[i++] = Napi::String::New(info.Env(), it);
  }

  return output;
}

void itemsjs::DeleteItemWrapped(const Napi::CallbackInfo& info) {

  auto id = info[0].As<Napi::Number>().Uint32Value();
  itemsjs::delete_item(id);
}

void itemsjs::LoadSortIndexWrapped(const Napi::CallbackInfo& info) {

  Napi::Array first = info[0].As<Napi::Array>();

  vector<string> sorting_fields_array;

  if (first.IsArray()) {

    for (unsigned int i = 0 ; i < first.Length() ; ++i) {

      Napi::Value element = first.Get(to_string(i));
      string v = element.ToString();

      sorting_fields_array.push_back(v);
    }
  }

  itemsjs::load_sort_index(sorting_fields_array);
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

  Napi::Object forth = info[3].As<Napi::Object>();
  string facets_fields_string = stringify.Call(json, { forth }).As<Napi::String>();

  nlohmann::json facets_fields = nlohmann::json::parse(facets_fields_string);

  // buffers
  // https://github.com/nodejs/node-addon-api/blob/master/doc/buffer.md
  // https://github.com/nodejs/node-addon-api/issues/405
  Napi::Value fifth = info[4];

  std::optional<Roaring> query_ids;

  Napi::Object obj = Napi::Object::New(env);

  if (!fifth.IsNull()) {
    Napi::Buffer<char> buffer = info[4].As<Napi::Buffer<char>>();
    query_ids = Roaring::read(buffer.Data());
  }

  //nlohmann::json result;
  auto [result, ids, not_ids] = itemsjs::search_facets(input, filters_array, conf, facets_fields, query_ids);
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

Napi::String TestWrapped(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  return Napi::String::New(env, "test");
}

Napi::String itemsjs::JsonAtWrapped(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  Napi::String returnValue;


  Napi::String json_path = info[0].As<Napi::String>();
  Napi::Number at = info[1].As<Napi::Number>();
  return Napi::String::New(env, itemsjs::json_at(json_path, at));
}

Napi::TypedArrayOf<uint32_t> itemsjs::SortIndexWrapped(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  Napi::Buffer<char> buffer = info[0].As<Napi::Buffer<char>>();
  Roaring ids = Roaring::read(buffer.Data());

  Napi::String field = info[1].As<Napi::String>();
  Napi::String order = info[2].As<Napi::String>();
  auto offset = info[3].As<Napi::Number>().Uint32Value();
  auto limit = info[4].As<Napi::Number>().Uint32Value();

  std::vector<int> sorted_ids = sort_index(ids, field, order, offset, limit);

  Napi::TypedArrayOf<uint32_t> array2 = Napi::TypedArrayOf<uint32_t>::New(env, sorted_ids.size());

  for (size_t i=0; i < sorted_ids.size(); i++) {
    array2[i] = sorted_ids[i];
  }

  return array2;
}

Napi::String itemsjs::IndexWrapped(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  Napi::Object first = info[0].As<Napi::Object>();

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

  vector<string> sorting_fields_array;
  Napi::Value sorting_fields_value = first.Get("sorting_fields");

  if (sorting_fields_value.IsArray()) {
    Napi::Array sorting_fields = sorting_fields_value.As<Napi::Array>();

    for (unsigned int i = 0 ; i < sorting_fields.Length() ; ++i) {

      Napi::Value element = sorting_fields.Get(to_string(i));
      string v = element.ToString();

      sorting_fields_array.push_back(v);
    }
  }

  bool append = true;
  Napi::Value append_value = first.Get("append");

  if (append_value.IsBoolean() and (bool) append_value.As<Napi::Boolean>() == false) {
    append = false;
  }

  cout << "append " << append << endl;

  string json_string;
  string json_path;

  if (first.Has("json_object")) {

    Napi::Value json_object = first.Get("json_object");

    Napi::Object json = env.Global().Get("JSON").As<Napi::Object>();
    Napi::Function stringify = json.Get("stringify").As<Napi::Function>();
    json_string = stringify.Call(json, { json_object }).As<Napi::String>();

  } else if (first.Has("json_path")) {

    json_path = first.Get("json_path").ToString();

  } else if (first.Has("json_string")) {

    if (first.Get("json_string").IsBuffer()) {

      // @todo delete buffer
      // there is a memory leak
      Napi::Buffer<char> buffer = first.Get("json_string").As<Napi::Buffer<char>>();

      string_view asdf (buffer.Data(), buffer.Length());
      json_string = asdf;

    } else {
      // there is no memory leak
      json_string = first.Get("json_string").ToString();
    }
  }

  return Napi::String::New(env, itemsjs::index(json_path, json_string, faceted_fields_array, sorting_fields_array, append));
  //return returnValue;
}

// @TODO
// add mutex
void IndexWrappedCb(const Napi::CallbackInfo& info) {

  const std::lock_guard<std::mutex> lock(super_mutex);
  cout << "start index wrapped cb" << endl;

  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  auto callback = std::make_shared<ThreadSafeCallback>(info[1].As<Napi::Function>());
  bool fail = info.Length() > 2;

  Napi::Object first = info[0].As<Napi::Object>();

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

  vector<string> sorting_fields_array;
  Napi::Value sorting_fields_value = first.Get("sorting_fields");

  if (sorting_fields_value.IsArray()) {
    Napi::Array sorting_fields = sorting_fields_value.As<Napi::Array>();

    for (unsigned int i = 0 ; i < sorting_fields.Length() ; ++i) {

      Napi::Value element = sorting_fields.Get(to_string(i));
      string v = element.ToString();

      sorting_fields_array.push_back(v);
    }
  }

  bool append = true;
  Napi::Value append_value = first.Get("append");

  if (append_value.IsBoolean() and (bool) append_value.As<Napi::Boolean>() == false) {
    append = false;
  }

  cout << "append " << append << endl;

  string json_string;
  string json_path;

  if (first.Has("json_object")) {

    Napi::Value json_object = first.Get("json_object");

    Napi::Object json = env.Global().Get("JSON").As<Napi::Object>();
    Napi::Function stringify = json.Get("stringify").As<Napi::Function>();
    json_string = stringify.Call(json, { json_object }).As<Napi::String>();

  } else if (first.Has("json_path")) {

    json_path = first.Get("json_path").ToString();

  } else if (first.Has("json_string")) {

    if (first.Get("json_string").IsBuffer()) {

      // @todo delete buffer
      // there is a memory leak
      Napi::Buffer<char> buffer = first.Get("json_string").As<Napi::Buffer<char>>();

      string_view asdf (buffer.Data(), buffer.Length());
      json_string = asdf;

    } else {
      // there is no memory leak
      json_string = first.Get("json_string").ToString();
    }
  }

  // Pass callback to other thread
  //std::thread([callback, fail, json_path, json_string, faceted_fields_array, sorting_fields_array, append] {
  //std::thread([callback, fail, json_path, json_string, faceted_fields_array, sorting_fields_array, append] {
  std::thread([callback, fail, json_path, json_string, faceted_fields_array, sorting_fields_array, append] {
  //std::thread([callback, fail, json_path, json_string, faceted_fields_array, sorting_fields_array, append] {
  //std::thread([callback, fail, std::ref(json_path), std::ref(json_string), std::ref(faceted_fields_array), std::ref(sorting_fields_array), append] {
    try {
      if (fail) {
        throw std::runtime_error("Failure during async work");
      }

      vector<string> a;
      vector<string> b;

      //string result = itemsjs::index("", "[{\"a\":5},{\"a\":6}]", a, b, false);
      string result = itemsjs::index(json_path, json_string, faceted_fields_array, sorting_fields_array, append);
      //string result = "";

      // this is non blocking
      //cout << "go to sleep" << endl;
      //std::this_thread::sleep_for(3s);

      //concurrency_test();

      callback->call([result](Napi::Env env, std::vector<napi_value>& args) {

        args = { env.Undefined(), Napi::String::New(env, result) };
      });
    }
    catch (std::exception& e) {
      callback->callError(e.what());
    }
  }).detach();
}

/**
 * it's for testing async with threads purpose
 */
void ConcurrencyWrappedCb(const Napi::CallbackInfo& info) {
  auto callback = std::make_shared<ThreadSafeCallback>(info[1].As<Napi::Function>());
  std::thread([callback] {
    try {

      //cout << "slept goodslept goodslept goodslept goodslept goodslept goodslept goodslept good" << endl;

      callback->call([](Napi::Env env, std::vector<napi_value>& args) {
        //concurrency_test();
        cout << "ccallbackcallbackcallbackcallbackcallbackcallbackcallbackallback" << endl;
        args = { env.Undefined(), Napi::String::New(env, "result") };
      });
    }
    catch (std::exception& e) {
      callback->callError(e.what());
    }
  }).detach();
}

Napi::Object itemsjs::Init(Napi::Env env, Napi::Object exports) {

  exports.Set("hello", Napi::Function::New(env, itemsjs::HelloWrapped));
  exports.Set("delete_item", Napi::Function::New(env, itemsjs::DeleteItemWrapped));
  exports.Set("sort_index", Napi::Function::New(env, itemsjs::SortIndexWrapped));
  exports.Set("load_sort_index", Napi::Function::New(env, itemsjs::LoadSortIndexWrapped));
  exports.Set("index", Napi::Function::New(env, itemsjs::IndexWrapped));
  exports.Set("indexCb", Napi::Function::New(env, IndexWrappedCb));
  exports.Set("concurrencyCb", Napi::Function::New(env, ConcurrencyWrappedCb));
  exports.Set("search_facets", Napi::Function::New(env, itemsjs::SearchFacetsWrapped));
  exports.Set("json", Napi::Function::New(env, itemsjs::JsonWrapped));
  exports.Set("tokenize", Napi::Function::New(env, itemsjs::TokenizeWrapped));
  exports.Set("json_at", Napi::Function::New(env, itemsjs::JsonAtWrapped));
  return exports;
}
