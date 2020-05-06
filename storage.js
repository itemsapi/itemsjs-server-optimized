const storage = require('./src/storage');
var keys_list = storage.getKeysList('keys_list');

console.log(JSON.stringify(keys_list));
