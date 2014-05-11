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
    BASIC: path.join(CONFIG_DIR_PATH, 'config.json'),
    BASIC_HTTP: path.join(CONFIG_DIR_PATH, 'basic_http_config.json'),
    SPECIFIC: path.join(CONFIG_DIR_PATH, 'specific_config.json'),
    RECEIVE_ONLY: path.join(CONFIG_DIR_PATH, 'receiveonly_config.json'),
    SEND_ONLY: path.join(CONFIG_DIR_PATH, 'sendonly_config.json'),
    BROKEN: path.join(CONFIG_DIR_PATH, 'broken_config.json'),
    INVALID: path.join(CONFIG_DIR_PATH, 'invalid_config.json'),
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
    it('should return the basic bot when the basic HTTPS config was given', function() {
      var config = require(CONFIG_FILE_PATH.BASIC);
      var bot = BotFactory.createByConfig(config);

      expectToImplementSendOnlyBot(bot);
      expectToImplementReceiveOnlyBot(bot);
    });

    it('should return the basic bot when the basic HTTP config was given', function() {
      var config = require(CONFIG_FILE_PATH.BASIC_HTTP);
      var bot = BotFactory.createByConfig(config);

      expectToImplementSendOnlyBot(bot);
      expectToImplementReceiveOnlyBot(bot);
    });

    it('should return the basic bot when the specific config was given', function() {
      var config = require(CONFIG_FILE_PATH.SPECIFIC);
      var bot = BotFactory.createByConfig(config);

      expectToImplementSendOnlyBot(bot);
      expectToImplementReceiveOnlyBot(bot);
    });

    it('should return the receive-only bot when the receive-only config was given', function() {
      var config = require(CONFIG_FILE_PATH.RECEIVE_ONLY);
      var bot = BotFactory.createByConfig(config);

      expectToImplementReceiveOnlyBot(bot);
    });

    it('should return the send-only bot when the send-only config was given', function() {
      var config = require(CONFIG_FILE_PATH.SEND_ONLY);
      var bot = BotFactory.createByConfig(config);

      expectToImplementSendOnlyBot(bot);
    });

    it('should throw exception when broken config was given', function() {
      expect(function() {
        var config = require(CONFIG_FILE_PATH.BROKEN);
        var bot = BotFactory.createByConfig(config);
      }).to.throw(Error);
    });

    it('should throw exception when broken config was given', function() {
      expect(function() {
        var config = require(CONFIG_FILE_PATH.INVALID);
        var bot = BotFactory.createByConfig(config);
      }).to.throw(Error);
    });
  });
});
