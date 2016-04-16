/**
 * @fileOverview cbr.ru client.
 */

 var request = require('request');
 var cheerio = require('cheerio');
 var debug = require('debug')('dollarbot:cbr');

 /** @constant */
var DAILY_URL = 'http://www.cbr.ru/scripts/XML_daily.asp';

/**
 * A class for getting data from cbr.ru.
 *
 * @class
 */
var Cbr = function () {
};

/**
 * Replaces , with .
 *
 * @method     normalizeNumberString
 * @param      {string}  str     Number string to normalize.
 * @return     {string}  Normalized number string which can be parsed by parseFloat().
 */
function normalizeNumberString(str) {
  if (!str) return str;
  return str.replace(/,/g, '.');
}

/**
 * Retrieves current USD rate.
 *
 * @method     getUsdRate
 * @param      {Function}  fn        Callback function: function (err, rate) {}.
 * @return     {number}  Current USD rate.
 */
Cbr.prototype.getUsdRate = function (fn) {
  var url = DAILY_URL;
  debug('Retrieving Cbr USD rate ' + url + '...');

  request(url, function (err, res, body) {
    if (err) {
      return fn(new Error('Error loading cbr.ru service (' + url + '): ' + err));
    }
    if (200 !== res.statusCode) {
      return fn(new Error('Invalid status code: ' + res.statusCode));
    }

    debug('Response ' + res.statusCode);

    var rate;
    try {
      // loading XML
      $ = cheerio.load(body);

      // parsing data
      var usdSelector = 'Valute[ID=R01235] Value';
      rate = parseFloat(normalizeNumberString($(usdSelector).text()));

    } catch (e) {
      return fn(e);
    }

    fn(null, rate);
  });
};

module.exports = Cbr;