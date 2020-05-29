/*
 * Author: Mateusz Rzepa
 * Copyright: 2015-2020, ItemsAPI
 */
#include <napi.h>
#include "itemsjs.h"

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  return itemsjs::Init(env, exports);
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, InitAll)
