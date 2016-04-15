// env
if (!process.env.TELEGRAM_API_TOKEN) {
  console.log("TELEGRAM_API_TOKEN environment variable required.");
  process.exit(1);
}

var Telegram = require('./lib/telegram');
var Bankiru = require('./lib/bankiru');
var banki = new Bankiru();
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

  if (message[0] == '/') {
    message = message.substring(1);
  }

  var params = message.split(/\s/);
  var command = params.shift().toLowerCase();

  if (command === 'start') {
    this.send('Введите город, чтобы узнать лучший курс. Например, Москва', update.message.from.id);
  } else if (city.exists(command)) {
    var cityCode = city.getCode(command);
    var telegram = this;
    banki.getUsdExchangeRate(cityCode, function (err, usd) {
      if (err) return console.error(err);
      var msg = 'Дешевле всего вы можете купить доллар за ' + usd.sell.rate + 'р (' + usd.sell.description + ')' + 
      ', дороже всего вы можете продать за ' + usd.buy.rate + 'р (' + usd.buy.description + ')';

      if (isInline) {
        msg = command.charAt(0).toUpperCase() + command.slice(1) + '. ' + msg;
      }
      telegram.send(msg, chatId, isInline);
    });
  } else {
    this.send('Укажите город...', chatId, isInline);
  }
})
.listen();
