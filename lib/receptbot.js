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
 * @implements {BotLike}
 * @param {Object.<string, string|number|boolean>} options Options.
 */
var ReceptBot = function(options) {
  EventEmitter.call(this);
  this.assertOptions_(options);

  this.outgoingHookToken = options.outgoingHookToken;
  this.outgoingHookURI = options.outgoingHookURI ||
      ReceptBot.DEFAULT_OUTGOING_HOOK_PATH;

  this.port = options.port;
  this.isStarted = false;

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
  MESSAGE: 'botmessage',
  /** Event will be fired when received a invalid message. */
  INVALID_MESSAGE: 'invalidbotmessage',
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

  assert.equal(typeof options.port, 'number',
               'Invalid port to listen outgoing WebHooks: ' + options.port);

  if (options.outgoingHookURI) {
    assert.equal(typeof options.outgoingHookURI, 'string',
                 'Invalid outgoing WebHooks URI: ' + options.outgoingHookURI);
  }

  if (options.https) {
    assert.equal(typeof options.https.key, 'string',
                'Invalid certificate key path: ' + options.https.key);
    assert.equal(typeof options.https.cert, 'string',
                'Invalid certificate path: ' + options.https.cert);
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
    var bot = this;
    server.post(outgoingHookPath, function(req, res) {
      bot.handleOutgoingHook(req.body);
      res.set("Connection", "close");
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
    winston.log('debug', 'Loading certificate: ' + path);
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
 * Listen outgoing WebHooks.
 * @param {function=} opt_callback Callback wil be invoked when the bot
 *    started listening.
 * @protected
 */
ReceptBot.prototype.listen = function(opt_callback) {
  var that = this;
  this.getServerMechanism().then(
    function(server) {
      protocol = that.enableSSL_ ? that.certificate_ ? 'HTTPS (with ' + that.certificate_.key + ', ' + that.certificate_.cert + ')' : 'HTTPS (with aut-generated self-signed certificate)' : 'HTTP';
      winston.log('info', 'Listening outgoing WebHooks: port=%s, path=%s, protocol=%s',
                  that.port,
                  that.outgoingHookURI,
                  protocol);

      if (opt_callback) {
        server.listen(that.port, opt_callback);
      }
      else {
        server.listen(that.port);
      }
    },
    function(err) {
      throw err;
    });
};


/**
 * Close the bot.
 * @param {function} opt_callback Callback wil be invoked when the bot was
 *    closed.
 * @protected
 */
ReceptBot.prototype.close = function(opt_callback) {
  this.getServerMechanism().then(
    function(server) {
      winston.log('info', 'Closing outgoing WebHooks.');

      if (opt_callback) {
        server.close(opt_callback);
      }
      else {
        server.close();
      }
    },
    function(err) {
      throw err;
    });
};


/** @override */
ReceptBot.prototype.start = function() {
  if (!this.isStarted) {
    this.listen();
    this.isStarted = true;
  }
};


/** @override */
ReceptBot.prototype.stop = function() {
  if (this.isStarted) {
    this.close();
    this.isStarted = false;
  }
};


module.exports = ReceptBot;
