var EventEmitter = require('events').EventEmitter;
var assert = require('assert');
var http = require('http');
var https = require('https');
var inherits = require('util').inherits;
var url = require('url');

var express = require('express');
var bodyParser = require('body-parser');
var pem = require('pem');
var Promise = require('node-promise').Promise;



/**
 * A class for ReceivingBots.
 * The `options` should have a property and optional 2 properties are
 * available.
 *
 * Necessary:
 *  - `options.outgoingHookToken`: Token for outgoing WebHooks.
 *
 * Optional:
 *  - `options.outgoingHookURI` (default `/outgoing-hook`): Default path to
 *     receive new messages from the Slack server.
 *  - `options.http` (default `false`): Use HTTP (not recommended) if true.
 *
 * @constructor
 * @param {Object.<string, string|number|boolean>} options Options.
 */
var ReceivingBot = function(options) {
  EventEmitter.call(this);
  this.assertOptions_(options);

  this.outgoingHookToken = options.outgoingHookToken;
  this.outgoingHookURI = options.outgoingHookURI ||
      ReceivingBot.DEFAULT_OUTGOING_HOOK_PATH;

  /**
   * Whether outgoing WebHooks over SSL is enabled.
   * @type {boolean}
   * @private
   * */
  this.enableSSL_ = !options.http;
};
inherits(ReceivingBot, EventEmitter);


/**
 * Default path where outgoing WebHooks listener.
 * @type {string}
 */
ReceivingBot.DEFAULT_OUTGOING_HOOK_PATH = '/outgoing-hook';


/**
 * Common event types.
 * @enum {string}
 */
ReceivingBot.EventType = {
  /** Event will be fired when received a new message. */
  MESSAGE: 'statbotmessage',
  /** Event will be fired when received a invalid message. */
  INVALID_MESSAGE: 'invalidstatbotmessage',
};


/**
 * Asserts the options for the ReceivingBot.
 * @param {*} options Options to test.
 * @private
 */
ReceivingBot.prototype.assertOptions_ = function(options) {
  assert(options || typeof options !== 'object',
         'Invalid options: ' + options);

  assert.equal(typeof options.outgoingHookToken, 'string',
               'Invalid outgoing WebHooks token: ' + options.outgoingHookToken);

  if (options.outgoingHookURI) {
    assert.equal(typeof options.outgoingHookURI, 'string',
                 'Invalid outgoing WebHooks URI: ' + options.outgoingHookURI);
  }
};


/**
 * Returns a server instance that listen outgoing WebHooks from the Slack
 * server.
 * This server mechanism should be initialized and configured before it is
 * returned.
 * @return {Promise.<{ listen: function(number) }>} Web server instance.
 * @protected
 */
ReceivingBot.prototype.getServerMechanism = function() {
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
ReceivingBot.prototype.handleOutgoingHook = function(message) {
  var eventType = message.token === this.outgoingHookToken ?
               ReceivingBot.EventType.MESSAGE :
               ReceivingBot.EventType.INVALID_MESSAGE;

  this.emit(eventType, message);
};


/**
 * Listen on the specified port.
 * @param {number} port The port to listen.
 * @param {function} callback Callback wil be invoked when the statbot started
 *    listening.
 */
ReceivingBot.prototype.listen = function(port, callback) {
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
ReceivingBot.prototype.close = function(callback) {
  this.getServerMechanism().then(
    function(server) {
      server.close(callback);
    },
    function(err) {
      throw err;
    });
};


module.exports = ReceivingBot;
