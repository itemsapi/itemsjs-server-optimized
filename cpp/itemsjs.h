#include <napi.h>
#include <string>
#include "json.hpp"
#include "roaring.hh"

namespace itemsjs {

  std::string hello();
  //std::string index(std::string filename);
  std::string index(std::string json_path, std::string json_string, std::vector<std::string> &faceted_fields, std::vector<std::string> &sorting_fields, bool append);
  std::vector<int> sort_index(Roaring ids, std::string field, std::string order, int offset, int limit);
  void load_sort_index(std::vector<std::string> &sorting_fields);
  std::tuple<std::string, std::optional<Roaring>, std::optional<Roaring>> search_facets(nlohmann::json input, nlohmann::json filters_array, nlohmann::json conf, nlohmann::json facets_fields, std::optional<Roaring> query_ids);
  void delete_item(int id);
  std::string json();
  std::string json_at(std::string json_path, int i);
  Napi::String HelloWrapped(const Napi::CallbackInfo& info);
  void DeleteItemWrapped(const Napi::CallbackInfo& info);
  void LoadSortIndexWrapped(const Napi::CallbackInfo& info);
  Napi::TypedArrayOf<uint32_t> SortIndexWrapped(const Napi::CallbackInfo& info);
  Napi::String IndexWrapped(const Napi::CallbackInfo& info);
  Napi::Object SearchFacetsWrapped(const Napi::CallbackInfo& info);
  Napi::String JsonAtWrapped(const Napi::CallbackInfo& info);
  Napi::String JsonWrapped(const Napi::CallbackInfo& info);

  Napi::Object Init(Napi::Env env, Napi::Object exports);

}
