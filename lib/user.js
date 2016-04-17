/**
 * @fileOverview User related functionality.
 */

 // env
if (!process.env.REDIS_ADDRESS) {
  console.log("REDIS_ADDRESS environment variable required.");
  process.exit(1);
}

var redis = require('redis');
var db = redis.createClient(parseInt(process.env.REDIS_PORT, 10) || 6379, process.env.REDIS_ADDRESS);

/**
 * A class for storing user settings.
 *
 * @class
 * @param      {Object}  obj     Object to clone properties from.
 */
function User(obj) {
  var key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      this[key] = obj[key];
    }
  }
}

/**
 * Saves user in persistent storage.
 *
 * @method     save
 * @param      {Function}  fn      Callback function.
 */
User.prototype.save = function (fn) {
  if (!this.id) return fn(new Error('id required.'));
  var data = {
    id: this.id,
    cityName: this.cityName
  };
  db.hmset('user:' + this.id, data, function (err) {
    fn(err);
  });
};

/**
 * Gets user info by id.
 *
 * @method     get
 * @param      {string}    id      User id.
 * @param      {Function}  fn      Callback function.
 */
User.get = function (id, fn) {
  db.hgetall('user:' + id, function (err, user) {
    if (err) return fn(err);
    if (!user) return fn();
    
    fn(null, new User(user));
  });
};

module.exports = User;