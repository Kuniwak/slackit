var EventEmitter = require('events').EventEmitter;
var assert = require('assert');
var http = require('http');
var https = require('https');
var inherits = require('util').inherits;
var url = require('url');

var express = require('express');
var bodyParser = require('body-parser');
var pem = require('pem');
var promisedIO = require('promised-io/promise');
var promisedFs = require('promised-io/fs');
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
  this.enableSSL_ = Boolean(options.https) || !options.http;

  /**
   * Certificate.
   * @type {{ key: string, cert: string }}
   * @private
   */
  this.certificate_ = options.https ? {
    key: options.https.key,
    cert: options.https.cert,
  } : null;
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
  if (!this.promisedServer_) {
    var server = express();
    server.use(bodyParser());

    var outgoingHookPath = url.parse(this.outgoingHookURI).pathname;
    var statbot = this;
    server.post(outgoingHookPath, function(req, res) {
      statbot.handleOutgoingHook(req.body);
    });

    this.promisedServer_ = this.enableSSL_ ?
        this.getHTTPSServer_(server) :
        this.getHTTPServer_(server);
  }

  return this.promisedServer_;
};


/**
 * Returns a promised HTTPS server.
 * @param {Express} server HTTP server.
 * @return {PromiseLike.<ServerLike>} Promised HTTPS server.
 * @private
 */
ReceptBot.prototype.getHTTPSServer_ = function(server) {
  var promisedOpts = this.certificate_ ?
      this.getCertificate_() :
      this.getSelfSignedCertificate_();

  return promisedOpts.then(function(opts) {
    return https.createServer(opts, server);
  });
};


/**
 * Returns a promised HTTP server.
 * @param {Express} server HTTP server.
 * @return {PromiseLike.<ServerLike>} Promised HTTP server.
 * @private
 */
ReceptBot.prototype.getHTTPServer_ = function(server) {
  var promise = new promisedIO.Promise();
  process.nextTick(function() {
    promise.resolve(http.createServer(server));
  });
  return promise;
};


/**
 * Returns a promised specified certificate.
 * @return {PromiseLike.<{ key: string, cert: string }>} Promised certifiate.
 * @private
 */
ReceptBot.prototype.getCertificate_ = function() {
  var promisedFiles = [this.certificate_.key, this.certificate_.cert].map(function(path) {
    return promisedFs.readFile(path);
  });

  return promisedIO.all(promisedFiles).then(function(results) {
    return {
      key: results[0],
      cert: results[1],
    };
  });
};


/**
 * Returns a promised self-signed certifiate.
 * @return {PromiseLike.<{ key: string, cert: string }>} Promised certifiate.
 * @private
 */
ReceptBot.prototype.getSelfSignedCertificate_ = function() {
  var promisedOpts = new promisedIO.Promise();
  pem.createCertificate({ selfSigned: true, days: 365 }, function(err, data) {
    if (err) {
      promise.reject(err);
      return;
    }

    promisedOpts.resolve({
      key: data.serviceKey,
      cert: data.certificate,
    });
  });
  return promisedOpts;
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
