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
 * @param      {string}    text          Text message to send.
 * @param      {string}    chat_id       Chat identificator.
 * @param      {Object}    options       Optional. Additional options.
 * @param      {Function}  fn            Optional. Callback function: function (err) {}
 */
Telegram.prototype.send = function (text, chat_id, options, fn) {
  if (typeof options === 'function') {
    fn = options;
    options = null;
  }

  options = options || {};


  fn = fn || function (err) {
    if (err) console.error(err);
  };

  chat_id = chat_id || this.adminId;
  if (!chat_id) {
    return fn(new Error('chat_id required.'));
  }

  debug('Sending to ' + chat_id + ' message: ' + text);

  var url = API + this.token + '/sendMessage';
  var params = {
    method: 'post',
    body: {text: text, chat_id: chat_id, reply_markup: options.reply_markup, parse_mode: options.parse_mode},
    json: true,
    url: url
  };

  request(params, function (err, res, body) {
    if (err) return fn(err);
    if (200 !== res.statusCode) {
      return fn(new Error('Invalid status code: ' + res.statusCode + '. Response: ' + JSON.stringify(res)));
    }

    fn(null);
  });
};

/**
 * Sends location to the chat.
 *
 * @method     sendLocation
 * @param      {Number}    latitude      Coordinates.
 * @param      {Number}    longitude     Coordinates.
 * @param      {string}    chat_id       Chat identificator.
 * @param      {Function}  fn            Optional. Callback function: function (err) {}
 */
Telegram.prototype.sendLocation = function (latitude, longitude, chat_id, fn) {
  fn = fn || function (err) {
    if (err) console.error(err);
  };

  chat_id = chat_id || this.adminId;
  if (!chat_id) {
    return fn(new Error('chat_id required.'));
  }

  debug('Sending location to ' + chat_id);

  var url = API + this.token + '/sendLocation';
  var options = {
    method: 'post',
    body: {latitude: latitude, longitude: longitude, chat_id: chat_id},
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
 * Sends venue to the chat.
 *
 * @method     sendVenue
 * @param      {string}    title      Name of the venue.
 * @param      {string}    address    Address of the venue.
 * @param      {Number}    latitude   Coordinates.
 * @param      {Number}    longitude  Coordinates.
 * @param      {string}    chat_id    Chat identificator.
 * @param      {Function}  fn         Optional. Callback function: function
 *                                    (err) {}
 */
Telegram.prototype.sendVenue = function (title, address, latitude, longitude, chat_id, fn) {
  fn = fn || function (err) {
    if (err) console.error(err);
  };

  chat_id = chat_id || this.adminId;
  if (!chat_id) {
    return fn(new Error('chat_id required.'));
  }

  debug('Sending location to ' + chat_id);

  var url = API + this.token + '/sendVenue';
  var options = {
    method: 'post',
    body: {title: title, address: address, latitude: latitude, longitude: longitude, chat_id: chat_id},
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
 * @param      {string}    query_id  Inline chat query identificator.
 * @param      {Function}  fn      Callback function: function (err) {}
 */
Telegram.prototype.sendArticleInline = function (title, text, query_id, fn) {
  fn = fn || function (err) {
    if (err) console.error(err);
  };

  query_id = query_id || this.adminId;
  if (!query_id) {
    return fn(new Error('query_id required.'));
  }

  debug('Sending to ' + query_id + ' inline message: ' + text);

  var url = API + this.token + '/answerInlineQuery';
  var article = {
    type: 'article',
    id: uuid.v4(),
    title: title,
    input_message_content: {message_text: text}
  };
  var options = {
    method: 'post',
    body: {results: [article], inline_query_id: query_id},
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
 * Sends information about what is happening.
 *
 * @method     sendChatAction
 * @param      {string}    chat_id  Chat identificator.
 * @param      {typing|upload_photo|record_video|upload_video|record_audio|upload_audio|upload_document|find_location}    action   Currently executing action.
 * @param      {Function}  fn       Callback function.
 */
Telegram.prototype.sendChatAction = function (chat_id, action, fn) {
  fn = fn || function (err) {
    if (err) console.error(err);
  };

  chat_id = chat_id || this.adminId;
  if (!chat_id) {
    return fn(new Error('chat_id required.'));
  }

  var actions = [
    'typing', 
    'upload_photo', 
    'record_video', 
    'upload_video', 
    'record_audio', 
    'upload_audio', 
    'upload_document', 
    'find_location'
  ];
  if (actions.indexOf(action) === -1) {
    return fn(new Error('Allowed actions: ' + actions.join(', ')));
  }

  debug('Sending to ' + chat_id + ' chat action: ' + action);

  var url = API + this.token + '/sendChatAction';
  var options = {
    method: 'post',
    body: {chat_id: chat_id, action: action},
    url: url,
    json: true
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
