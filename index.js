// env
if (!process.env.TELEGRAM_API_TOKEN) {
  console.log("TELEGRAM_API_TOKEN environment variable required.");
  process.exit(1);
}

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
      // todo: get dollar exchange rate
      break;
    default:
      this.send('I\'m stupid.');
  }
})
.listen();
