/* jshint expr: true */
var url = require('url');
var path = require('path');
var fork = require('child_process').fork;
var expect = require('chai').expect;
var stub = require('sinon').stub;
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


  // We should test request over the HTTP connection.
  var incomingHookProcess;
  before(function(done) {
    // Start a fixture server.
    incomingHookProcess = fork(path.join(__dirname, 'fixture', 'incoming_hook'),
                         [String(INCOMING_HOOK_PORT)]);
    incomingHookProcess.on('message', function(res) {
      if (!res || !res.ready) {
        throw Error('Cannot start the fixture server.');
      }
      done();
    });
  });

  after(function() {
    incomingHookProcess.kill();
  });


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


  describe('#say', function() {
    /**
     * Expects the specified message object has:
     *
     * - using valid URI for incoming WebHooks
     * - using the `POST` method
     * - using a Content-Type as `application/x-www-form-urlencoded`
     * - including a `payload` as a form parameter
     *
     * @param {*} expectMsgObj Expected message object.
     * @param {*} actualBody Response object as a JSON.
     */
    var expectMsgObj = function(expectedMsgObj, actualBody) {
        expect(actualBody).to.be.an('string');
        var body = JSON.parse(actualBody);
        // Check the HTTP content.
        expect(body).to.have.property('url', url.parse(INCOMING_HOOK_URI_FIXTURE).path);
        expect(body).to.have.property('method', 'POST');
        expect(body).to.have.deep.property('headers.content-type')
            .that.include('application/x-www-form-urlencoded');
        expect(body).to.have.deep.property('body.payload').that.is.a('string');

        // Check the POST body.
        var requestBody = JSON.parse(body.body.payload);
        expect(requestBody).to.have.property('text', expectedMsgObj.text);
        expect(requestBody).to.have.property('channel', expectedMsgObj.channel);

        if ('botname' in expectedMsgObj) {
          expect(requestBody).to.have.property('botname', expectedMsgObj.botname);
        }
        if ('icon_emoji' in expectedMsgObj) {
          expect(requestBody).to.have.property('icon_emoji', expectedMsgObj.icon_emoji);
        }
    };


    before(function() {
      // Spy Statbot#getIncomingHookURI to return an URL to the fixture server.
      // It requests to the fixture server on `INCOMING_HOOK_URI_FIXTURE`.
      // This fixture server should echoes a request content as JSON.
      stub(Statbot.prototype, 'getIncomingHookURI');
      Statbot.prototype.getIncomingHookURI.returns(INCOMING_HOOK_URI_FIXTURE);
    });

    after(function() {
      Statbot.prototype.getIncomingHookURI.restore();
    });

    it('should call getIncomingHookURI to get an incoming WebHooks URI', function() {
      // This behavior is necessary because tests for `#say` expect to be able
      // to stub `#getIncomingHookURI`. This stubbing make tests reality.
      var statbot = new Statbot(VALID_OPTIONS_HTTPS);
      statbot.say('test');
      expect(statbot.getIncomingHookURI).to.have.property('called').that.is.true;
    });

    it('should send a message by given a text (#general should be used)', function(done) {
      var msg = '0123456789abcdABCD @+-_!?/:"\'';
      var statbot = new Statbot(VALID_OPTIONS_HTTPS);

      statbot.say(msg, function(err, response, jsonBody) {
        // Use #general channel as default.
        var expected = {
          text: msg,
          channel: '#general',
        };
        expectMsgObj(expected, jsonBody);
        done();
      });
    });

    it('should send a message by given an object has a text (#general should be used)', function(done) {
      var msgObj = {
        text: '0123456789abcdABCD @+-_!?/:"\''
      };
      var statbot = new Statbot(VALID_OPTIONS_HTTPS);

      statbot.say(msgObj, function(err, response, jsonBody) {
        // Use #general channel as default.
        var expected = {
          text: msgObj.text,
          channel: '#general',
        };
        expectMsgObj(expected, jsonBody);
        done();
      });
    });

    it('should send a message by given an object has a text, channel, botname, icon_emoji', function(done) {
      var msgObj = {
        text: '0123456789abcdABCD @+-_!?/:"\'',
        channel: '#playground',
        botname: 'statbot',
        icon_emoji: ':ghost:',
      };
      var statbot = new Statbot(VALID_OPTIONS_HTTPS);

      statbot.say(msgObj, function(err, response, jsonBody) {
        // Use #general channel as default.
        var expected = msgObj;
        expectMsgObj(expected, jsonBody);
        done();
      });
    });
  });


  describe('#getIncomingHookURI', function() {
    it('should return a default incoming hook URI', function() {
      var statbot = new Statbot(VALID_OPTIONS_HTTPS);
      expect(statbot.getIncomingHookURI()).to.be.equal(INCOMING_HOOK_URI);
    });
  });


  describe('#getServerMechanism', function() {
    it('should returns a promise wrapped the HTTPS server mechanism', function(done) {
      var statbot = new Statbot(VALID_OPTIONS_HTTPS);
      expect(statbot.getServerMechanism()).to.have.property('then')
          .that.is.a('function');
      statbot.getServerMechanism().then(function(server) {
        expect(server).to.have.property('listen').that.is.a('function');
        done();
      });
    });

    it('should returns a promise wrapped the HTTP server mechanism', function(done) {
      var statbot = new Statbot(VALID_OPTIONS_HTTP);
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

      statbot = new Statbot(statbotOptions);
      statbot.on(eventType, function(res) {
        expectOutgoingHookRequest(VALID_ARRIVED_POST_DATA, res);
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
          Statbot.EventType.MESSAGE,
          VALID_OPTIONS_HTTP,
          OUTGOING_HOOK_HTTP_URI,
          VALID_ARRIVED_POST_DATA,
          done);
    });

    it('should handle accepted outgoing WebHooks over HTTPS', function(done) {
      expectEventWasFired(
          Statbot.EventType.MESSAGE,
          VALID_OPTIONS_HTTPS,
          OUTGOING_HOOK_HTTPS_URI,
          VALID_ARRIVED_POST_DATA,
          done);
    });

    it('should reject unaccepted outgoing WebHooks over HTTP', function(done) {
      expectEventWasFired(
          Statbot.EventType.INVALID_MESSAGE,
          VALID_OPTIONS_HTTP,
          OUTGOING_HOOK_HTTP_URI,
          INVALID_ARRIVED_POST_DATA,
          done);
    });

    it('should reject unaccepted outgoing WebHooks over HTTPS', function(done) {
      expectEventWasFired(
          Statbot.EventType.INVALID_MESSAGE,
          VALID_OPTIONS_HTTPS,
          OUTGOING_HOOK_HTTPS_URI,
          INVALID_ARRIVED_POST_DATA,
          done);
    });
  });
});
