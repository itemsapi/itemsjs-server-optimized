#include <napi.h>
#include <string>

namespace itemsjs {

  std::string hello();
  //std::string index(std::string filename);
  std::string index(std::string filename);
  Napi::String HelloWrapped(const Napi::CallbackInfo& info);
  Napi::String IndexWrapped(const Napi::CallbackInfo& info);

  Napi::Object Init(Napi::Env env, Napi::Object exports);

}
