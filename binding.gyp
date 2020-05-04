{
  "targets": [{
    "target_name": "testaddon",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": ["-O3", "-fno-exceptions", "-std=gnu++0x", "-std=gnu++1y"],
      "cflags_cc+": ["-O3", "-std=c++17"],
      "sources": [
        "cppsrc/main.cpp",
        "cppsrc/Samples/functionexample.cpp",
        "cppsrc/Samples/simdjson.cpp"
      ],
      'include_dirs': [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      'libraries': [
        "/usr/lib/x86_64-linux-gnu/liblmdb.so"
      ],
      "xcode_settings": {
        "OTHER_CFLAGS": ["-std=c++17"],
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES"
      },
      "msvs_settings": {
        "VCCLCompilerTool": {
          "AdditionalOptions": ["/std:c++17"]
        }
      },
      'dependencies': [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      'defines': [ 'NAPI_DISABLE_CPP_EXCEPTIONS' ]
  }]
}
