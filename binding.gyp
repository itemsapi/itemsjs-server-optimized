{
  "targets": [{
    "target_name": "itemsjs_addon",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": ["-O3", "-fno-exceptions", "-std=gnu++0x", "-std=gnu++1y", "-g"],
      "cflags_cc+": ["-O3", "-std=c++17", "-g"],
      "sources": [
        "cpp/main.cpp",
        "cpp/itemsjs.cpp",
        "cpp/simdjson.cpp"
      ],
      'include_dirs': [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      'libraries': [
        "<!(node -p \"require('./src/binding').liblmdb()\")"
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
      'defines': [ 'NAPI_DISABLE_CPP_EXCEPTIONS' ],

      'conditions': [
        ['OS=="linux"', {
          'libraries': [
          ],
        }],
      ['OS=="win"', {
        'defines': [
        ],
      }]
      ]



  }]
}
