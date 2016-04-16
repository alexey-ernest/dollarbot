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

  if (command === 'start') {
    this.send('Введите город, чтобы узнать лучший курс. Например, Москва', update.message.from.id);
  } else if (city.exists(command)) {
    var cityCode = city.getCode(command);
    var telegram = this;

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
    ], function(err, results){
      if (err) return console.error(err);
      
      var usdExchange = results[0];
      var usdCbr = results[1];
      var city = command.charAt(0).toUpperCase() + command.slice(1);
      var msg = 'Курс ЦБ - ' + usdCbr + 'р за 1 доллар. ' + 
        'Дешевле всего вы можете купить доллар за ' + usdExchange.sell.rate + 'р (' + city + ', ' + usdExchange.sell.description + ')' + 
        ', дороже всего вы можете продать за ' + usdExchange.buy.rate + 'р (' + city + ', ' + usdExchange.buy.description + ')';

      telegram.send(msg, chatId, isInline);
    });
  } else {
    this.send('Укажите город...', chatId, isInline);
  }
})
.listen();
