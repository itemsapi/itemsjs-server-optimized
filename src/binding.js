const fs = require('fs')

module.exports.liblmdb = function() {

  if (fs.existsSync('/usr/lib/x86_64-linux-gnu/liblmdb.so')) {
    return '/usr/lib/x86_64-linux-gnu/liblmdb.so';
  } else if (fs.existsSync('/usr/lib/liblmdb.so')) {
    return '/usr/lib/liblmdb.so';
  }

  return "missing_shared_object-liblmdb.so";
}
