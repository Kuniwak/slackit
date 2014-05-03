var EventEmitter = require('events').EventEmitter;
var assert = require('assert');
var http = require('http');
var https = require('https');
var inherits = require('util').inherits;
var url = require('url');

var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var pem = require('pem');
var Promise = require('node-promise').Promise;



/**
 * A class for Statbots.
 * The `options` should have 4 properties and optional 3 properties are
 * available.
 *
 * Necessary:
 *  - `options.teamname`: Name of the your team (equals the sub domain of your
 *    slack page)
 *  - `options.botname`: Name of the bot.
 *  - `options.incomingHookToken`: Token for incoming WebHooks.
 *  - `options.outgoingHookToken`: Token for outgoing WebHooks.
 *
 * Optional:
 *  - `options.channel` (default `#general`): Default channel to send a message
 *     by the bot.
 *  - `options.outgoingHookURI` (default `/outgoing-hook`): Default path to
 *     receive new messages from the Slack server.
 *  - `options.http` (default `false`): Use HTTP (not recommended) if true.
 *
 * @constructor
 * @param {Object.<string, string|number|boolean>} options Options.
 */
var Statbot = function(options) {
  this.assertOptions_(options);

  this.teamname = options.teamname;
  this.botname = options.botname;
  this.channel = options.channel || Statbot.DEFAULT_CHANNEL;
  this.incomingHookToken = options.incomingHookToken;
  this.outgoingHookToken = options.outgoingHookToken;
  this.outgoingHookURI = options.outgoingHookURI ||
      Statbot.DEFAULT_OUTGOING_HOOK_PATH;

  /**
   * Whether outgoing WebHooks over SSL is enabled.
   * @type {boolean}
   * @private
   * */
  this.enableSSL_ = !options.http;
};
inherits(Statbot, EventEmitter);


/**
 * Default path where outgoing WebHooks listener.
 * @type {string}
 */
Statbot.DEFAULT_OUTGOING_HOOK_PATH = '/outgoing-hook';


/**
 * Default channel to send a message.
 * @type {string}
 */
Statbot.DEFAULT_CHANNEL = '#general';


/**
 * Common event types.
 * @enum {string}
 */
Statbot.EventType = {
  /** Event will be fired when received a new message. */
  MESSAGE: 'statbotmessage',
  /** Event will be fired when received a invalid message. */
  INVALID_MESSAGE: 'invalidstatbotmessage',
};


/**
 * Asserts the options for the Statbot.
 * @param {*} options Options to test.
 * @private
 */
Statbot.prototype.assertOptions_ = function(options) {
  assert(options || typeof options !== 'object',
         'Invalid options: ' + options);

  assert.equal(typeof options.teamname, 'string',
               'Invalid teamname: ' + options.teamname);
  assert.equal(typeof options.botname, 'string',
               'Invalid botname: ' + options.botname);

  if (options.incomingHookToken) {
    assert.equal(typeof options.incomingHookToken, 'string',
                 'Invalid incoming WebHooks token: ' + options.incomingHookToken);
  }

  if (options.outgoingHookToken) {
    assert.equal(typeof options.outgoingHookToken, 'string',
                 'Invalid outgoing WebHooks token: ' + options.outgoingHookToken);
  }

  if (options.outgoingHookURI) {
    assert.equal(typeof options.outgoingHookURI, 'string',
                 'Invalid outgoing WebHooks URI: ' + options.outgoingHookURI);
  }

  if (options.channel) {
    assert.equal(typeof options.channel, 'string',
                 'Invalid channel: ' + options.channel);
  }
};


/**
 * Returns an URI for incoming WebHooks.
 * You should add an incoming WebHooks on your Slack integration page.
 * @return {string} Incoming hook URI.
 * @see https://{your team name}.slack.com/services/new/incoming-webhook
 */
Statbot.prototype.getIncomingHookURI = function() {
  var incomingHookURI = url.format({
    protocol: 'https',
    hostname: encodeURIComponent(this.teamname) + '.slack.com',
    pathname: 'services/hooks/incoming-webhook',
    query: { token: this.incomingHookToken },
  });
  return incomingHookURI;
};


/**
 * Say the given message by using official incoming WebHooks.
 * Say the message on #general if the channel property is omitted.
 * @param {StatbotMessage} obj Message text or object that
 *    should have a message as a `text` property. You can specify a channel as a
 *    `channel` property and, botname as a `botname`, icon as a `icon_emoji`.
 * @see https://{your team name}.slack.com/services/new/incoming-webhook
 */
Statbot.prototype.say = function(obj, callback) {
  var msg = typeof obj === 'string' ? { text: obj } : obj;
  if (!('channel' in msg)) {
    msg.channel = '#general';
  }
  this.assertMessage_(msg);

  request.post({
    url: this.getIncomingHookURI(),
    form: { payload: JSON.stringify(msg) },
  }, callback);
};


/**
 * Asserts a message object.
 * @param {*} msg Message to test.
 * @private
 */
Statbot.prototype.assertMessage_ = function(msg) {
  assert.equal(typeof msg, 'object');
  assert.equal(typeof msg.text, 'string');
};


/**
 * Returns a server instance that listen outgoing WebHooks from the Slack
 * server.
 * This server mechanism should be initialized and configured before it is
 * returned.
 * @return {Promise.<{ listen: function(number) }>} Web server instance.
 * @protected
 */
Statbot.prototype.getServerMechanism = function() {
  var statbot = this;

  if (!statbot.promisedServerGetter_) {
    var expressServer = express();
    expressServer.use(bodyParser());

    var outgoingHookPath = url.parse(this.outgoingHookURI).pathname;
    expressServer.post(outgoingHookPath, function(req, res) {
      statbot.handleOutgoingHook(req.body);
    });

    statbot.promisedServerGetter_ = new Promise();
    pem.createCertificate({ selfSigned: true, days: 365 }, function(err, data) {
      if (err) {
        statbot.promisedServerGetter_.reject(err);
        return;
      }
      var options = {
        key: data.serviceKey,
        cert: data.certificate,
      };

      statbot.promisedServerGetter_.resolve(statbot.enableSSL_ ?
          https.createServer(options, expressServer) :
          http.createServer(expressServer));
    });
  }

  return statbot.promisedServerGetter_;
};


/**
 * Handles outgoing WebHooks.
 * @param {Object.<string, string>} expected Expected outgoing WebHook
 *    request. It should have 8 fields (`token`, `team_id`, `channel_id`,
 *    `channel_name`, `timestamp`, `user_id`, `user_name`, `text`).
 * @protected
 */
Statbot.prototype.handleOutgoingHook = function(message) {
  var eventType = message.token === this.outgoingHookToken ?
               Statbot.EventType.MESSAGE :
               Statbot.EventType.INVALID_MESSAGE;

  this.emit(eventType, message);
};


/**
 * Listen on the specified port.
 * @param {number} port The port to listen.
 * @param {function} callback Callback wil be invoked when the statbot started
 *    listening.
 */
Statbot.prototype.listen = function(port, callback) {
  this.getServerMechanism().then(
    function(server) {
      server.listen(port, callback);
    },
    function(err) {
      throw err;
    });
};


/**
 * Close the statbot.
 * @param {function} callback Callback wil be invoked when the statbot was
 *    closed.
 */
Statbot.prototype.close = function(callback) {
  this.getServerMechanism().then(
    function(server) {
      server.close(callback);
    },
    function(err) {
      throw err;
    });
};


module.exports = Statbot;
