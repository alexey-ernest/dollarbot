// env
if (!process.env.TELEGRAM_API_TOKEN) {
  console.log("TELEGRAM_API_TOKEN environment variable required.");
  process.exit(1);
}

var Bankiru = require('./lib/bankiru');
var banki = new Bankiru();

var Telegram = require('./lib/telegram');

var telegram = new Telegram(process.env.TELEGRAM_API_TOKEN)
.on('update', function (update) {
  var message = update.message.text;
  var params = message.split(/\s/);
  var command = params.shift().toLowerCase();

  switch (command) {
  	case 'ping': 
  		this.send('pong');
  		break;
    case 'dollar':
      banki.getUsdExchangeRate(function (err, usd) {
        if (err) return console.error(err);
        var msg = 'Buy for ' + usd.buy.rate + ' (' + usd.buy.description + ')' + 
          ', sell for ' + usd.sell.rate + ' (' + usd.sell.description + ')';
        this.send(msg);
      });
      break;
    default:
      this.send('I\'m stupid.');
  }
})
.listen();
