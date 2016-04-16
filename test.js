var Cbr = require('./lib/cbr');

var c = new Cbr();
c.getUsdRate(function (err, rate) {
  if (err) return console.error(err);
  console.log(rate);
});