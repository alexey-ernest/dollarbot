/**
 * @fileOverview Banki.ru parser.
 */

var request = require('request');
var cheerio = require('cheerio');
var debug = require('debug')('dollarbot:bankiru');
var async = require('async');

/** @constant */
var API_URL = 'http://www.banki.ru/api/';

/** @constant */
var RATES_URL = 'http://www.banki.ru/products/currency/best_rates_summary/bank/usd/';

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
 * Parses bank id from the bank details page.
 *
 * @method     getBankIdByUrl
 * @param      {string}    url     Bank details page url on banki.ru portal.
 * @param      {Function}  fn      Callback function.
 */
function getBankIdByUrl(url, fn) {
  debug('Loading bank details page ' + url + '...');

  request(url, function (err, res, body) {
    if (err) {
      return fn(new Error('Error loading bank details page (' + url + '): ' + err));
    }
    if (200 !== res.statusCode) {
      return fn(new Error('Invalid status code: ' + res.statusCode));
    }

    var bankId;
    try {
      // loading page HTML
      $ = cheerio.load(body);

      // parsing data
      var selector = 'h1.header-h0';
      bankId = $(selector).attr('data-bank-id');
    } catch (e) {
      return fn(e);
    }

    fn(null, bankId);
  });
}

/**
 * Retrieves best USD exchange rate in a city.
 *
 * @method     getUsdExchangeRate
 * @param      {string}    cityCode  Unique code of the city.
 * @param      {Function}  fn        Callback function: function (err, rate) {}.
 * @return     {Object}  USD exchange rate info: { buy: { rate, description },
 *                       sell: { rate, description } }.
 */
Bankiru.prototype.getUsdExchangeRate = function (cityCode, fn) {
  var usd = {};
  var url = RATES_URL + cityCode + '/';
  debug('Requesting ' + url + '...');

  var options = {
    url: url, 
    encoding: 'utf8',
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    }
  };
  request(options, function (err, res, body) {
    if (err) {
      return fn(new Error('Error loading banki.ru page (' + url + '): ' + err));
    }
    if (200 !== res.statusCode) {
      return fn(new Error('Invalid status code: ' + res.statusCode));
    }

    debug('Response ' + res.statusCode);

    var buyBankUrl, sellBankUrl;
    try {
      // loading page HTML
      $ = cheerio.load(body);

      // parsing data
      var buySelector = 'table.currency-table__table tbody tr td:nth-child(3)';
      var buyRate = parseFloat(normalizeNumberString($(buySelector + ' .currency-table__rate__num').text()));
      var buyDesc = cleanString($(buySelector + ' .currency-table__rate__text').text());
      buyBankUrl = 'http://www.banki.ru' + $(buySelector + ' .currency-table__link').attr('href');

      var sellSelector = 'table.currency-table__table tbody tr td:nth-child(4)';
      var sellRate = parseFloat(normalizeNumberString($(sellSelector + ' .currency-table__rate__num').text()));
      var sellDesc = cleanString($(sellSelector + ' .currency-table__rate__text').text());
      sellBankUrl = 'http://www.banki.ru' + $(sellSelector + ' .currency-table__link').attr('href');

      usd = {
        buy: { rate: buyRate, description: buyDesc },
        sell: { rate: sellRate, description: sellDesc }
      };
    } catch (e) {
      return fn(e);
    }

    // retrieving bank ids
    async.parallel([
      function(callback) {
        getBankIdByUrl(buyBankUrl, function (err, id) {
          if (err) return callback(err);
          callback(null, id);
        });
      },
      function(callback) {
        getBankIdByUrl(sellBankUrl, function (err, id) {
          if (err) return callback(err);
          callback(null, id);
        });
      }
    ], function(err, results) {
        if (err) return fn(err);

        usd.buy.bank_id = results[0];
        usd.sell.bank_id = results[1];
        fn(null, usd);
    });
  });
};

/**
 * Searches for bank branches in region.
 *
 * @method     findBranchesInRegion
 * @param      {string}    regionId  Region identificator.
 * @param      {string}    bankId    Bank identificator.
 * @param      {Function}  fn        Callback function: function (err, <array> of branches) {}
 */
Bankiru.prototype.findBranchesInRegion = function (regionId, bankId, fn) {
  debug('Searching branches of bank ' + bankId + ' in region ' + regionId + '...');

  var options = {
    url: API_URL,
    method: 'post',
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: {
      "jsonrpc": "2.0",
      "method": "bankGeo/getObjectsByFilter",
      "params": {
        "with_empty_coordinates": true,
        "limit": 100, 
        "type": ["office","branch","cash"],
        "bank_id": [bankId],
        "region_id": [regionId]
      },
      "id":"0"
    },
    json: true
  };

  request(options, function (err, res, json) {
    if (err) {
      return fn(new Error('Error loading banki.ru API (' + API_URL + '): ' + err));
    }
    if (200 !== res.statusCode) {
      return fn(new Error('Invalid status code: ' + res.statusCode));
    }

    debug('Response ' + res.statusCode);

    fn(null, json.result.data);
  });
};

/**
 * Retrieves detailed data for a list of bank objects.
 *
 * @method     getBankObjectsData
 * @param      {array}    ids     Array of bank object identificators.
 * @param      {Function}  fn      Callback function: function (err, <array> of objects) {}
 */
Bankiru.prototype.getBankObjectsData = function (ids, fn) {
  debug('Searching data for bank objects: ' + ids.join(',') + '...');

  var options = {
    url: API_URL,
    method: 'post',
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: {
      "jsonrpc": "2.0",
      "method": "bank/getBankObjectsData",
      "params": {
        "id_list": ids
      },
      "id":"0"
    },
    json: true
  };

  request(options, function (err, res, json) {
    if (err) {
      return fn(new Error('Error loading banki.ru API (' + API_URL + '): ' + err));
    }
    if (200 !== res.statusCode) {
      return fn(new Error('Invalid status code: ' + res.statusCode));
    }

    debug('Response ' + res.statusCode);

    fn(null, json.result.data);
  });
};

module.exports = Bankiru;