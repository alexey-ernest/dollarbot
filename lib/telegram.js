/**
 * @fileOverview Telegram helper class to interact with Telegram Bot API.
 */

var request = require('request');
var debug = require('debug')('dollarbot:telegram');
var events = require('events');
var util = require('util');
var uuid = require('node-uuid');

/** @constant */
var API = 'https://api.telegram.org/bot';

var offset = 0; // last message id

/**
 * A class for interaction with Telegram Bot API.
 *
 * @class
 * @param      {string}  token    Telegram API token.
 * @param      {Object}  options  Additional options.
 */
var Telegram = function (token, options) {
  /**
   * Telegram API token.
   * @type {string}
   */
  this.token = token;
  if (!this.token) {
    throw new Error('API token required.');
  }

  options = options || {};

  /**
   * Admin identificator.
   * @type {string}
   */
  this.adminId = options.adminId;

  /**
   * Maximum number of messages to receive at once.
   * @type {number}
   */
  this.limitUpdates = options.limitUpdates || 5;

  /**
   * Polling interval in ms.
   * @type {number}
   */
  this.intervalMs = options.intervalMs || 1000;
};

/**
 * Telegram inherits EventEmitter's on()/emit() methods.
 */
util.inherits(Telegram, events.EventEmitter);

/**
 * Helper function to listen for incoming messages.
 *
 * @method     listen
 * @param      {string}    token     API token.
 * @param      {number}    limit     Maximum number of messages to receive.
 * @param      {number}    interval  Polling interval in ms.
 * @param      {Function}  fn        Callback function.
 */
function listen(token, limit, interval, fn) {
  debug('\n\nChecking updates for offset ' + offset + '...');

  var url = API + token + '/getUpdates' +
    '?offset=' + offset + 
    '&limit=' + limit +
    '&timeout=0';

  request({url: url, json: true}, function (err, res, json) {
    if (err) {
      fn(new Error('Error getting updates: ' + err));
    } else if (200 !== res.statusCode) {
      fn(new Error('Invalid status code: ' + res.statusCode));
    } else if (true !== json.ok) {
      fn(new Error('Expected ok: ' + JSON.stringify(json)));
    } else {
      fn(null, json.result);  
    }
    setTimeout(listen, interval, token, limit, interval, fn);
  });
}

/**
 * Listens for incoming messages and emits 'update' events.
 *
 * @method     listen
 */
Telegram.prototype.listen = function () {
  var telegram = this;

  listen(this.token, this.limitUpdates, this.intervalMs, function (err, updates) {
    if (err) return console.error(err); // always print internal errors
    if (!updates) return;

    // processing updates
    updates.forEach(function (u) {
      debug('Update: ' + offset + ', data: ' + JSON.stringify(u));

      offset = u.update_id + 1;
      
      var fromId;
      if (u.message) {
        // regular message
        fromId = u.message.from.id;
      } else if (u.inline_query) {
        // inline syntax
        fromId = u.inline_query.from.id;
      }

      if (this.adminId && (this.adminId !== fromId)) {
        debug('Unauthorized message: ' + message + ' from client: ' + fromId);
        return telegram.send('You\'re not authorized to use me!', fromId);
      }

      telegram.emit('update', u);
    });
  });
};

/**
 * Sends text message to chat.
 *
 * @method     send
 * @param      {string}    text      Text message to send.
 * @param      {string}    chatId    Chat identificator.
 * @param      {Function}  fn        Callback function: function (err) {}
 */
Telegram.prototype.send = function (text, chatId, fn) {
  fn = fn || function (err) {
    if (err) console.error(err);
  };

  chatId = chatId || this.adminId;
  if (!chatId) {
    fn(new Error('chatId required.'));
  }

  debug('Sending to ' + chatId + ' message: ' + text);

  var url = API + this.token + '/sendMessage';
  var options = {
    method: 'post',
    body: {text: text, chat_id: chatId},
    json: true,
    url: url
  };

  request(options, function (err, res, body) {
    if (err) return fn(err);
    if (200 !== res.statusCode) {
      return fn(new Error('Invalid status code: ' + res.statusCode + '. Response: ' + JSON.stringify(res)));
    }

    fn(null);
  });
};

/**
 * Sends an inline article message.
 *
 * @method     sendArticleInline
 * @param      {string}    title   Inline message title.
 * @param      {string}    text    Inline message text.
 * @param      {string}    chatId  Inline chat message identificator.
 * @param      {Function}  fn      Callback function: function (err) {}
 */
Telegram.prototype.sendArticleInline = function (title, text, chatId, fn) {
  fn = fn || function (err) {
    if (err) console.error(err);
  };

  chatId = chatId || this.adminId;
  if (!chatId) {
    fn(new Error('chatId required.'));
  }

  debug('Sending to ' + chatId + ' inline message: ' + text);

  var url = API + this.token + '/answerInlineQuery';
  var article = {
    type: 'article',
    id: uuid.v4(),
    title: title,
    input_message_content: {message_text: text}
  };
  var options = {
    method: 'post',
    body: {results: [article], inline_query_id: chatId},
    json: true,
    url: url
  };

  request(options, function (err, res, body) {
    if (err) return fn(err);
    if (200 !== res.statusCode) {
      return fn(new Error('Invalid status code: ' + res.statusCode + '. Response: ' + JSON.stringify(res)));
    }

    fn(null);
  });
};

module.exports = Telegram;
