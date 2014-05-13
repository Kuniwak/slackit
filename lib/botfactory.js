var assert = require('assert');

var BasicBot = require('./basicbot');
var ReceptBot = require('./receptbot');
var SendBot = require('./sendbot');

/**
 * Namespace for Bot factory.
 * @type {Object}
 */
var BotFactory = {};


/**
 * Builds sendable bot options.
 * @param {Object} opts Options for the sendable bot.
 * @param {Object} configObj Config objects is described by the config JSON.
 * @return {Object} Sendable bot options.
 * @private
 */
BotFactory.buildSendableOptions_ = function(opts, configObj) {
  var sendOptions = configObj.send;
  assert(sendOptions, 'Options for SendBot is not found.');

  opts.teamname = sendOptions.teamName;
  opts.botname = sendOptions.botName;
  opts.incomingHookToken = sendOptions.incomingHookToken;

  if ('options' in sendOptions) {
    opts.channel = sendOptions.options.channel;
  }

  return opts;
};


/**
 * Builds receivable bot options.
 * @param {Object} opts Options for the sendable bot.
 * @param {Object} configObj Config objects is described by the config JSON.
 * @return {Object} Receivable bot options.
 * @private
 */
BotFactory.buildReceivableOptions_ = function(opts, configObj) {
  var receptOptions = configObj.recept;
  assert(receptOptions, 'Options for ReceptBot is not found.');

  opts.outgoingHookToken = receptOptions.outgoingHookToken;
  opts.outgoingHookURI = receptOptions.outgoingHookURI;

  if ('options' in receptOptions) {
    opts.https = receptOptions.options.https;
  }

  return opts;
};


/**
 * Create the bot instance.
 * @param {Object} configObj Config objects is described by the config JSON.
 * @return {BasicBot|ReceptBot|SendBot} Created bot.
 */
BotFactory.createByConfig = function(configObj) {
  var isSendable = configObj.send && typeof configObj.send === 'object';
  var isReceivable = configObj.recept && typeof configObj.recept === 'object';

  var Bot;
  var opts = {};
  if (isReceivable && isSendable) {
    Bot = BasicBot;
    BotFactory.buildSendableOptions_(opts, configObj);
    BotFactory.buildReceivableOptions_(opts, configObj);
  }
  else if (isReceivable) {
    Bot = ReceptBot;
    BotFactory.buildReceivableOptions_(opts, configObj);
  }
  else if (isSendable) {
    Bot = SendBot;
    BotFactory.buildSendableOptions_(opts, configObj);
  }
  else {
    throw Error('Both recept configd and send configs is not defined.');
  }

  return new Bot(opts);
};

module.exports = BotFactory;
