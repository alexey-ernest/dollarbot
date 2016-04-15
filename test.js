var Bankiru = require('./lib/bankiru');

var b = new Bankiru();
b.getUsdExchangeRate('Tomsk', function (err, usd) {
  if (err) return console.error(err);
  console.log(usd);
});