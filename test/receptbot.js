/* jshint expr: true */
var url = require('url');
var path = require('path');
var fork = require('child_process').fork;
var expect = require('chai').expect;
var stub = require('sinon').stub;
var extend = require('util-extend');
var winston = require('winston');

var ReceptBot = require('../').ReceptBot;

describe('ReceptBot', function() {
  // Hide log messages between tests
  var logLevel;
  before(function() {
    winston.setLevels(winston.config.syslog.levels);
    winston.level = 'warn';
  });
  after(function() {
    logLevel = winston.level;
  });

  /**
   * Listen port of outgoing WebHooks from the Slack server.
   * @type {number}
   */
  var OUTGOING_HOOK_PORT = 9000;

  /**
   * Valid options to construct the ReceptBot.
   * @type {Object.<string, string>}
   */
  var VALID_OPTIONS_HTTPS = {
    outgoingHookToken: 'XXXXXXXXXXXXXXXXXXXXXXXX',
    outgoingHookURI: '/outgoing-hook',
    port: OUTGOING_HOOK_PORT,
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

  describe('#constructor', function() {
    it('should construct the bot with HTTPS mode', function() {
      var receptbot = new ReceptBot(VALID_OPTIONS_HTTPS);
      expect(receptbot).to.be.instanceof(ReceptBot);
    });

    it('should construct the bot with HTTPS mode with certificate', function() {
      var receptbot = new ReceptBot(VALID_OPTIONS_HTTPS_WITH_CERTIFICATE);
      expect(receptbot).to.be.instanceof(ReceptBot);
    });

    it('should construct the bot with HTTPS mode without outgoingHookURI', function() {
      var validOptions = extend({}, VALID_OPTIONS_HTTP);
      delete validOptions.outgoingHookURI;

      var receptbot = new ReceptBot(validOptions);
      expect(receptbot).to.be.instanceof(ReceptBot);
    });

    it('should construct the bot with HTTP mode', function() {
      var receptbot = new ReceptBot(VALID_OPTIONS_HTTP);
      expect(receptbot).to.be.instanceof(ReceptBot);
    });

    it('should throw an exception when given no options', function() {
      expect(function() {
        new ReceptBot();
      }).to.throw(Error);
    });

    it('should throw an exception when given no outgoingHookToken', function() {
      expect(function() {
        var invalidOptions = extend({}, VALID_OPTIONS_HTTPS);
        delete invalidOptions.outgoingHookToken;
        new ReceptBot(invalidOptions);
      }).to.throw(Error);
    });

    it('should throw an exception when given no port', function() {
      expect(function() {
        var invalidOptions = extend({}, VALID_OPTIONS_HTTPS);
        delete invalidOptions.port;
        new ReceptBot(invalidOptions);
      }).to.throw(Error);
    });
  });


  describe('#start', function() {
    it('should be implemented', function() {
      var receptbot = new ReceptBot(VALID_OPTIONS_HTTPS);
      expect(receptbot).to.have.property('start').that.is.a('function');
    });
  });


  describe('#stop', function() {
    it('should be implemented', function() {
      var receptbot = new ReceptBot(VALID_OPTIONS_HTTPS);
      expect(receptbot).to.have.property('stop').that.is.a('function');
    });
  });


  describe('#getServerMechanism', function() {
    it('should returns a promise wrapped the HTTPS server mechanism', function(done) {
      var receptbot = new ReceptBot(VALID_OPTIONS_HTTPS);
      expect(receptbot.getServerMechanism()).to.have.property('then')
          .that.is.a('function');
      receptbot.getServerMechanism().then(function(server) {
        expect(server).to.have.property('listen').that.is.a('function');
        done();
      });
    });

    it('should returns a promise wrapped the HTTPS server mechanism with the given certificate', function(done) {
      // FIXME: we should check the given certificate was used, but I can't.
      var receptbot = new ReceptBot(VALID_OPTIONS_HTTPS_WITH_CERTIFICATE);
      expect(receptbot.getServerMechanism()).to.have.property('then')
          .that.is.a('function');
      receptbot.getServerMechanism().then(function(server) {
        expect(server).to.have.property('listen').that.is.a('function');
        done();
      });
    });

    it('should returns a promise wrapped the HTTP server mechanism', function(done) {
      var receptbot = new ReceptBot(VALID_OPTIONS_HTTP);
      expect(receptbot.getServerMechanism()).to.have.property('then')
          .that.is.a('function');
      receptbot.getServerMechanism().then(function(server) {
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
    var INVALID_ARRIVED_POST_DATA = extend({}, VALID_ARRIVED_POST_DATA);
    INVALID_ARRIVED_POST_DATA.token = 'INVALID_INVALID_INVALID_INVALID_';

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
      // Start a fixture server that will send request to the receptbot.
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

    // Should close the receptbot after for each test.
    var receptbot;
    afterEach(function() {
      if (!receptbot) {
        return;
      }

      receptbot.close();
    });

    /**
     * Expects the specified event is fired with valid arguments.
     * @param {string} eventType Event type to test.
     * @param {Object} receptbotOptions Options for the receptbot.
     * @param {string} outgoingHookURI URI to receive outgoing WebHooks.
     * @param {Object} receivedData Post data sent by the Slack server.
     * @param {function} done Mocha's `done` function.
     */
    var expectEventWasFired = function(eventType, receptbotOptions, outgoingHookURI, receivedData, done) {
      receptbot = new ReceptBot(receptbotOptions);
      receptbot.on(eventType, function(res) {
        expectOutgoingHookRequest(receivedData, res);
        done();
      });
      receptbot.listen(function() {
        // Send a request to the receptbot over the child process.
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
