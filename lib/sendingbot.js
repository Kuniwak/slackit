var assert = require('assert');
var inherits = require('util').inherits;
var url = require('url');

var request = require('request');



/**
 * A class for SendingBots.
 * The `options` should have 3 properties and an optional propertiy are
 * available.
 *
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
 * @constructor
 * @param {Object.<string, string|number|boolean>} options Options.
 */
var SendingBot = function(options) {
  this.assertOptions_(options);

  this.teamname = options.teamname;
  this.botname = options.botname;
  this.channel = options.channel || SendingBot.DEFAULT_CHANNEL;
  this.incomingHookToken = options.incomingHookToken;
};


/**
 * Default channel to send a message.
 * @type {string}
 */
SendingBot.DEFAULT_CHANNEL = '#general';


/**
 * Asserts the options for the SendingBot.
 * @param {*} options Options to test.
 * @private
 */
SendingBot.prototype.assertOptions_ = function(options) {
  assert(options || typeof options !== 'object',
         'Invalid options: ' + options);

  assert.equal(typeof options.teamname, 'string',
               'Invalid teamname: ' + options.teamname);
  assert.equal(typeof options.botname, 'string',
               'Invalid botname: ' + options.botname);
  assert.equal(typeof options.incomingHookToken, 'string',
               'Invalid incoming WebHooks token: ' + options.incomingHookToken);

  if (options.channel) {
    assert.equal(typeof options.channel, 'string',
                 'Invalid channel: ' + options.channel);
  }
};


/**
 * Returns an URI for incoming WebHooks.
 * You should add an incoming WebHooks on your Slack integration page.
 * @return {string} Incoming hook URI.
 * @protected
 * @see https://{your team name}.slack.com/services/new/incoming-webhook
 */
SendingBot.prototype.getIncomingHookURI = function() {
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
 * @param {SendingBotMessage} obj Message text or object that
 *    should have a message as a `text` property. You can specify a channel as a
 *    `channel` property and, botname as a `botname`, icon as a `icon_emoji`.
 * @param {function=} callback Callback will be invloked when the message was
 *    posted.
 * @see https://{your team name}.slack.com/services/new/incoming-webhook
 */
SendingBot.prototype.say = function(obj, callback) {
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
SendingBot.prototype.assertMessage_ = function(msg) {
  assert.equal(typeof msg, 'object');
  assert.equal(typeof msg.text, 'string');
};


module.exports = SendingBot;
