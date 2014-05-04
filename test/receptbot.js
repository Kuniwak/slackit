/* jshint expr: true */
var url = require('url');
var path = require('path');
var fork = require('child_process').fork;
var expect = require('chai').expect;
var stub = require('sinon').stub;
var extend = require('util-extend');
var winston = require('winston');
winston.level = 'warn';

var ReceptBot = require('../').ReceptBot;

describe('ReceptBot', function() {
  /**
   * Valid options to construct the ReceptBot.
   * @type {Object.<string, string>}
   */
  var VALID_OPTIONS_HTTPS = {
    outgoingHookToken: 'XXXXXXXXXXXXXXXXXXXXXXXX',
    outgoingHookURI: '/outgoing-hook',
  };

  /**
   * Valid options to construct the ReceptBot.
   * @type {Object.<string, string>}
   */
  var VALID_OPTIONS_HTTPS_WITH_CERTIFICATE = {
    outgoingHookToken: 'XXXXXXXXXXXXXXXXXXXXXXXX',
    outgoingHookURI: '/outgoing-hook',
    https: {
      key: 'test/fixture/config/ssl/key.pem',
      cert: 'test/fixture/config/ssl/cert.pem',
    },
  };

  /**
   * Valid options to construct the ReceptBot.
   * @type {Object.<string, string>}
   */
  var VALID_OPTIONS_HTTP = extend({
    http: true,
  }, VALID_OPTIONS_HTTPS);

  /**
   * Invalid options to construct the ReceptBot.
   */
  var INVALID_OPTIONS = {};

  /**
   * Listen port of outgoing WebHooks from the Slack server.
   * @type {number}
   */
  var OUTGOING_HOOK_PORT = 9001;


  describe('#constructor', function() {
    it('should throw an exception when given no options', function() {
      expect(function() {
        new ReceptBot();
      }).to.throw(Error);
    });

    it('should throw an exception when given invalid options', function() {
      expect(function() {
        new ReceptBot(INVALID_OPTIONS);
      }).to.throw(Error);
    });

    it('should construct the bot with HTTPS mode', function() {
      var statbot = new ReceptBot(VALID_OPTIONS_HTTPS);
      expect(statbot).to.be.instanceof(ReceptBot);
    });

    it('should construct the bot with HTTPS mode with credential', function() {
      var statbot = new ReceptBot(VALID_OPTIONS_HTTPS_WITH_CERTIFICATE);
      expect(statbot).to.be.instanceof(ReceptBot);
    });

    it('should construct the bot with HTTP mode', function() {
      var statbot = new ReceptBot(VALID_OPTIONS_HTTP);
      expect(statbot).to.be.instanceof(ReceptBot);
    });
  });


  describe('#getServerMechanism', function() {
    it('should returns a promise wrapped the HTTPS server mechanism', function(done) {
      var statbot = new ReceptBot(VALID_OPTIONS_HTTPS);
      expect(statbot.getServerMechanism()).to.have.property('then')
          .that.is.a('function');
      statbot.getServerMechanism().then(function(server) {
        expect(server).to.have.property('listen').that.is.a('function');
        done();
      });
    });

    it('should returns a promise wrapped the HTTPS server mechanism with the given certificate', function(done) {
      // FIXME: we should check the given certificate was used, but I can't.
      var statbot = new ReceptBot(VALID_OPTIONS_HTTPS_WITH_CERTIFICATE);
      expect(statbot.getServerMechanism()).to.have.property('then')
          .that.is.a('function');
      statbot.getServerMechanism().then(function(server) {
        expect(server).to.have.property('listen').that.is.a('function');
        done();
      });
    });

    it('should returns a promise wrapped the HTTP server mechanism', function(done) {
      var statbot = new ReceptBot(VALID_OPTIONS_HTTP);
      expect(statbot.getServerMechanism()).to.have.property('then')
          .that.is.a('function');
      statbot.getServerMechanism().then(function(server) {
        expect(server).to.have.property('listen').that.is.a('function');
        done();
      });
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

    var outgoingHookProcess;
    before(function(done) {
      // Start a fixture server that will send request to the statbot.
      outgoingHookProcess = fork(path.join(__dirname, 'fixture', 'outgoing_hook'));
      outgoingHookProcess.on('message', function(res) {
        if (!res || !res.ready) {
          throw Error('Cannot start the fixture server.');
        }
        done();
      });
    });

    after(function() {
      outgoingHookProcess.kill();
    });

    // Should close the statbot after for each test.
    var statbot;
    afterEach(function() {
      if (!statbot) {
        return;
      }

      statbot.close();
    });

    /**
     * Expects the specified event is fired with valid arguments.
     * @param {string} eventType Event type to test.
     * @param {Object} statbotOptions Options for the statbot.
     * @param {string} outgoingHookURI URI to receive outgoing WebHooks.
     * @param {Object} receivedData Post data sent by the Slack server.
     * @param {function} done Mocha's `done` function.
     */
    var expectEventWasFired = function(eventType, statbotOptions, outgoingHookURI, receivedData, done) {
      var port = url.parse(outgoingHookURI).port;

      statbot = new ReceptBot(statbotOptions);
      statbot.on(eventType, function(res) {
        expectOutgoingHookRequest(receivedData, res);
        done();
      });
      statbot.listen(port, function() {
        // Send a request to the statbot over the child process.
        outgoingHookProcess.send({ url: outgoingHookURI, form: receivedData });
      });
    };

    /**
     * Expects an outgoing WebHook request.
     * @param {Object.<string, string>} expected Expected outgoing WebHook
     *    request. It should have 8 fields (`token`, `team_id`, `channel_id`,
     *    `channel_name`, `timestamp`, `user_id`, `user_name`, `text`).
     * @param {*} actual Actual parameter for the event handler.
     * @see https://{your team name}.slack.com/services/new/outgoing-webhook
     */
    var expectOutgoingHookRequest = function(expected, actual) {
      expect(actual).to.an('object');
      expect(actual).to.have.property('team_id', expected.team_id);
      expect(actual).to.have.property('channel_id', expected.channel_id);
      expect(actual).to.have.property('channel_name', expected.channel_name);
      expect(actual).to.have.property('timestamp', expected.timestamp);
      expect(actual).to.have.property('user_id', expected.user_id);
      expect(actual).to.have.property('user_name', expected.user_name);
      expect(actual).to.have.property('text', expected.text);
    };

    it('should handle accepted outgoing WebHooks over HTTP', function(done) {
      expectEventWasFired(
          ReceptBot.EventType.MESSAGE,
          VALID_OPTIONS_HTTP,
          OUTGOING_HOOK_HTTP_URI,
          VALID_ARRIVED_POST_DATA,
          done);
    });

    it('should handle accepted outgoing WebHooks over HTTPS', function(done) {
      expectEventWasFired(
          ReceptBot.EventType.MESSAGE,
          VALID_OPTIONS_HTTPS,
          OUTGOING_HOOK_HTTPS_URI,
          VALID_ARRIVED_POST_DATA,
          done);
    });

    it('should reject unaccepted outgoing WebHooks over HTTP', function(done) {
      expectEventWasFired(
          ReceptBot.EventType.INVALID_MESSAGE,
          VALID_OPTIONS_HTTP,
          OUTGOING_HOOK_HTTP_URI,
          INVALID_ARRIVED_POST_DATA,
          done);
    });

    it('should reject unaccepted outgoing WebHooks over HTTPS', function(done) {
      expectEventWasFired(
          ReceptBot.EventType.INVALID_MESSAGE,
          VALID_OPTIONS_HTTPS,
          OUTGOING_HOOK_HTTPS_URI,
          INVALID_ARRIVED_POST_DATA,
          done);
    });
  });
});
