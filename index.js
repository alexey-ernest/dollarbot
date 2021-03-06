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
var User = require('./lib/user.js');
var Micex = require('micex.api');

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
    },
    function(callback) {
      Micex.securityMarketdata('USD000UTSTOM')
        .then(function (security) {
          callback(null, security.node.last);
        }, function (err) {
          callback(err);
        });
    }
  ], function(err, results) {
    if (err) return fn(err);
    fn(null, {cbr: results[1], exchange: results[0], micex: results[2]});
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

  // trim slash
  if (message && message[0] == '/') {
    message = message.substring(1);
  }

  var command, params;
  if (message) {
    params = message.split(/\s/);
    command = params.shift().toLowerCase();
  }

  function capitalize(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function sendMessage(msg, fn) {
    if (isInline) {
      telegram.sendArticleInline(msg, msg, chatId, fn);
    } else {
      telegram.send(msg, chatId, fn);
    }
  }

  function appendBranchCalls(branch, i, calls) {
    var branchName = branch.name.replace(/(&[#\d\w]+;)/g, '');
    var branchAddress = branch.address.replace(/(\d{6,6},[^,]+, )/, ''); // remove zip code and city name
    var branchPhones = branch.phone.replace(/\(/g, '+7 (');

    calls.push(function (callback) {
      var message = '<b>' + (i + 1) + '. ' + branchName + '</b>\n';
      if (branchPhones) {
        message += 'т. ' + branchPhones  + '\n';
      } 
      message += branchAddress;
      
      telegram.send(message, chatId, {parse_mode: 'HTML'}, function (err) {
        if (err) return callback(err);
        callback(null);
      });
    });

    // send branch location
    calls.push(function (callback) {
      telegram.sendVenue(undefined, branchAddress, branch.latitude, branch.longitude, chatId, function (err) {
        if (err) return callback(err);
        callback(null);
      });
    });
  }

  function sendBranchMessages(branches, fn) {
    var apiCalls = [];
    var i;
    for (i = 0; i < branches.length; ++i) {
      // send branch description
      appendBranchCalls(branches[i], i, apiCalls);
    }

    // executing serially
    async.series(
      apiCalls,
      function (err, results) {
        if (err) return fn(err);
        fn(null);
      });
  }

  function handleError(err) {
    return console.error(err);
  }

  function showSellBuyKeyboard(cityName) {
    var keyboard = {
      keyboard: [[
        {text: 'Купить'}, {text: 'Продать'}
      ]],
      one_time_keyboard: true
    };

    return telegram.send('Купить или продать USD в г. ' + capitalize(cityName) + '?', chatId, {reply_markup: keyboard});
  }

  var telegram = this;

  // trying to get user settings from db
  var user = User.get(chatId, function (err, user) {
    if (err) return handleError(err);

    // paring user command
    if (command === 'start') {
      if (!user) {
        telegram.send('Введите город, чтобы узнать лучший курс. Например, Москва', chatId);
      } else {
        showSellBuyKeyboard(user.cityName);
      }
    } else if (user || city.exists(command)) {
      // parsing inputs
      var cityName, param;
      if (city.exists(command)) {
        cityName = command;

        // caching user settings
        if (!user) {
          user = new User({
            id: chatId,
            cityName: cityName
          });
        } else {
          // updating user city
          if (typeof user.save !== 'function') {
            // fix for old data
            delete user.save;
          }

          user.cityName = cityName;  
        }
        
        // saving in db
        user.save(function (err) {
          if (err) handleError(err);
        });

        param = params.length > 0 ? params.shift().toLowerCase() : null;
      } else if (user.cityName) {
        cityName = user.cityName;
        param = command;
      }

      var cityInfo = city.get(cityName);
      if (cityInfo && (param === 'купить' || param === 'продать')) {
        // sending status that we're searching
        telegram.sendChatAction(chatId, 'find_location');

        // get USD best rates
        getUsdRates(cityInfo.code, function (err, rates) {
          if (err) return handleError(err);

          // build sell or buy message
          var bankId, msg = 'Курс ЦБ - ' + rates.cbr + 'р (' + rates.micex +' на Московской Бирже) за 1 доллар. ';
          if (param === 'купить') {
            bankId = rates.exchange.sell.bank_id;
            msg += 'Дешевле всего вы можете купить доллар в ' + rates.exchange.sell.description + ' (г. ' + capitalize(cityName) + ') за ' + rates.exchange.sell.rate + 'р';
          } else {
            bankId = rates.exchange.buy.bank_id;
            msg += 'Дороже всего вы можете продать доллар в ' + rates.exchange.buy.description + ' (г. ' + capitalize(cityName) + ') за ' + rates.exchange.buy.rate + 'р';
          }
          
          // sending best rates message
          sendMessage(msg);

          // sending status that we're searching for branches
          telegram.sendChatAction(chatId, 'find_location');
          setTimeout(function () {
            sendMessage('Ищем офисы в вашем городе...');
          }, 1000);

          // getting list of bank branches
          banki.findBranchesInRegion(cityInfo.id, bankId, function (err, branches) {
            if (err) return handleError(err);
            var ids = [];
            branches.forEach(function (b) {
              ids.push(b.id);
            });

            // getting additional info for branches
            banki.getBankObjectsData(ids, function (err, data) {
              // sending branches
              setTimeout(function (branches, telegram) {
                sendBranchMessages(branches, function (err) {
                  if (err) return handleError(err);
                });
              }, 5000, data, telegram);
            });
          });
        });
      } else {
        // ask for action: sell/buy
        return showSellBuyKeyboard(cityName);
      }
    } else {
      // city is not specified
      sendMessage('Укажите город...');
    }
  });
})
.listen();
