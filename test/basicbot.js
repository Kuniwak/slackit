/* jshint expr: true */
var url = require('url');
var path = require('path');
var fork = require('child_process').fork;

var stub = require('sinon').stub;
var spy = require('sinon').spy;
var sinonChai = require("sinon-chai");
var chai = require('chai');
chai.use(sinonChai);
var expect = chai.expect;
var extend = require('util-extend');

var BasicBot = require('../');

describe('BasicBot', function() {
  /**
   * Default the URL to Slack server.
   * @type {string}
   */
  var INCOMING_HOOK_URI = url.format({
    protocol: 'https',
    hostname: 'example.slack.com',
    pathname: 'services/hooks/incoming-webhook',
    query: { 'token': 'AAAAAAAAAAAAAAAAAAAAAAAA' },
  });

  /**
   * Listen port of the fixture server.
   * The server will echo the given request to the port.
   * @see test/fixture/server.js
   * @type {number}
   */
  var INCOMING_HOOK_PORT = 9000;

  /**
   * URL to the fixture server.
   * NOTE: The protocol should use SSL.
   * @type {string}
   */
  var INCOMING_HOOK_URI_FIXTURE = url.format({
    protocol: 'http',
    hostname: 'localhost',
    port: INCOMING_HOOK_PORT,
    pathname: 'services/hooks/incoming-webhook',
    query: { 'token': 'AAAAAAAAAAAAAAAAAAAAAAAA' },
  });

  /**
   * Valid options to construct the BasicBot.
   * @type {Object.<string, string>}
   */
  var VALID_OPTIONS_HTTPS = {
    teamname: 'example',
    channel: '#general',
    botname: 'testbot',
    incomingHookToken: 'AAAAAAAAAAAAAAAAAAAAAAAA',
    outgoingHookToken: 'XXXXXXXXXXXXXXXXXXXXXXXX',
    outgoingHookURI: 'https://localhost:9001/outgoing-hook',
  };

  /**
   * Valid options to construct the ReceptBot.
   * @type {Object.<string, string>}
   */
  var VALID_OPTIONS_HTTPS_WITH_CERTIFICATE = extend({
    https: {
      key: 'test/fixture/config/ssl/key.pem',
      cert: 'test/fixture/config/ssl/cert.pem',
    },
  }, VALID_OPTIONS_HTTPS);

  /**
   * Valid options to construct the BasicBot.
   * @type {Object.<string, string>}
   */
  var VALID_OPTIONS_HTTP = extend({
    outgoingHookURI: 'http://localhost:9001/outgoing-hook',
  }, VALID_OPTIONS_HTTPS);


  describe('#constructor', function() {
    it('should construct the bot with HTTPS mode', function() {
      new BasicBot(VALID_OPTIONS_HTTPS);
    });

    it('should construct the bot with HTTPS mode with certificate', function() {
      new BasicBot(VALID_OPTIONS_HTTPS_WITH_CERTIFICATE);
    });

    it('should construct the bot with HTTPS mode with no channel', function() {
      var validOptions = extend({}, VALID_OPTIONS_HTTPS);
      delete validOptions.channel;

      new BasicBot(validOptions);
    });

    it('should construct the bot with HTTP mode', function() {
      new BasicBot(VALID_OPTIONS_HTTP);
    });

    it('should throw an exception when given no options', function() {
      expect(function() {
        new BasicBot();
      }).to.throw(Error);
    });

    it('should throw an exception when given no outgoingHookToken', function() {
      expect(function() {
        var invalidOptions = extend({}, VALID_OPTIONS_HTTPS);
        delete invalidOptions.outgoingHookToken;
        new BasicBot(invalidOptions);
      }).to.throw(Error);
    });

    it('should construct the bot with HTTPS mode with no outgoingHookURI', function() {
      expect(function() {
        var invalidOptions = extend({}, VALID_OPTIONS_HTTP);
        delete invalidOptions.outgoingHookURI;

        new BasicBot(invalidOptions);
      }).to.throw(Error);
    });

    it('should throw an exception when given no incomingHookToken', function() {
      expect(function() {
        var invalidOptions = extend({}, VALID_OPTIONS_HTTPS);
        delete invalidOptions.incomingHookToken;

        new BasicBot(invalidOptions);
      }).to.throw(Error);
    });

    it('should throw an exception when given no teamname', function() {
      expect(function() {
        var invalidOptions = extend({}, VALID_OPTIONS_HTTPS);
        delete invalidOptions.teamname;

        new BasicBot(invalidOptions);
      }).to.throw(Error);
    });

    it('should throw an exception when given no botname', function() {
      expect(function() {
        var invalidOptions = extend({}, VALID_OPTIONS_HTTPS);
        delete invalidOptions.botname;

        new BasicBot(invalidOptions);
      }).to.throw(Error);
    });
  });


  describe('#createReceivingMechanism', function() {
    it('should return a receiving mechanism', function() {
      var bot = new BasicBot(VALID_OPTIONS_HTTPS);
      var receiver = bot.createReceivingMechanism(VALID_OPTIONS_HTTPS);

      // Expect the receiver implement ReceivingMechanism.
      expect(receiver).to.have.property('listen').that.is.a('function');
      expect(receiver).to.have.property('close').that.is.a('function');
      expect(receiver).to.have.property('on').that.is.a('function');
    });
  });


  describe('#createSendingMechanism', function() {
    it('should return a sending mechanism', function() {
      var bot = new BasicBot(VALID_OPTIONS_HTTPS);
      var sender = bot.createSendingMechanism(VALID_OPTIONS_HTTPS);

      // Expect the sender implement SendingMechanism.
      expect(sender).to.have.property('say').that.is.a('function');
    });
  });


  describe('#say', function() {
    var bot;
    beforeEach(function() {
      bot = new BasicBot(VALID_OPTIONS_HTTPS);
      stub(bot.sendingMechanism, 'say');
    });

    afterEach(function() {
      bot.sendingMechanism.say.restore();
    });

    it('should delegate to own #sendingMechanism#say when a message string was given', function() {
      var msg = '0123456789abcdABCD @+-_!?/:"\'';
      bot.say(msg);

      expect(bot.sendingMechanism.say).to.have.been.calledWith(msg);
    });

    it('should delegate to own #sendingMechanism#say when a message object was given', function() {
      var msg = {
        text: '0123456789abcdABCD @+-_!?/:"\'',
        channel: '#playground',
        botname: 'bot',
        icon_emoji: ':ghost:',
      };
      bot.say(msg);

      expect(bot.sendingMechanism.say).to.have.been.called;
      // This test case should accept additional properties.
      // So it expect to the properties that are included the given message
      // object have same values.
      expect(bot.sendingMechanism.say).to.have.deep.property('args[0][0]').that.include(msg);
    });
  });


  describe('#start', function() {
    it('should be implemented', function() {
      var basicbot = new BasicBot(VALID_OPTIONS_HTTPS);
      expect(basicbot).to.have.property('start').that.is.a('function');
    });
  });


  describe('#stop', function() {
    it('should be implemented', function() {
      var basicbot = new BasicBot(VALID_OPTIONS_HTTPS);
      expect(basicbot).to.have.property('stop').that.is.a('function');
    });
  });


  describe('#on', function() {
    /**
     * Valid post form data sent by outgoing WebHooks.
     * @type {Object.<string, string>}
     * @const
     * @see https://{your team name}.slack.com/services/new/outgoing-webhook
     */
    var VALID_ARRIVED_POST_DATA = {
      token: VALID_OPTIONS_HTTPS.outgoingHookToken,
      team_id: 'T0123',
      channel_id: 'C123456789',
      channel_name: 'playground',
      timestamp: String(new Date('2000/1/1').getTime()),
      user_id: 'U0123456789',
      user_name: 'Foo',
      text: '0123456789abcdABCD @+-_!?/:"\'',
    };

    /**
     * Invalid post form data sent by outgoing WebHooks.
     * This post data has the invalid token for outgoing Webooks.
     * @type {Object.<string, string>}
     * @const
     * @see https://{your team name}.slack.com/services/new/outgoing-webhook
     */
    var INVALID_ARRIVED_POST_DATA = {
      token: 'INVALID_INVALID_INVALID_INVALID_',
      team_id: 'T0123',
      channel_id: 'C123456789',
      channel_name: 'playground',
      timestamp: String(new Date('2000/1/1').getTime()),
      user_id: 'U0123456789',
      user_name: 'Foo',
      text: '0123456789abcdABCD @+-_!?/:"\'',
    };

    /**
     * Expects the specified event is fired with valid arguments.
     * @param {string} eventType Event type to test.
     * @param {Object} botOptions Options for the bot.
     * @param {string} outgoingHookURI URI to receive outgoing WebHooks.
     * @param {Object} receivedData Post data sent by the Slack server.
     * @param {function} done Mocha's `done` function.
     */
    var expectToDelegateToReceiveMessage = function(eventType, botOptions, receivedData, done) {
      var bot = new BasicBot(botOptions);
      bot.on(eventType, function(res) {
        expectValidMessageObject(receivedData, res);
        done();
      });
      bot.receivingMechanism.emit(eventType, receivedData);
    };

    /**
     * Expects an outgoing WebHook request.
     * @param {Object.<string, string>} expected Expected outgoing WebHook
     *    request. It should have 8 fields (`token`, `team_id`, `channel_id`,
     *    `channel_name`, `timestamp`, `user_id`, `user_name`, `text`).
     * @param {*} actual Actual parameter for the event handler.
     * @see https://{your team name}.slack.com/services/new/outgoing-webhook
     */
    var expectValidMessageObject = function(expected, actual) {
      expect(actual).to.an('object');
      expect(actual).to.have.property('team_id', expected.team_id);
      expect(actual).to.have.property('channel_id', expected.channel_id);
      expect(actual).to.have.property('channel_name', expected.channel_name);
      expect(actual).to.have.property('timestamp', expected.timestamp);
      expect(actual).to.have.property('user_id', expected.user_id);
      expect(actual).to.have.property('user_name', expected.user_name);
      expect(actual).to.have.property('text', expected.text);
    };

    it('should delegate handling valid message from outgoing WebHooks over HTTP to own #receivingMechanism', function(done) {
      expectToDelegateToReceiveMessage(
          BasicBot.EventType.MESSAGE,
          VALID_OPTIONS_HTTP,
          VALID_ARRIVED_POST_DATA,
          done);
    });

    it('should delegate handling valid message from outgoing WebHooks over HTTPS to own #receivingMechanism', function(done) {
      expectToDelegateToReceiveMessage(
          BasicBot.EventType.MESSAGE,
          VALID_OPTIONS_HTTPS,
          VALID_ARRIVED_POST_DATA,
          done);
    });

    it('should delegate handling invalid message from outgoing WebHooks over HTTP to own #receivingMechanism', function(done) {
      expectToDelegateToReceiveMessage(
          BasicBot.EventType.INVALID_MESSAGE,
          VALID_OPTIONS_HTTP,
          INVALID_ARRIVED_POST_DATA,
          done);
    });

    it('should delegate handling invalid message from outgoing WebHooks over HTTPS to own #receivingMechanism', function(done) {
      expectToDelegateToReceiveMessage(
          BasicBot.EventType.INVALID_MESSAGE,
          VALID_OPTIONS_HTTPS,
          INVALID_ARRIVED_POST_DATA,
          done);
    });
  });
});
