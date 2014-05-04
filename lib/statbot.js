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

var ReceivingBot = require('./receivingbot');
var SendingBot = require('./sendingbot');



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
  EventEmitter.call(this);

  /**
   * Receiving mechanism.
   * @type {ReceivingBot}
   * @protected
   */
  this.receivingMechanism = this.createReceivingMechanism(options);

  /**
   * Sending mechanism.
   * @type {SendingBot}
   * @protected
   */
  this.sendingMechanism = this.createSendingMechanism(options);
};
inherits(Statbot, EventEmitter);


/**
 * Default path where outgoing WebHooks listener.
 * @type {string}
 */
Statbot.DEFAULT_OUTGOING_HOOK_PATH = ReceivingBot.DEFAULT_OUTGOING_HOOK_PATH;


/**
 * Default channel to send a message.
 * @type {string}
 */
Statbot.DEFAULT_CHANNEL = SendingBot.DEFAULT_CHANNEL;


/**
 * Common event types.
 * @enum {string}
 */
Statbot.EventType = ReceivingBot.EventType;


/**
 * Say the given message by using official incoming WebHooks.
 * Say the message on #general if the channel property is omitted.
 * @param {StatbotMessage} obj Message text or object that
 *    should have a message as a `text` property. You can specify a channel as a
 *    `channel` property and, botname as a `botname`, icon as a `icon_emoji`.
 * @param {function=} callback Callback will be invloked when the message was
 *    posted.
 * @see https://{your team name}.slack.com/services/new/incoming-webhook
 */
Statbot.prototype.say = function(obj) {
  this.sendingMechanism.say(obj);
};


/**
 * Listen on the specified port.
 * @param {number} port The port to listen.
 * @param {function} callback Callback wil be invoked when the statbot started
 *    listening.
 */
Statbot.prototype.listen = function(port, callback) {
  this.receivingMechanism.listen(port, callback);
};


/**
 * Close the statbot.
 * @param {function} callback Callback wil be invoked when the statbot was
 *    closed.
 */
Statbot.prototype.close = function(callback) {
  this.receivingMechanism.close(callback);
};


/**
 * Creates a receiving mechanism.
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
 * @param {Object.<string, string|number|boolean>} options Options.
 * @protected
 */
Statbot.prototype.createReceivingMechanism = function(options) {
  var statbot = this;
  var receiver =  new ReceivingBot(options);

  // Statbot will be fired when events of ReceivingMechanism was fired.
  Object.keys(ReceivingBot.EventType).forEach(function(eventTypeKey) {
    var eventType = ReceivingBot.EventType[eventTypeKey];
    receiver.on(eventType, function() {
      var args = Array.prototype.slice.call(arguments);
      args.unshift(eventType);
      statbot.emit.apply(statbot, args);
    });
  });

  return receiver;
};


/**
 * Creates a sending mechanism.
 * The `options` should have 3 properties and an optional propertiy are
 * available.
 * Necessary:
 *  - `options.teamname`: Name of the your team (equals the sub domain of your
 *    slack page)
 *  - `options.botname`: Name of the bot.
 *  - `options.incomingHookToken`: Token for incoming WebHooks.
 *
 * Optional:
 *  - `options.channel` (default `#general`): Default channel to send a message
 *     by the bot.
 *
 * @param {Object.<string, string|number|boolean>} options Options.
 * @protected
 */
Statbot.prototype.createSendingMechanism = function(options) {
  return new SendingBot(options);
};


module.exports = Statbot;
