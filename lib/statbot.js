var assert = require('assert');
var SlackHelper = require('node-slack');


/**
 * A class for statbots.
 * @constructor
 * @param {Object<string, string>} options Options.
 * @param {Statbot.Mechanism=} opt_mechanism Optional server mechanism.
 */
var Statbot = function(options, opt_mechanism) {
  this.assertOptions_(options);
};


/**
 * Asserts the specfied options.
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
 * Returns a slack helper.
 * @return {SlackHelper} Slack helper.
 */
Statbot.prototype.getSlackHelper = function() {
  return this.helper_ || (this.helper_ = new SlackHelper({
    domain: this.teamname,
    token: this.incomingHookToken
  }));
};


module.exports = Statbot;
