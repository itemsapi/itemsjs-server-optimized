const addon = require('bindings')('itemsjs_addon.node');

//ldconfig -p
// alpine
//ls /usr/lib/| grep libl
// ubuntu
// "/usr/lib/x86_64-linux-gnu/liblmdb.so"
// alpine
// "/usr/lib/liblmdb.so"
//docker build . -t itemsjs2 -f Dockerfile2
//docker run --privileged -it -p 3000:3000 itemsjs2 /bin/bash

console.log('addon: ', addon);
//console.log('hello: ', addon.hello());
//console.log('hello: ', addon.json("okok"));
//console.log('index: ', );


var result = addon.json_at('./tests/fixtures/movies.json', 3);
console.log(result);

addon.index({
  json_path: './tests/fixtures/movies.json'
})


