/**
 * @fileOverview Banki.ru parser.
 */

var request = require('request');
var cheerio = require('cheerio');
var debug = require('debug')('dollarbot:bankiru');

/** @constant */
var URL = 'http://www.banki.ru/products/currency/cash/usd/Tomsk/';

/**
 * A class for parsing Banki.ru web portal.
 *
 * @class
 */
var Bankiru = function () {
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
 * Removes special characters from a parsed string.
 *
 * @method     cleanString
 * @param      {string}  str     String to parse.
 * @return     {string}  Cleaned from special chars string.
 */
function cleanString(str) {
  if (!str) return str;
  return str.replace(/[\t\n]+/g, ' ').trim();
}

/**
 * Retrieves best USD exchange rate in a city.
 *
 * @method     getUsdExchangeRate
 * @param      {Function}  fn      Callback function: function (err, rate) {}.
 * @return     {Object}    USD exchange rate info: { buy: { rate, description },
 *                         sell: { rate, description } }.
 */
Bankiru.prototype.getUsdExchangeRate = function (fn) {
  var usd = {};
  debug('Requesting ' + URL + '...');

  request(URL, function (err, res, body) {
    if (err) {
      return fn(new Error('Error loading banki.ru page (' + URL + '): ' + err));
    } else if (200 !== res.statusCode) {
      return fn(new Error('Invalid status code: ' + res.statusCode));
    }

    debug('Response ' + res.statusCode);

    try {
      // loading page HTML
      $ = cheerio.load(body);

      // parsing data
      var buySelector = 'table.currency-table__table tr td:nth-child(3)';
      var buyRate = parseFloat(normalizeNumberString($(buySelector + ' .currency-table__rate__num').text()));
      var buyDesc = cleanString($(buySelector + ' .currency-table__rate__text').text());

      var sellSelector = 'table.currency-table__table tr td:nth-child(4)';
      var sellRate = parseFloat(normalizeNumberString($(sellSelector + ' .currency-table__rate__num').text()));
      var sellDesc = cleanString($(sellSelector + ' .currency-table__rate__text').text());

      usd = {
        buy: { rate: buyRate, description: buyDesc },
        sell: { rate: sellRate, description: sellDesc }
      };
    } catch (e) {
      return fn(e);
    }

    fn(null, usd);
  });
};

module.exports = Bankiru;