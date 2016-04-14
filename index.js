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
  var message = update.message.text;
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
      var msg = 'Купят за ' + usd.buy.rate + 'р. (' + usd.buy.description + ')' + 
        ', продадут за ' + usd.sell.rate + 'р. (' + usd.sell.description + ')';
      telegram.send(msg, update.message.from.id);
    });
  } else {
    this.send('Не понял.', update.message.from.id);
  }
})
.listen();
