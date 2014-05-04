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
var winston = require('winston');



/**
 * A class for ReceptBots.
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
var ReceptBot = function(options) {
  EventEmitter.call(this);
  this.assertOptions_(options);

  this.outgoingHookToken = options.outgoingHookToken;
  this.outgoingHookURI = options.outgoingHookURI ||
      ReceptBot.DEFAULT_OUTGOING_HOOK_PATH;

  /**
   * Whether outgoing WebHooks over SSL is enabled.
   * @type {boolean}
   * @private
   * */
  this.enableSSL_ = !options.http;
};
inherits(ReceptBot, EventEmitter);


/**
 * Default path where outgoing WebHooks listener.
 * @type {string}
 */
ReceptBot.DEFAULT_OUTGOING_HOOK_PATH = '/outgoing-hook';


/**
 * Common event types.
 * @enum {string}
 */
ReceptBot.EventType = {
  /** Event will be fired when received a new message. */
  MESSAGE: 'statbotmessage',
  /** Event will be fired when received a invalid message. */
  INVALID_MESSAGE: 'invalidstatbotmessage',
};


/**
 * Asserts the options for the ReceptBot.
 * @param {*} options Options to test.
 * @private
 */
ReceptBot.prototype.assertOptions_ = function(options) {
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
ReceptBot.prototype.getServerMechanism = function() {
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
ReceptBot.prototype.handleOutgoingHook = function(message) {
  var eventType = message.token === this.outgoingHookToken ?
               ReceptBot.EventType.MESSAGE :
               ReceptBot.EventType.INVALID_MESSAGE;

  winston.log('debug', 'Received the message:', message);
  this.emit(eventType, message);
};


/**
 * Listen on the specified port.
 * @param {number} port The port to listen.
 * @param {function} callback Callback wil be invoked when the statbot started
 *    listening.
 */
ReceptBot.prototype.listen = function(port, callback) {
  this.getServerMechanism().then(
    function(server) {
      winston.log('info', 'Listening outgoing WebHooks on the port:', port);
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
ReceptBot.prototype.close = function(callback) {
  this.getServerMechanism().then(
    function(server) {
      winston.log('info', 'Closing outgoing WebHooks.');
      server.close(callback);
    },
    function(err) {
      throw err;
    });
};


module.exports = ReceptBot;
