/*
 * Author: Mateusz Rzepa
 * Copyright: 2015-2020, ItemsAPI
 */
#include <napi.h>
#include <string>
#include "json.hpp"
#include "roaring.hh"

namespace itemsjs {

  std::string index(const char *&index_path, std::string json_path, const std::string& json_string, std::vector<std::string> &faceted_fields, std::vector<std::string> &sorting_fields, bool append);
  std::tuple<std::string, std::optional<Roaring>, std::optional<Roaring>> search_facets(const char *&index_path, nlohmann::json input, nlohmann::json filters_array, nlohmann::json conf, nlohmann::json facets_fields, std::optional<Roaring> query_ids, bool testing);
  std::vector<int> sort_index(const char *&index_path, const Roaring &ids, std::string field, std::string order, int offset, int limit);
  std::vector<int> sort_index_2(const char *&index_path, const Roaring &ids, std::string field, std::string order, int offset, int limit);
  void load_sort_index(const char *&index_path, std::vector<std::string> &sorting_fields);
  void set_configuration(const char *&index_path, const std::string& json);
  void SetConfigurationWrapped(const Napi::CallbackInfo& info);
  void delete_item(const char *&index_path, int id);
  void DeleteItemWrapped(const Napi::CallbackInfo& info);
  void LoadSortIndexWrapped(const Napi::CallbackInfo& info);
  Napi::TypedArrayOf<uint32_t> SortIndexWrapped(const Napi::CallbackInfo& info);
  // this is slowier but supports multi-threading
  Napi::TypedArrayOf<uint32_t> SortIndex2Wrapped(const Napi::CallbackInfo& info);
  Napi::String IndexWrapped(const Napi::CallbackInfo& info);
  Napi::Object SearchFacetsWrapped(const Napi::CallbackInfo& info);
  Napi::Array TokenizeWrapped(const Napi::CallbackInfo& info);

  Napi::Object Init(Napi::Env env, Napi::Object exports);

}
