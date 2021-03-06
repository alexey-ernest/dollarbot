/**
 * @fileOverview Provides handy methods for working with cities.
 */

var request = require('request');
var debug = require('debug')('dollarbot:city');

/**
 * List of cities and their codes.
 *
 * @type       {Object}
 */
var cities = {};

/** @constant */
var URL = 'http://www.banki.ru/bitrix/components/banks/universal.select.region/ajax.php?bankid=&baseUrl=%2Fproducts%2Fcurrency%2F&appendUrl=&urlPattern=%2Fproducts%2Fcurrency%2Fcash%2Fusd%2F%25region_name%25%2F&type=city';

/**
 * Inits the list of cities.
 */
(function (url) {
  debug('Loading city list from ' + url);
  request({url: url, json: true}, function (err, res, json) {
    if (err) return console.error('Could not init city list: ' + err);
    if (200 !== res.statusCode) {
      return console.error('Invalid status code: ' + res.statusCode);
    }

    var i;
    for (i = 0; i < json.data.length; ++i) {
      var c = json.data[i];
      cities[c.region_name.toLowerCase()] = { code: c.region_code, id: c.region_id };
    }
  });
})(URL);

exports.exists = function (city) {
  return cities[city] !== undefined;
};

exports.get = function (city) {
  return cities[city];
};