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

  function sendMessage(msg) {
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

    var cityInfo = city.get(cityName);
    cityName = cityName.charAt(0).toUpperCase() + cityName.slice(1);
    if (param === 'купить' || param === 'продать') {
      // get USD best rates
      getUsdRates(cityInfo.code, function (err, rates) {
        if (err) return console.error(err);

        // build sell or buy message
        var bankId, msg = 'Курс ЦБ - ' + rates.cbr + 'р за 1 доллар. ';
        if (param === 'купить') {
          bankId = rates.exchange.sell.bank_id;
          msg += 'Дешевле всего вы можете купить доллар в ' + rates.exchange.sell.description + ' (г. ' + cityName + ') за ' + rates.exchange.sell.rate + 'р';
        } else {
          bankId = rates.exchange.buy.bank_id;
          msg += 'Дороже всего вы можете продать доллар в ' + rates.exchange.buy.description + ' (г. ' + cityName + ') за ' + rates.exchange.buy.rate + 'р';
        }
        
        sendMessage(msg);

        // getting list of bank branches
        banki.findBranchesInRegion(cityInfo.id, bankId, function (err, branches) {
          if (err) return console.error(err);
          var i;
          // sending locations to the branches
          for (i = 0; i < branches.length; ++i) {
            var b = branches[i];
            var branchName = b.name.replace(/(&[#\d\w]+;)/g, '');
            var branchAddress = b.address.replace(/(\d{6,6},[^,]+, )/, ''); // remove zip code and city name
            telegram.sendVenue(branchName, branchAddress, b.latitude, b.longitude, chatId);
          }
        });
      });
    } else {
      // ask for action: sell/buy
      var keyboard = {
        keyboard: [[
          {text: 'Купить'}, {text: 'Продать'}
        ]],
        one_time_keyboard: true
      };

      return this.send('Купить или продать USD?', chatId, keyboard);
    }
  } else {
    // city is not specified
    sendMessage('Укажите город...');
  }
})
.listen();
