/* jshint expr: true */
var path = require('path');

var chai = require('chai');
var expect = chai.expect;

var BotFactory = require('../lib/botfactory');

describe('BotFactory', function() {
  /**
   * Directory path for fixture config files.
   * @type {string}
   */
  var CONFIG_DIR_PATH = path.join(__dirname, 'fixture', 'config');

  /**
   * Config file path.
   * @enum {string}
   */
  var CONFIG_FILE_PATH = {
    BASIC_BOT: path.join(CONFIG_DIR_PATH, 'config.json'),
    SPECIFIC_BOT: path.join(CONFIG_DIR_PATH, 'specific_config.json'),
    RECEIVE_ONLY_BOT: path.join(CONFIG_DIR_PATH, 'receiveonly_config.json'),
    SEND_ONLY_BOT: path.join(CONFIG_DIR_PATH, 'sendonly_config.json'),
  };

  /**
   * Expects to impement the send-only bot interface.
   * @param {*} bot Bot instance to test.
   */
  var expectToImplementSendOnlyBot = function(bot) {
    expect(bot).to.have.property('say').that.is.a('function');
  };

  /**
   * Expects to impement the receive-only bot interface.
   * @param {*} bot Bot instance to test.
   */
  var expectToImplementReceiveOnlyBot = function(bot) {
    expect(bot).to.have.property('listen').that.is.a('function');
    expect(bot).to.have.property('close').that.is.a('function');
    expect(bot).to.have.property('on').that.is.a('function');
  };

  describe('.createByConfig', function() {
    it('should return the basic bot when the basic config was given', function() {
      var config = require(CONFIG_FILE_PATH.BASIC_BOT);
      var bot = BotFactory.createByConfig(config);

      expectToImplementSendOnlyBot(bot);
      expectToImplementReceiveOnlyBot(bot);
    });

    it('should return the basic bot when the specific config was given', function() {
      var config = require(CONFIG_FILE_PATH.SPECIFIC_BOT);
      var bot = BotFactory.createByConfig(config);

      expectToImplementSendOnlyBot(bot);
      expectToImplementReceiveOnlyBot(bot);
    });

    it('should return the receive-only bot when the receive-only config was given', function() {
      var config = require(CONFIG_FILE_PATH.RECEIVE_ONLY_BOT);
      var bot = BotFactory.createByConfig(config);

      expectToImplementReceiveOnlyBot(bot);
    });

    it('should return the send-only bot when the send-only config was given', function() {
      var config = require(CONFIG_FILE_PATH.SEND_ONLY_BOT);
      var bot = BotFactory.createByConfig(config);

      expectToImplementSendOnlyBot(bot);
    });
  });
});
