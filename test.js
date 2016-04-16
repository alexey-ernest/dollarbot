var Banki = require('./lib/bankiru');

var b = new Banki();
b.getUsdExchangeRate('Tomsk', function (err, usd) {
  if (err) return console.error(err);
  console.log(usd);
});