var EventEmitter = require('events').EventEmitter;
var assert = require('assert');
var inherits = require('util').inherits;
var url = require('url');

var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');


/**
 * Arguments for Statbot.
 */


/**
 * A class for Statbots.
 * @constructor
 * @param {Object.<string, string|boolean>} options Options.
 */
var Statbot = function(options) {
  this.assertOptions_(options);
  this.teamname = options.teamname;
  this.username = options.username;
  this.channel = options.channel;
  this.incomingHookToken = options.incomingHookToken;
  this.enableSSL = !options.http;
};
inherits(Statbot, EventEmitter);


/**
 * Path to outgoing WebHooks listener.
 * @type {string}
 */
Statbot.OUTGOING_HOOK_PATH = '/outgoing-hook';


/**
 * Common event types.
 * @enum {string}
 */
Statbot.EventType = {
  /** Event will be fired when received a new message. */
  MESSAGE: 'message',
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
  assert.equal(typeof options.username, 'string',
               'Invalid username: ' + options.username);
  assert.equal(typeof options.channel, 'string',
               'Invalid channel: ' + options.channel);
  assert.equal(typeof options.incomingHookToken, 'string',
               'Invalid incomig hook token: ' + options.teamname);
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
 * @param {Object.<string, string>|string} obj Message text or object that
 *    should have a message as a `text` property. You can specify a channel as a
 *    `channel` property and, botname as a `username`, icon as a `icon_emoji`.
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
 * @return {{listen: function(number)}} Web server instance.
 * @protected
 */
Statbot.prototype.getServerMechanism = function() {
  if (!this.serverMechanism_) {
    this.serverMechanism_ = express();
    var that = this;
    this.serverMechanism_.use(bodyParser());
    this.serverMechanism_.post(Statbot.OUTGOING_HOOK_PATH, function(req, res) {
      that.emit(Statbot.EventType.MESSAGE, req.body);
    });
  }

  return this.serverMechanism_;
};


/**
 * Listen on the specified port.
 * @param {number} port The port to listen.
 */
Statbot.prototype.listen = function(port) {
  this.getServerMechanism().listen(port);
};


module.exports = Statbot;
