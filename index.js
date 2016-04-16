// env
if (!process.env.TELEGRAM_API_TOKEN) {
  console.log("TELEGRAM_API_TOKEN environment variable required.");
  process.exit(1);
}

var async = require('async');
var Telegram = require('./lib/telegram');
var Bankiru = require('./lib/bankiru');
var banki = new Bankiru();
var Cbr = require('./lib/cbr');
var cbr = new Cbr();
var city = require('./lib/city.js');

/**
 * ChatId:city cache.
 *
 * @type       {Object}
 */
var cityCache = {
};

/**
 * Gets the best buy and sell rates together with cb rate.
 *
 * @method     getSellRate
 * @param      {string}    cityCode  City code.
 * @param      {Function}  fn        Callback function
 */
function getUsdRates(cityCode, fn) {
  // requesting cbr USD rate and best exchange rates from banki.ru
  async.parallel([
    function(callback) {
      banki.getUsdExchangeRate(cityCode, function (err, usd) {
        if (err) return callback(err);
        callback(null, usd);
      });
    },
    function(callback) {
      cbr.getUsdRate(function (err, rate) {
        if (err) return callback(err);
        callback(null, rate);
      });
    }
  ], function(err, results) {
    if (err) return fn(err);
    fn(null, {cbr: results[1], exchange: results[0]});
  });
}

/**
 * Builds message with best sell rates in the city.
 *
 * @method     buildSellMessage
 * @param      {string}    cityName  The name of the city to find best rates.
 * @param      {Function}  fn        Callback function.
 */
function buildSellMessage(cityName, fn) {
  var cityCode = city.getCode(cityName);

  getUsdRates(cityCode, function (err, rates) {
    if (err) return fn(err);
    var city = cityName.charAt(0).toUpperCase() + cityName.slice(1);
    var msg = 'Курс ЦБ - ' + rates.cbr + 'р за 1 доллар. ' + 
      'Дороже всего вы можете продать за ' + rates.exchange.buy.rate + 'р (' + city + ', ' + rates.exchange.buy.description + ')';
    fn(null, msg);
  });
}

/**
 * Builds message with best buy rates in the city.
 *
 * @method     buildBuyMessage
 * @param      {string}    cityName  The name of the city to find best rates.
 * @param      {Function}  fn        Callback function.
 */
function buildBuyMessage(cityName, fn) {
  var cityCode = city.getCode(cityName);

  getUsdRates(cityCode, function (err, rates) {
    if (err) return fn(err);
    var city = cityName.charAt(0).toUpperCase() + cityName.slice(1);
    var msg = 'Курс ЦБ - ' + rates.cbr + 'р за 1 доллар. ' + 
      'Дешевле всего вы можете купить доллар за ' + rates.exchange.sell.rate + 'р (' + city + ', ' + rates.exchange.sell.description + ')';
    fn(null, msg);
  });
}

var telegram = new Telegram(process.env.TELEGRAM_API_TOKEN)
.on('update', function (update) {
  // parse message
  var message, chatId, isInline;
  if (update.message) {
    message = update.message.text;
    chatId = update.message.from.id;
  } else if (update.inline_query) {
    message = update.inline_query.query;
    chatId = update.inline_query.id;
    isInline = true;
  }

  if (message && message[0] == '/') {
    message = message.substring(1);
  }

  var command, params;
  if (message) {
    params = message.split(/\s/);
    command = params.shift().toLowerCase();
  }

  function sendMessage(err, msg) {
    if (err) return console.error(err);
    if (isInline) {
      telegram.sendArticleInline(msg, msg, chatId);
    } else {
      telegram.send(msg, chatId);
    }
  }

  var telegram = this;
  if (command === 'start') {
    this.send('Введите город, чтобы узнать лучший курс. Например, Москва', chatId);
  } else if (cityCache[chatId] || city.exists(command)) {
    var cityName, param;
    if (city.exists(command)) {
      cityName = cityCache[chatId] = command;
      param = params.length > 0 ? params.shift().toLowerCase() : null;
    } else if (cityCache[chatId]) {
      cityName = cityCache[chatId];
      param = command;
    }

    if (param === 'купить') {
      buildBuyMessage(cityName, function (err, msg) {
        sendMessage(err, msg);
      });
    } else if (param === 'продать') {
      buildSellMessage(cityName, function (err, msg) {
        sendMessage(err, msg);
      });
    } else {
      // ask for action: sell/buy
      var keyboard = {
        keyboard: [[
          {text: 'Купить USD'}, {text: 'Продать USD'}
        ]],
        one_time_keyboard: true
      };

      return this.send('Купить или продать?', chatId, keyboard);
    }
  } else {
    sendMessage(null, 'Укажите город...');
  }
})
.listen();
