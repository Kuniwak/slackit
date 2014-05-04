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

var Statbot = require('../');

describe('Statbot', function() {
  /**
   * Valid options to construct the Statbot.
   * @type {Object.<string, string>}
   */
  var VALID_OPTIONS_HTTPS = {
    teamname: 'example',
    channel: '#general',
    botname: 'testbot',
    incomingHookToken: 'AAAAAAAAAAAAAAAAAAAAAAAA',
    outgoingHookToken: 'XXXXXXXXXXXXXXXXXXXXXXXX',
    outgoingHookURI: '/outgoing-hook',
  };

  /**
   * Valid options to construct the Statbot.
   * @type {Object.<string, string>}
   */
  var VALID_OPTIONS_HTTP = extend({
    http: true,
  }, VALID_OPTIONS_HTTPS);

  /**
   * Invalid options to construct the Statbot.
   */
  var INVALID_OPTIONS = {};

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
   * Listen port of outgoing WebHooks from the Slack server.
   * @type {number}
   */
  var OUTGOING_HOOK_PORT = 9001;


  describe('#constructor', function() {
    it('should throw an exception when given no options', function() {
      expect(function() {
        new Statbot();
      }).to.throw(Error);
    });

    it('should throw an exception when given invalid options', function() {
      expect(function() {
        new Statbot(INVALID_OPTIONS);
      }).to.throw(Error);
    });

    it('should construct the bot', function() {
      var statbot = new Statbot(VALID_OPTIONS_HTTPS);
      expect(statbot).to.be.instanceof(Statbot);
    });
  });


  describe('#createReceivingMechanism', function() {
    it('should return a receiving mechanism', function() {
      var statbot = new Statbot(VALID_OPTIONS_HTTPS);
      var receiver = statbot.createReceivingMechanism(VALID_OPTIONS_HTTPS);

      // Expect the receiver implement ReceivingMechanism.
      expect(receiver).to.have.property('listen').that.is.a('function');
      expect(receiver).to.have.property('close').that.is.a('function');
      expect(receiver).to.have.property('on').that.is.a('function');
    });
  });


  describe('#createSendingMechanism', function() {
    it('should return a sending mechanism', function() {
      var statbot = new Statbot(VALID_OPTIONS_HTTPS);
      var sender = statbot.createSendingMechanism(VALID_OPTIONS_HTTPS);

      // Expect the sender implement SendingMechanism.
      expect(receiver).to.have.property('say').that.is.a('function');
    });
  });


  describe('#say', function() {
    var statbot;
    beforeEach(function() {
      statbot = new Statbot(VALID_OPTIONS_HTTPS);
      spy(statbot.sendingMechanism, 'say');
    });

    afterEach(function() {
      statbot.sendingMechanism.say.restore();
    });

    it('should delegate to own #sendingMechanism#say when a message string was given', function() {
      var msg = '0123456789abcdABCD @+-_!?/:"\'';
      statbot.say(msg);

      expect(statbot.sendingMechanism.say).to.have.been.calledWith(msg);
    });

    it('should delegate to own #sendingMechanism#say when a message object was given', function() {
      var msg = {
        text: '0123456789abcdABCD @+-_!?/:"\'',
        channel: '#playground',
        botname: 'statbot',
        icon_emoji: ':ghost:',
      };
      statbot.say(msg);

      expect(statbot.sendingMechanism.say).to.have.been.called;
      // This test case should accept additional properties.
      // So it expect to the properties that are included the given message
      // object have same values.
      expect(statbot.sendingMechanism.say).to.have.deep.property('args[0][0]').that.include(msg);
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
     * URI where the Slack server will send to new messages with HTTP.
     * @type {string}
     * @const
     */
    var OUTGOING_HOOK_HTTP_URI =  url.format({
      protocol: 'http',
      hostname: 'localhost',
      port: OUTGOING_HOOK_PORT,
      pathname: VALID_OPTIONS_HTTP.outgoingHookURI,
    });

    /**
     * URI where the Slack server will send to new messages with HTTPS.
     * @type {string}
     * @const
     */
    var OUTGOING_HOOK_HTTPS_URI = url.format({
      protocol: 'https',
      hostname: 'localhost',
      port: OUTGOING_HOOK_PORT,
      pathname: VALID_OPTIONS_HTTPS.outgoingHookURI,
    });

    /**
     * Expects the specified event is fired with valid arguments.
     * @param {string} eventType Event type to test.
     * @param {Object} statbotOptions Options for the statbot.
     * @param {string} outgoingHookURI URI to receive outgoing WebHooks.
     * @param {Object} receivedData Post data sent by the Slack server.
     * @param {function} done Mocha's `done` function.
     */
    var expectToDelegateToReceiveMessage = function(eventType, statbotOptions, receivedData, done) {
      var statbot = new Statbot(statbotOptions);
      statbot.on(eventType, function(res) {
        expectValidMessageObject(receivedData, res);
        done();
      });
      statbot.receivingMechanism.emit(eventType, receivedData);
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

    it('should handle accepted outgoing WebHooks over HTTP by delegation', function(done) {
      expectToDelegateToReceiveMessage(
          Statbot.EventType.MESSAGE,
          VALID_OPTIONS_HTTP,
          VALID_ARRIVED_POST_DATA,
          done);
    });

    it('should handle accepted outgoing WebHooks over HTTPS by delegation', function(done) {
      expectToDelegateToReceiveMessage(
          Statbot.EventType.MESSAGE,
          VALID_OPTIONS_HTTPS,
          VALID_ARRIVED_POST_DATA,
          done);
    });

    it('should reject unaccepted outgoing WebHooks over HTTP by delegation', function(done) {
      expectToDelegateToReceiveMessage(
          Statbot.EventType.INVALID_MESSAGE,
          VALID_OPTIONS_HTTP,
          INVALID_ARRIVED_POST_DATA,
          done);
    });

    it('should reject unaccepted outgoing WebHooks over HTTPS by delegation', function(done) {
      expectToDelegateToReceiveMessage(
          Statbot.EventType.INVALID_MESSAGE,
          VALID_OPTIONS_HTTPS,
          INVALID_ARRIVED_POST_DATA,
          done);
    });
  });
});
