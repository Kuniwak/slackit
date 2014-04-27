var assert = require('assert');
var url = require('url');
var request = require('request');


/**
 * A class for Statbots.
 * @constructor
 * @param {Object<string, string>} options Options.
 */
var Statbot = function(options) {
  this.assertOptions_(options);
  this.teamname = options.teamname;
  this.username = options.username;
  this.channel = options.channel;
  this.incomingHookToken = options.incomingHookToken;
};


/**
 * Asserts the options for the Statbot.
 * @param {*} options Options to test.
 * @private
 */
Statbot.prototype.assertOptions_ = function(options) {
  assert(options || typeof options !== 'object',
         'Invalid options: ' + options);
  assert.equal(typeof options['teamname'], 'string',
               'Invalid teamname: ' + options.teamname);
  assert.equal(typeof options['username'], 'string',
               'Invalid username: ' + options.username);
  assert.equal(typeof options['channel'], 'string',
               'Invalid channel: ' + options.channel);
  assert.equal(typeof options['incomingHookToken'], 'string',
              'Invalid incomig hook token: ' + options.teamname);
};


/**
 * Returns an URI for incoming WebHooks.
 * You should add an incoming WebHooks on your Slack integration page.
 * @see https://{your team name}.slack.com/services/new/incoming-webhook
 * @return {string} Incoming hook URI.
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
 * @see https://{your team name}.slack.com/services/new/incoming-webhook
 * @param {Object.<string, string>|string} obj Message text or object that
 *    should have a message as a `text` property. You can specify a channel as a
 *    `channel` property and, botname as a `username`, icon as a `icon_emoji`.
 */
Statbot.prototype.say = function(obj, callback) {
  var msg = typeof obj === 'string' ? { text: obj } : obj;
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

module.exports = Statbot;
